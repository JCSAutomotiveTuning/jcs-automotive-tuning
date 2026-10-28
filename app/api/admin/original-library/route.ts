import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { suggestFileIdentifiers } from "@/lib/file-identifier-suggestions";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function adminOnly() {
  const auth = await createClient();
  const { data: { user }, error } = await auth.auth.getUser();
  if (error || !user) return { response: NextResponse.json({ error: "Sign in required" }, { status: 401 }) };
  const { data: profile, error: roleError } = await auth.from("profiles").select("role").eq("id", user.id).maybeSingle();
  if (roleError || profile?.role !== "admin") return { response: NextResponse.json({ error: "Admin required" }, { status: 403 }) };
  return { user };
}

const idSchema = z.object({
  fileId: z.string().uuid(),
  hwId: z.string().trim().min(2).max(100).regex(/^[a-zA-Z0-9._/-]+$/).optional(),
  swId: z.string().trim().min(2).max(100).regex(/^[a-zA-Z0-9._/-]+$/).optional(),
}).refine(v => (!!v.hwId) === (!!v.swId), { message: "HW and SW must both be provided or both omitted." });

export async function GET() {
  const gate = await adminOnly();
  if ("response" in gate) return gate.response;
  const db = createAdminClient();
  const [files, catalog] = await Promise.all([
    db.from("order_files").select("id,order_id,original_filename,size_bytes,scan_status,created_at,user_id").eq("kind","customer_original").order("created_at", { ascending: false }).limit(1000),
    db.from("original_file_catalog").select("file_id,hw_id,sw_id").limit(1000),
  ]);
  if (files.error || catalog.error || !files.data || !catalog.data)
    return NextResponse.json({ error: "File catalogue unavailable" }, { status: 503 });
  // Never expose customer details or raw storage paths through this listing.
  const meta = new Map(catalog.data.map(x => [x.file_id, x]));
  const items = files.data.map(f => {
    const m = meta.get(f.id);
    const defined = !!m?.hw_id && !!m?.sw_id;
    return { fileId: f.id, filename: f.original_filename, orderId: f.order_id,
      sizeBytes: f.size_bytes, scanStatus: f.scan_status, createdAt: f.created_at,
      hwId: m?.hw_id ?? null, swId: m?.sw_id ?? null,
      category: defined ? "identified" : "undefined",
      suggestion: defined || f.scan_status !== "clean" ? null : suggestFileIdentifiers(f.original_filename) };
  });
  items.sort((a,b) => (a.category === b.category
    ? ((a.hwId ?? "").localeCompare(b.hwId ?? "") || (a.swId ?? "").localeCompare(b.swId ?? "") || b.createdAt.localeCompare(a.createdAt))
    : a.category === "identified" ? -1 : 1));
  return NextResponse.json({ items, truncated: files.data.length === 1000 || catalog.data.length === 1000 }, { headers: { "Cache-Control": "no-store" } });
}

export async function PATCH(req: Request) {
  const gate = await adminOnly();
  if ("response" in gate) return gate.response;
  const parsed = idSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Supply a file ID and both HW/SW IDs, or neither." }, { status: 400 });
  const { fileId, hwId, swId } = parsed.data;
  const db = createAdminClient();
  const { data: source, error: sourceError } = await db.from("order_files").select("id,scan_status").eq("id",fileId).eq("kind","customer_original").maybeSingle();
  if (sourceError) return NextResponse.json({ error: "Could not verify source file" }, { status: 503 });
  if (!source) return NextResponse.json({ error: "Original file not found" }, { status: 404 });
  if (source.scan_status !== "clean") return NextResponse.json({ error: "File must pass antivirus scanning before cataloguing" }, { status: 409 });
  if (!hwId || !swId) {
    const { error } = await db.from("original_file_catalog").delete().eq("file_id",fileId);
    return error ? NextResponse.json({ error: "Could not clear identifiers" }, { status: 503 })
      : NextResponse.json({ ok: true, category: "undefined" });
  }
  const { error } = await db.from("original_file_catalog").upsert({
    file_id: fileId, hw_id: hwId.toUpperCase(), sw_id: swId.toUpperCase(),
    verified_by: gate.user.id, verified_at: new Date().toISOString(), updated_at: new Date().toISOString()
  }, { onConflict: "file_id" });
  if (error) return NextResponse.json({ error: "Could not save identifiers" }, { status: 503 });
  return NextResponse.json({ ok: true, category: "identified" });
}

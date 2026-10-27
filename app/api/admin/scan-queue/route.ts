import { NextResponse } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Access is restricted to a *verified* Supabase JWT belonging to an admin.
// Never accept a client-supplied role, file path, bucket, or scan verdict without verification.
const resultSchema = z.object({
  fileId: z.string().uuid(),
  kind: z.enum(["order", "technical"]),
  verdict: z.enum(["clean", "blocked", "error"]),
  sha256: z.string().regex(/^[0-9a-f]{64}$/),
});

async function scannerAdmin(req: Request) {
  const token = req.headers.get("authorization")?.match(/^Bearer ([A-Za-z0-9._-]+)$/)?.[1];
  if (!token) return null;
  const admin = createAdminClient();
  const { data, error } = await admin.auth.getUser(token);
  if (error || !data.user) return null;
  const { data: profile, error: profileError } = await admin
    .from("profiles").select("role").eq("id", data.user.id).maybeSingle();
  if (profileError || profile?.role !== "admin") return null;
  return admin;
}

function response(data: unknown, status = 200) {
  return NextResponse.json(data, { status, headers: { "Cache-Control": "no-store" } });
}

export async function GET(req: Request) {
  const admin = await scannerAdmin(req);
  if (!admin) return response({ error: "Admin authentication required." }, 403);

  for (const config of [
    { kind: "order" as const, table: "order_files", bucket: "tuning-files" },
    { kind: "technical" as const, table: "technical_request_files", bucket: "technical-deliverables" },
  ]) {
    const { data, error } = await admin.from(config.table)
      .select("id,storage_path,size_bytes")
      .eq("scan_status", "pending").order("created_at", { ascending: true }).limit(1);
    if (error) {
      console.error("Scanner queue lookup failed:", config.kind, error.message);
      return response({ error: "Scanner queue unavailable." }, 503);
    }
    const file = data?.[0];
    if (!file) continue;
    const size = Number(file.size_bytes);
    if (!Number.isSafeInteger(size) || size <= 0 || size > 16 * 1024 * 1024) {
      return response({ error: "Pending file has invalid size.", fileId: file.id }, 409);
    }
    const { data: signed, error: signError } = await admin.storage
      .from(config.bucket).createSignedUrl(file.storage_path, 120);
    if (signError || !signed?.signedUrl) {
      console.error("Scanner signed URL unavailable:", config.kind, file.id, signError?.message);
      return response({ error: "Pending file cannot be accessed." }, 503);
    }
    return response({ file: { id: file.id, kind: config.kind, sizeBytes: size }, signedUrl: signed.signedUrl });
  }
  return response({ file: null });
}

export async function POST(req: Request) {
  const admin = await scannerAdmin(req);
  if (!admin) return response({ error: "Admin authentication required." }, 403);
  const parsed = resultSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return response({ error: "Invalid scanner result." }, 400);
  const { fileId, kind, verdict, sha256 } = parsed.data;
  const table = kind === "order" ? "order_files" : "technical_request_files";
  // First result wins. A later/duplicate result cannot change a clean file to blocked or vice versa.
  const { data, error } = await admin.from(table)
    .update({ scan_status: verdict, sha256 })
    .eq("id", fileId).eq("scan_status", "pending")
    .select("id,scan_status").maybeSingle();
  if (error) {
    console.error("Scanner result registration failed:", kind, error.message);
    return response({ error: "Could not record scan result." }, 500);
  }
  if (!data) return response({ error: "File no longer pending. Refresh scanner queue." }, 409);
  return response({ ok: true, verdict: data.scan_status });
}

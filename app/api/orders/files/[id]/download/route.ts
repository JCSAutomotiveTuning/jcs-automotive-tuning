import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const noStore = { "Cache-Control": "private, no-store" };

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return NextResponse.json({ error: "Sign in to download your file." }, { status: 401, headers: noStore });

  const { id } = await params;
  if (!z.string().uuid().safeParse(id).success) {
    return NextResponse.json({ error: "Invalid file reference." }, { status: 400, headers: noStore });
  }
  const admin = createAdminClient();
  const { data: file, error: fileError } = await admin.from("order_files")
    .select("id,order_id,user_id,kind,scan_status,delivery_status,storage_path,original_filename")
    .eq("id", id).eq("user_id", user.id).maybeSingle();
  if (fileError) return NextResponse.json({ error: "Could not verify file access." }, { status: 503, headers: noStore });
  if (!file || file.kind !== "completed_output") {
    return NextResponse.json({ error: "Finished file not found." }, { status: 404, headers: noStore });
  }
  if (file.scan_status !== "clean" || file.delivery_status !== "approved") {
    return NextResponse.json({ error: "This file has not been approved for delivery." }, { status: 409, headers: noStore });
  }
  const prefix = `${user.id}/${file.order_id}/completed/`;
  if (typeof file.storage_path !== "string" || !file.storage_path.startsWith(prefix) ||
      !file.storage_path.slice(prefix.length) || file.storage_path.slice(prefix.length).includes("/")) {
    return NextResponse.json({ error: "Invalid stored file path." }, { status: 409, headers: noStore });
  }
  const { data: order, error: orderError } = await admin.from("orders")
    .select("id,user_id,payment_status,status").eq("id", file.order_id).eq("user_id", user.id).maybeSingle();
  if (orderError || !order) return NextResponse.json({ error: "Could not verify this order." }, { status: 503, headers: noStore });
  if (order.payment_status !== "paid" || order.status !== "completed") {
    return NextResponse.json({ error: "Finished files are released only after confirmed payment and completion." }, { status: 409, headers: noStore });
  }
  const { data, error } = await admin.storage.from("tuning-files")
    .createSignedUrl(file.storage_path, 60, { download: file.original_filename });
  if (error || !data?.signedUrl) {
    console.error("Customer finished file signing failed:", error?.message);
    return NextResponse.json({ error: "Could not prepare a secure download." }, { status: 503, headers: noStore });
  }
  return NextResponse.json({ url: data.signedUrl }, { headers: noStore });
}

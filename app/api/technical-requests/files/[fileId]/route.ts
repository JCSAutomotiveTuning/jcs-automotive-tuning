import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { technicalAdmin, technicalUser, uuidPattern } from "@/lib/technical-requests";

export const runtime = "nodejs";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ fileId: string }> }
) {
  const { fileId } = await params;
  const user = await technicalUser();

  if (!user) {
    return NextResponse.json({ error: "Sign in required" }, { status: 401 });
  }

  if (!uuidPattern.test(fileId)) {
    return NextResponse.json({ error: "Invalid file" }, { status: 400 });
  }

  const admin = createAdminClient();

  const { data: file, error: fileError } = await admin
    .from("technical_request_files")
    .select("storage_path,request_id,scan_status")
    .eq("id", fileId)
    .maybeSingle();

  if (fileError) {
    return NextResponse.json({ error: "File lookup failed" }, { status: 500 });
  }

  if (!file) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const { data: request, error: requestError } = await admin
    .from("technical_requests")
    .select("user_id,payment_status,status")
    .eq("id", file.request_id)
    .maybeSingle();

  if (requestError) {
    return NextResponse.json({ error: "Ticket lookup failed" }, { status: 500 });
  }

  const isAdmin = await technicalAdmin(user.id);

  if (
    !request ||
    (!isAdmin &&
      (request.user_id !== user.id ||
        request.payment_status !== "paid" ||
        request.status !== "completed"))
  ) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // Customer attachments are not admin deliverables.
  // Customers cannot download them through the delivery endpoint.
  if (
    !isAdmin &&
    file.storage_path.startsWith(`${file.request_id}/customer-`)
  ) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // Fail closed: neither customers nor admins may download unscanned files.
  if (file.scan_status !== "clean") {
    return NextResponse.json(
      { error: "This file has not passed safety validation." },
      { status: 403 }
    );
  }

  const { data, error } = await admin.storage
    .from("technical-deliverables")
    .createSignedUrl(file.storage_path, 60);

  if (error || !data?.signedUrl) {
    return NextResponse.json(
      { error: "Download unavailable" },
      { status: 500 }
    );
  }

  return NextResponse.redirect(data.signedUrl, 302);
}


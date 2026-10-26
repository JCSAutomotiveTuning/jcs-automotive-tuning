import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { technicalUser, uuidPattern } from "@/lib/technical-requests";

export const runtime = "nodejs";

const allowed = new Set([
  "application/pdf",
  "text/plain",
  "text/csv",
  "image/png",
  "image/jpeg",
]);

const extensions: Record<string, string[]> = {
  "application/pdf": ["pdf"],
  "text/plain": ["txt"],
  "text/csv": ["csv"],
  "image/png": ["png"],
  "image/jpeg": ["jpg", "jpeg"],
};

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const user = await technicalUser();

  if (!user)
    return NextResponse.json({ error: "Sign in required" }, { status: 401 });

  if (!uuidPattern.test(id))
    return NextResponse.json({ error: "Invalid ticket" }, { status: 400 });

  const admin = createAdminClient();

  const { data: ticket } = await admin
    .from("technical_requests")
    .select("id,user_id,payment_status,status")
    .eq("id", id)
    .maybeSingle();

  if (!ticket || ticket.user_id !== user.id)
    return NextResponse.json({ error: "Ticket not found" }, { status: 404 });

  if (ticket.payment_status !== "unpaid" || ticket.status !== "awaiting_payment")
    return NextResponse.json(
      { error: "Attachments are only accepted before payment" },
      { status: 409 }
    );

  const { count, error: countError } = await admin
    .from("technical_request_files")
    .select("id", { count: "exact", head: true })
    .eq("request_id", id);

  if (countError)
    return NextResponse.json({ error: "Unable to check attachments" }, { status: 500 });

  if ((count ?? 0) >= 1)
    return NextResponse.json(
      { error: "Only one attachment is allowed before payment" },
      { status: 409 }
    );

  const form = await req.formData().catch(() => null);
  const file = form?.get("file");

  if (!(file instanceof File) || file.size < 1 || file.size > 10 * 1024 * 1024)
    return NextResponse.json(
      { error: "Select a file between 1 byte and 10 MB" },
      { status: 400 }
    );

  const ext = file.name.split(".").pop()?.toLowerCase() || "";

  if (!allowed.has(file.type) || !extensions[file.type]?.includes(ext))
    return NextResponse.json(
      { error: "PDF, TXT, CSV, PNG or JPG files only" },
      { status: 400 }
    );

  const safeName =
    file.name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 100) || "attachment";

  const path = `${id}/customer-${crypto.randomUUID()}-${safeName}`;

  const { error: uploadError } = await admin.storage
    .from("technical-deliverables")
    .upload(path, file, { contentType: file.type, upsert: false });

  if (uploadError)
    return NextResponse.json({ error: "File upload failed" }, { status: 500 });

  const { error: insertError } = await admin
    .from("technical_request_files")
    .insert({
      request_id: id,
      storage_path: path,
      file_name: safeName,
      mime_type: file.type,
      size_bytes: file.size,
      scan_status: "pending",
    });

  if (insertError) {
    await admin.storage.from("technical-deliverables").remove([path]);
    return NextResponse.json(
      { error: "Unable to record attachment" },
      { status: 500 }
    );
  }

  return NextResponse.json({ ok: true, scan_status: "pending" }, { status: 201 });
}

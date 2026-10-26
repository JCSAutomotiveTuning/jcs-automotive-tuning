import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

const MAX_SIZE = 16 * 1024 * 1024;

const allowedExtensions = new Set([
  "bin", "ori", "hex", "frf", "odx",
  "txt", "csv", "log", "zip",
]);

const schema = z.object({
  orderId: z.string().uuid(),
});

export async function POST(req: Request) {
  const supabase = await createClient();

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json(
      { error: "Sign in required." },
      { status: 401 }
    );
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();

  if (profileError || profile?.role !== "admin") {
    return NextResponse.json(
      { error: "Administrator access required." },
      { status: 403 }
    );
  }

  const form = await req.formData().catch(() => null);

  if (!form) {
    return NextResponse.json(
      { error: "Invalid upload request." },
      { status: 400 }
    );
  }

  const parsed = schema.safeParse({
    orderId: form.get("orderId"),
  });

  const file = form.get("file");

  if (!parsed.success || !(file instanceof File)) {
    return NextResponse.json(
      { error: "Order ID and file are required." },
      { status: 400 }
    );
  }

  if (file.size <= 0 || file.size > MAX_SIZE) {
    return NextResponse.json(
      { error: "File must be between 1 byte and 16 MB." },
      { status: 400 }
    );
  }

  if (file.name.length > 180) {
    return NextResponse.json(
      { error: "Filename is too long." },
      { status: 400 }
    );
  }

  const extension = file.name.split(".").pop()?.toLowerCase();

  if (!extension || !allowedExtensions.has(extension)) {
    return NextResponse.json(
      { error: "Unsupported tuning file extension." },
      { status: 400 }
    );
  }

  const admin = createAdminClient();

  const { data: order, error: orderError } = await admin
    .from("orders")
    .select("id,user_id,status,payment_status")
    .eq("id", parsed.data.orderId)
    .maybeSingle();

  if (orderError || !order) {
    return NextResponse.json(
      { error: "Order not found." },
      { status: 404 }
    );
  }

  if (order.payment_status !== "paid") {
    return NextResponse.json(
      { error: "Order payment must be confirmed first." },
      { status: 409 }
    );
  }

  if (!["in_progress", "qa_review"].includes(order.status)) {
    return NextResponse.json(
      { error: "Order must be in progress or QA review." },
      { status: 409 }
    );
  }

  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");

  const path =
    `${order.user_id}/${order.id}/completed/` +
    `${crypto.randomUUID()}-${safeName}`;

  const { error: uploadError } = await admin.storage
    .from("tuning-files")
    .upload(path, file, {
      upsert: false,
      contentType: "application/octet-stream",
    });

  if (uploadError) {
    console.error("Completed file upload failed:", uploadError.message);

    return NextResponse.json(
      { error: "Could not upload completed file." },
      { status: 500 }
    );
  }

  const { data: saved, error: databaseError } = await admin
    .from("order_files")
    .insert({
      order_id: order.id,
      user_id: order.user_id,
      storage_path: path,
      original_filename: file.name,
      size_bytes: file.size,
      kind: "completed_output",
      scan_status: "pending",
    })
    .select("id,original_filename,kind,scan_status")
    .single();

  if (databaseError) {
    console.error("Completed file registration failed:", databaseError.message);

    const { error: cleanupError } = await admin.storage
      .from("tuning-files")
      .remove([path]);

    if (cleanupError) {
      console.error("Orphaned completed file cleanup failed:", cleanupError.message);
    }

    return NextResponse.json(
      { error: "Could not register completed file." },
      { status: 500 }
    );
  }

  return NextResponse.json(
    { ok: true, file: saved },
    { status: 201 }
  );
}

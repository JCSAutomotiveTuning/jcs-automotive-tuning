import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const schema = z.object({
  action: z.enum(["approve", "reject", "reset"]),
});

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
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

  const parsed = schema.safeParse(
    await request.json().catch(() => null)
  );

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid approval request." },
      { status: 400 }
    );
  }

  const { id } = await params;

  if (!z.string().uuid().safeParse(id).success) {
    return NextResponse.json(
      { error: "Invalid file ID." },
      { status: 400 }
    );
  }

  const admin = createAdminClient();

  const { data: file, error: fileError } = await admin
    .from("order_files")
    .select("id,order_id,kind,scan_status,delivery_status")
    .eq("id", id)
    .maybeSingle();

  if (fileError) {
    return NextResponse.json(
      { error: "Could not retrieve file." },
      { status: 500 }
    );
  }

  if (!file || file.kind !== "completed_output") {
    return NextResponse.json(
      { error: "Completed file not found." },
      { status: 404 }
    );
  }

  const { data: order, error: orderError } = await admin
    .from("orders")
    .select("id,payment_status,status")
    .eq("id", file.order_id)
    .maybeSingle();

  if (orderError || !order) {
    return NextResponse.json(
      { error: "Could not verify order." },
      { status: 500 }
    );
  }

  if (parsed.data.action === "approve") {
    if (file.scan_status !== "clean") {
      return NextResponse.json(
        { error: "File must pass safety validation before approval." },
        { status: 409 }
      );
    }

    if (order.payment_status !== "paid") {
      return NextResponse.json(
        { error: "Order payment has not been confirmed." },
        { status: 409 }
      );
    }

    if (!["in_progress", "qa_review", "completed"].includes(order.status)) {
      return NextResponse.json(
        { error: "Order is not at a deliverable stage." },
        { status: 409 }
      );
    }
  }

  const nextStatus =
    parsed.data.action === "approve" ? "approved" : parsed.data.action === "reject" ? "rejected" : "pending";

  const { data: updated, error: updateError } = await admin
    .from("order_files")
    .update({
      delivery_status: nextStatus,
      delivery_approved_at:
        nextStatus === "approved" ? new Date().toISOString() : null,
      delivery_approved_by:
        nextStatus === "approved" ? user.id : null,
    })
    .eq("id", file.id)
    .eq("delivery_status", file.delivery_status)
    .select("id,delivery_status,delivery_approved_at")
    .maybeSingle();

  if (updateError) {
    return NextResponse.json(
      { error: "Could not update delivery approval." },
      { status: 500 }
    );
  }

  if (!updated) {
    return NextResponse.json(
      { error: "File approval changed. Refresh and try again." },
      { status: 409 }
    );
  }

  return NextResponse.json({ file: updated });
}
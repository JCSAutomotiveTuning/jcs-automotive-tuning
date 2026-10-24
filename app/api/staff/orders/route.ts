import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const updateSchema = z.object({
  orderId: z.string().uuid(),
  status: z.enum(["in_progress", "needs_customer_info", "qa_review"]),
});

async function requireTechnician() {
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) return { response: NextResponse.json({ error: "Sign in required." }, { status: 401 }) };
  const { data: profile, error: profileError } = await supabase.from("profiles")
    .select("role").eq("id", user.id).maybeSingle();
  if (profileError || profile?.role !== "technician") {
    return { response: NextResponse.json({ error: "Technician access required." }, { status: 403 }) };
  }
  return { user, db: createAdminClient() };
}

export async function GET() {
  const auth = await requireTechnician();
  if ("response" in auth) return auth.response;
  const { data: assignments, error: assignmentError } = await auth.db.from("order_technicians")
    .select("order_id,updated_at").eq("technician_id", auth.user.id);
  if (assignmentError) return NextResponse.json({ error: "Could not load assigned jobs." }, { status: 500 });
  const ids = (assignments ?? []).map((entry) => entry.order_id);
  if (!ids.length) return NextResponse.json({ orders: [] });

  const [ordersResult, filesResult] = await Promise.all([
    auth.db.from("orders")
      .select("id,service_name,vehicle_make,vehicle_model,engine_code,software_id,status,payment_status,created_at,customer_notes")
      .in("id", ids).order("created_at", { ascending: false }),
    auth.db.from("order_files")
      .select("id,order_id,original_filename,size_bytes,kind,scan_status,created_at")
      .in("order_id", ids).order("created_at", { ascending: false }),
  ]);
  if (ordersResult.error || filesResult.error) {
    return NextResponse.json({ error: "Could not load job details." }, { status: 500 });
  }
  const filesByOrder: Record<string, Array<{
    id: string; original_filename: string; size_bytes: number; kind: string; scan_status: string; created_at: string;
  }>> = {};
  for (const file of filesResult.data ?? []) {
    (filesByOrder[file.order_id] ??= []).push({
      id: file.id,
      original_filename: file.original_filename,
      size_bytes: Number(file.size_bytes),
      kind: file.kind,
      scan_status: file.scan_status,
      created_at: file.created_at,
    });
  }
  return NextResponse.json({ orders: (ordersResult.data ?? []).map((order) => ({
    id: order.id,
    service_name: order.service_name,
    vehicle_make: order.vehicle_make,
    vehicle_model: order.vehicle_model,
    engine_code: order.engine_code,
    software_id: order.software_id,
    status: order.status,
    payment_confirmed: order.payment_status === "paid",
    customer_notes: order.customer_notes,
    created_at: order.created_at,
    files: filesByOrder[order.id] ?? [],
  })) });
}

export async function PATCH(req: Request) {
  const auth = await requireTechnician();
  if ("response" in auth) return auth.response;
  const parsed = updateSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid status update." }, { status: 400 });
  const { orderId, status } = parsed.data;

  // Recheck assignment on every write, rather than trusting the browser's job list.
  const { data: assignment, error: assignmentError } = await auth.db.from("order_technicians")
    .select("order_id").eq("order_id", orderId).eq("technician_id", auth.user.id).maybeSingle();
  if (assignmentError || !assignment) return NextResponse.json({ error: "This job is not assigned to you." }, { status: 403 });

  const { data: existing, error: orderError } = await auth.db.from("orders")
    .select("id,status,payment_status").eq("id", orderId).maybeSingle();
  if (orderError || !existing) return NextResponse.json({ error: "Order not found." }, { status: 404 });
  if (["completed", "cancelled", "failed"].includes(existing.status)) {
    return NextResponse.json({ error: "This order is closed." }, { status: 409 });
  }
  if (status !== "needs_customer_info" && existing.payment_status !== "paid") {
    return NextResponse.json({ error: "Payment must be confirmed before tuning starts." }, { status: 409 });
  }
  if (status === "qa_review" && existing.status !== "in_progress") {
    return NextResponse.json({ error: "QA review requires an in-progress job." }, { status: 409 });
  }
  if (status === "in_progress" && !["paid", "in_progress", "needs_customer_info", "qa_review"].includes(existing.status)) {
    return NextResponse.json({ error: "This order is not ready for tuning." }, { status: 409 });
  }
  if (status === "needs_customer_info" && !["awaiting_review", "paid", "in_progress", "qa_review", "needs_customer_info"].includes(existing.status)) {
    return NextResponse.json({ error: "Cannot request information at this stage." }, { status: 409 });
  }
  if (status === existing.status) return NextResponse.json({ ok: true, status });

  // Optimistic checks prevent overwriting a concurrent admin status/payment change.
  const { data: updated, error: updateError } = await auth.db.from("orders")
    .update({ status }).eq("id", orderId).eq("status", existing.status)
    .eq("payment_status", existing.payment_status).select("id,status").maybeSingle();
  if (updateError || !updated) return NextResponse.json({ error: "Job changed; refresh and retry." }, { status: 409 });
  const { error: auditError } = await auth.db.from("order_audit").insert({
    order_id: orderId, actor_id: auth.user.id, action: "technician_status_updated",
    details: { previous_status: existing.status, status },
  });
  if (auditError) console.error("Technician order audit write failed:", auditError.message);
  return NextResponse.json({ ok: true, status: updated.status });
}

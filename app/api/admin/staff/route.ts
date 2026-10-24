import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const roleSchema = z.object({
  action: z.literal("set_role"),
  userId: z.string().uuid(),
  role: z.enum(["customer", "admin", "technician"]),
});
const assignmentSchema = z.object({
  action: z.literal("assign"),
  orderId: z.string().uuid(),
  technicianId: z.string().uuid().nullable(),
});
const mutationSchema = z.discriminatedUnion("action", [roleSchema, assignmentSchema]);

async function requireAdmin() {
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) return { response: NextResponse.json({ error: "Sign in required." }, { status: 401 }) };
  const { data: profile, error: profileError } = await supabase.from("profiles")
    .select("role").eq("id", user.id).maybeSingle();
  if (profileError || profile?.role !== "admin") {
    return { response: NextResponse.json({ error: "Administrator access required." }, { status: 403 }) };
  }
  return { user, db: createAdminClient() };
}

export async function GET() {
  const auth = await requireAdmin();
  if ("response" in auth) return auth.response;
  const [profilesResult, assignmentsResult, ordersResult] = await Promise.all([
    auth.db.from("profiles").select("id,email,role,created_at").order("created_at", { ascending: false }).limit(500),
    auth.db.from("order_technicians").select("order_id,technician_id,assigned_by,created_at,updated_at"),
    auth.db.from("orders").select("id,service_name,vehicle_make,vehicle_model,status,payment_status,created_at")
      .order("created_at", { ascending: false }).limit(200),
  ]);
  if (profilesResult.error || assignmentsResult.error || ordersResult.error) {
    console.error("Staff list error:", profilesResult.error?.message, assignmentsResult.error?.message, ordersResult.error?.message);
    return NextResponse.json({ error: "Could not load staff or assignments. Confirm the SQL migration is installed." }, { status: 500 });
  }
  return NextResponse.json({
    profiles: profilesResult.data ?? [],
    assignments: assignmentsResult.data ?? [],
    orders: ordersResult.data ?? [],
    currentUserId: auth.user.id,
  });
}

export async function POST(req: Request) {
  const auth = await requireAdmin();
  if ("response" in auth) return auth.response;
  const parsed = mutationSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid staff management request." }, { status: 400 });
  const body = parsed.data;

  if (body.action === "set_role") {
    if (body.userId === auth.user.id) {
      return NextResponse.json({ error: "You cannot change your own role." }, { status: 400 });
    }
    const { data: current, error: lookupError } = await auth.db.from("profiles")
      .select("id,role,email").eq("id", body.userId).maybeSingle();
    if (lookupError || !current) return NextResponse.json({ error: "Registered user not found." }, { status: 404 });
    if (current.role === body.role) return NextResponse.json({ ok: true });

    if (current.role === "admin") {
      const { count, error } = await auth.db.from("profiles")
        .select("id", { count: "exact", head: true }).eq("role", "admin");
      if (error || (count ?? 0) <= 1) {
        return NextResponse.json({ error: "The portal must retain at least one admin." }, { status: 409 });
      }
    }
    if (current.role === "technician" && body.role !== "technician") {
      const { count, error } = await auth.db.from("order_technicians")
        .select("order_id", { count: "exact", head: true }).eq("technician_id", body.userId);
      if (error) return NextResponse.json({ error: "Could not verify technician assignments." }, { status: 500 });
      if ((count ?? 0) > 0) return NextResponse.json({ error: "Unassign this technician's jobs before changing their role." }, { status: 409 });
    }
    const { error } = await auth.db.from("profiles")
      .update({ role: body.role }).eq("id", body.userId).eq("role", current.role);
    if (error) {
      console.error("Staff role update failed:", error.message);
      return NextResponse.json({ error: "Could not update role." }, { status: 500 });
    }
    return NextResponse.json({ ok: true });
  }

  const { data: order, error: orderError } = await auth.db.from("orders")
    .select("id,status").eq("id", body.orderId).maybeSingle();
  if (orderError || !order) return NextResponse.json({ error: "Order not found." }, { status: 404 });
  if (["completed", "cancelled", "failed"].includes(order.status) && body.technicianId !== null) {
    return NextResponse.json({ error: "Closed orders can only be unassigned." }, { status: 409 });
  }
  if (body.technicianId) {
    const { data: technician, error: techError } = await auth.db.from("profiles")
      .select("id,role").eq("id", body.technicianId).maybeSingle();
    if (techError || technician?.role !== "technician") {
      return NextResponse.json({ error: "Select an active technician account." }, { status: 400 });
    }
    const { error } = await auth.db.from("order_technicians").upsert({
      order_id: body.orderId,
      technician_id: technician.id,
      assigned_by: auth.user.id,
      updated_at: new Date().toISOString(),
    }, { onConflict: "order_id" });
    if (error) return NextResponse.json({ error: "Could not assign order." }, { status: 500 });
  } else {
    const { error } = await auth.db.from("order_technicians").delete().eq("order_id", body.orderId);
    if (error) return NextResponse.json({ error: "Could not unassign order." }, { status: 500 });
  }
  const { error: auditError } = await auth.db.from("order_audit").insert({
    order_id: body.orderId,
    actor_id: auth.user.id,
    action: "technician_assignment_changed",
    details: { technician_id: body.technicianId },
  });
  if (auditError) console.error("Staff assignment audit write failed:", auditError.message);
  return NextResponse.json({ ok: true });
}

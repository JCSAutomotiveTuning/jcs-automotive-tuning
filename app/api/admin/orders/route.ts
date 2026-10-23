
import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const allowedStatuses = [
  "awaiting_review",
  "awaiting_payment",
  "paid",
  "in_progress",
  "needs_customer_info",
  "qa_review",
  "completed",
  "cancelled",
  "failed",
] as const;

const updateSchema = z.object({
  orderId: z.string().uuid(),
  status: z.enum(allowedStatuses).optional(),
  adminNotes: z.string().trim().max(3000).nullable().optional(),
}).refine(
  (data) => data.status !== undefined || data.adminNotes !== undefined,
  { message: "Provide a status or admin note to update." }
);

async function requireAdmin() {
  const supabase = createClient();
  const { data: { user }, error } = await supabase.auth.getUser();

  if (error || !user) {
    return { error: NextResponse.json(
      { error: "Please sign in first." },
      { status: 401 }
    ) };
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (profileError || profile?.role !== "admin") {
    return { error: NextResponse.json(
      { error: "Administrator access required." },
      { status: 403 }
    ) };
  }

  return { user };
}

export async function GET() {
  const auth = await requireAdmin();
  if ("error" in auth) return auth.error;

  try {
    const admin = createAdminClient();

    const { data: orders, error } = await admin
      .from("orders")
      .select(
        "id,user_id,service_code,service_name,amount_pence,currency,status,payment_status,vehicle_make,vehicle_model,engine_code,software_id,customer_notes,admin_notes,created_at,updated_at"
      )
      .order("created_at", { ascending: false })
      .limit(200);

    if (error) {
      console.error("Admin orders query failed:", error.message);
      return NextResponse.json(
        { error: "Could not load orders." },
        { status: 500 }
      );
    }

    const userIds = [...new Set((orders ?? []).map((order) => order.user_id))];
    let emailByUserId: Record<string, string> = {};

    if (userIds.length > 0) {
      const { data: profiles, error: profilesError } = await admin
        .from("profiles")
        .select("id,email")
        .in("id", userIds);

      if (profilesError) {
        console.error("Admin customer lookup failed:", profilesError.message);
        return NextResponse.json(
          { error: "Could not load customer details." },
          { status: 500 }
        );
      }

      emailByUserId = Object.fromEntries(
        (profiles ?? []).map((profile) => [profile.id, profile.email])
      );
    }

    return NextResponse.json({
      orders: (orders ?? []).map((order) => ({
        ...order,
        customer_email: emailByUserId[order.user_id] ?? "Unknown customer",
      })),
    });
  } catch (error) {
    console.error("Admin orders API failed:", error);
    return NextResponse.json(
      { error: "Could not load orders." },
      { status: 500 }
    );
  }
}

export async function PATCH(req: Request) {
  const auth = await requireAdmin();
  if ("error" in auth) return auth.error;

  const parsed = updateSchema.safeParse(
    await req.json().catch(() => null)
  );

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid order update." },
      { status: 400 }
    );
  }

  try {
    const admin = createAdminClient();
    const { orderId, status, adminNotes } = parsed.data;

    const { data: existing, error: lookupError } = await admin
      .from("orders")
      .select("id,status,admin_notes")
      .eq("id", orderId)
      .maybeSingle();

    if (lookupError) {
      console.error("Order lookup failed:", lookupError.message);
      return NextResponse.json(
        { error: "Could not find the order." },
        { status: 500 }
      );
    }

    if (!existing) {
      return NextResponse.json(
        { error: "Order not found." },
        { status: 404 }
      );
    }

    const changes: Record<string, string | null> = {};
    if (status !== undefined) changes.status = status;
    if (adminNotes !== undefined) changes.admin_notes = adminNotes;

    const { data: updated, error: updateError } = await admin
      .from("orders")
      .update(changes)
      .eq("id", orderId)
      .select("id,status,admin_notes,updated_at")
      .single();

    if (updateError) {
      console.error("Order update failed:", updateError.message);
      return NextResponse.json(
        { error: "Could not update the order." },
        { status: 500 }
      );
    }

    const { error: auditError } = await admin
      .from("order_audit")
      .insert({
        order_id: orderId,
        actor_id: auth.user.id,
        action: "admin_order_updated",
        details: {
          previous_status: existing.status,
          new_status: updated.status,
          previous_admin_notes: existing.admin_notes,
          new_admin_notes: updated.admin_notes,
        },
      });

    if (auditError) {
      console.error("Order audit insert failed:", auditError.message);
      return NextResponse.json(
        {
          error: "Order updated, but audit logging failed. Check the audit table before retrying.",
          order: updated,
        },
        { status: 500 }
      );
    }

    return NextResponse.json({ order: updated });
  } catch (error) {
    console.error("Admin order update failed:", error);
    return NextResponse.json(
      { error: "Could not update the order." },
      { status: 500 }
    );
  }
}

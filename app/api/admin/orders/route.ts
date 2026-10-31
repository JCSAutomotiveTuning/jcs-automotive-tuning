
import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const allowedStatuses = [
  "awaiting_review",
  "awaiting_payment",
  "in_progress",
  "needs_customer_info",
  "qa_review",
  "completed",
  "cancelled",
  "failed",
] as const;

const quoteableServices = [
  "custom_ecu",
  "custom_tcu",
  "ecu_tcu_package",
  "addons_only",
];

const updateSchema = z
  .object({
    orderId: z.string().uuid(),
    action: z.enum(["update", "save_quote", "request_payment"]).optional(),
    status: z.enum(allowedStatuses).optional(),
    adminNotes: z.string().trim().max(3000).nullable().optional(),
    quoteAmountPence: z.number().int().min(1).max(100000000).optional(),
  })
  .refine(
    (data) => {
      const action = data.action ?? "update";

    if (action === "save_quote") {
        return data.quoteAmountPence !== undefined;
      }

      if (action === "request_payment") {
        return true;
      }

      return data.status !== undefined || data.adminNotes !== undefined;
    },
    { message: "Provide the fields required for this action." }
  );

async function requireAdmin() {
  const supabase = await createClient();

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    return {
      error: NextResponse.json(
        { error: "Please sign in first." },
        { status: 401 }
      ),
    };
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (profileError || profile?.role !== "admin") {
    return {
      error: NextResponse.json(
        { error: "Administrator access required." },
        { status: 403 }
      ),
    };
  }

  return { user };
}

export async function GET() {
  const auth = await requireAdmin();

  if ("error" in auth) {
    return auth.error;
  }

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

    const userIds = [
      ...new Set((orders ?? []).map((order) => order.user_id)),
    ];

    let emailByUserId: Record<string, string> = {};

    if (userIds.length > 0) {
      const { data: profiles, error: profilesError } = await admin
        .from("profiles")
        .select("id,email")
        .in("id", userIds);

      if (profilesError) {
        console.error(
          "Admin customer lookup failed:",
          profilesError.message
        );

        return NextResponse.json(
          { error: "Could not load customer details." },
          { status: 500 }
        );
      }

      emailByUserId = Object.fromEntries(
        (profiles ?? []).map((profile) => [
          profile.id,
          profile.email ?? "Unknown customer",
        ])
      );
    }

    return NextResponse.json({
      orders: (orders ?? []).map((order) => ({
        ...order,
        customer_email:
          emailByUserId[order.user_id] ?? "Unknown customer",
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

  if ("error" in auth) {
    return auth.error;
  }

  const body = await req.json().catch(() => null);
  const parsed = updateSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid order update." },
      { status: 400 }
    );
  }

  try {
    const admin = createAdminClient();

    const {
      orderId,
      action = "update",
      status,
      adminNotes,
      quoteAmountPence,
    } = parsed.data;

    const { data: existing, error: lookupError } = await admin
      .from("orders")
      .select(
        "id,service_code,amount_pence,deposit_pence,currency,status,payment_status,admin_notes,customer_notes"
      )
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

    if (existing.currency !== "GBP") {
      return NextResponse.json(
        { error: "Only GBP orders are supported." },
        { status: 400 }
      );
    }

    // Quote-priced jobs must have an explicitly saved, audited final price
    // before an admin can request Stripe payment (including via status update).
    if ((action === "request_payment" || (action === "update" && status === "awaiting_payment"))
        && quoteableServices.includes(existing.service_code)) {
      const { count, error: quoteError } = await admin.from("order_audit")
        .select("id", { count: "exact", head: true })
        .eq("order_id", orderId)
        .eq("action", "admin_order_updated")
        .contains("details", { action_type: "quote_saved" });
      if (quoteError) {
        console.error("Quote confirmation lookup failed:", quoteError.message);
        return NextResponse.json({ error: "Could not verify the agreed final quote." }, { status: 503 });
      }
      if (!count) {
        return NextResponse.json({ error: "Save and confirm a final quote before requesting payment for this service." }, { status: 409 });
      }
    }

    // Fail closed before charging for tuning work that cannot be safely processed.
    if (action === "request_payment" || (action === "update" && status === "awaiting_payment")) {
      const { data: inputFiles, error: fileCheckError } = await admin.from("order_files")
        .select("scan_status,original_filename").eq("order_id", orderId).eq("kind", "customer_original").limit(500);
      if (fileCheckError || !inputFiles) {
        return NextResponse.json({ error: "Could not verify the uploaded files before payment." }, { status: 503 });
      }
      const uploadRequired = new Set([
        "ecu_stage1", "dsg_tcu", "log_review", "datalog_analysis", "custom_ecu", "custom_tcu", "ecu_tcu_package",
      ]);
      if (uploadRequired.has(existing.service_code) && inputFiles.length === 0) {
        return NextResponse.json({ error: "This service requires the customer's original file or datalog before payment." }, { status: 409 });
      }
      const needsDatalog = existing.service_code === "datalog_analysis" ||
        (existing.customer_notes ?? "").includes("[diagnostics:datalog_analysis]");
      if (needsDatalog && !inputFiles.some(file => /\.(csv|log|txt)$/i.test(file.original_filename ?? ""))) {
        return NextResponse.json({ error: "The customer must attach a CSV, LOG or TXT datalog before payment." }, { status: 409 });
      }
      if (inputFiles.some(file => file.scan_status !== "clean")) {
        return NextResponse.json({ error: "Wait for antivirus clearance of uploaded files before requesting payment." }, { status: 409 });
      }
    }

      if (action === "save_quote" && existing.deposit_pence === 2000 &&
      quoteAmountPence !== undefined && quoteAmountPence > 2000 && quoteAmountPence < 2030) {
      return NextResponse.json({ error: "Quoted total must be £20.00 or at least £20.30, because Stripe cannot collect a remaining balance below 30p." }, { status: 409 });
    }

    if (action === "save_quote") {
      if (!quoteableServices.includes(existing.service_code) && existing.amount_pence !== 0) {
        return NextResponse.json(
          {
            error:
              "Quotes can only be set for quoted services or zero-priced requests.",
          },
          { status: 400 }
        );
      }

      if (
        existing.status !== "awaiting_review" ||
        existing.payment_status !== "unpaid"
      ) {
        return NextResponse.json(
          {
            error:
              "Quotes can only be changed while an unpaid order is awaiting review.",
          },
          { status: 409 }
        );
      }

      const { data: updated, error: updateError } = await admin
        .from("orders")
        .update({ amount_pence: quoteAmountPence })
        .eq("id", orderId)
        .eq("status", "awaiting_review")
        .eq("payment_status", "unpaid")
        .select(
          "id,amount_pence,status,payment_status,admin_notes,updated_at"
        )
        .maybeSingle();

      if (updateError || !updated) {
        if (updateError) {
          console.error("Quote save failed:", updateError.message);
        }

        return NextResponse.json(
          {
            error:
              "Could not save the quote. The order may have changed; refresh and try again.",
          },
          { status: updateError ? 500 : 409 }
        );
      }

      const { error: auditError } = await admin
        .from("order_audit")
        .insert({
          order_id: orderId,
          actor_id: auth.user.id,
          action: "admin_order_updated",
          details: {
            action_type: "quote_saved",
            previous_amount_pence: existing.amount_pence,
            new_amount_pence: updated.amount_pence,
          },
        });

      if (auditError) {
        console.error("Quote audit insert failed:", auditError.message);

        return NextResponse.json(
          {
            error:
              "The quote was saved, but audit logging failed. Check the server logs.",
            order: updated,
          },
          { status: 500 }
        );
      }

      return NextResponse.json({ order: updated });
    }

    if (action === "request_payment" && existing.deposit_pence === 2000 &&
      existing.amount_pence > 0 && existing.amount_pence <= 2000) {
      const { data: settled, error: settleError } = await admin.rpc("settle_fully_deposit_paid_order", {
        p_order_id: orderId, p_user_id: auth.user.id,
      });
      if (settleError || !["settled", "already_settled"].includes(settled)) {
        console.error("Deposit-only settlement failed:", settleError?.message, settled);
        return NextResponse.json({ error: "Could not reconcile the deposit-funded order and any unused wallet credit." }, { status: 409 });
      }
      const { data: fullyPaid, error: fullError } = await admin.from("orders")
        .select("id,amount_pence,status,payment_status,admin_notes,updated_at").eq("id",orderId).single();
      if (fullError || !fullyPaid) return NextResponse.json({ error: "Settlement succeeded but order refresh failed." }, { status: 500 });
      return NextResponse.json({ order: fullyPaid });
    }
    if (action === "request_payment") {
      if (existing.status !== "awaiting_review") {
        return NextResponse.json(
          {
            error:
              "Only orders awaiting review can be sent for payment.",
          },
          { status: 409 }
        );
      }

      if (existing.payment_status !== "unpaid") {
        return NextResponse.json(
          { error: "This order is not marked as unpaid." },
          { status: 409 }
        );
      }

      if (existing.amount_pence <= 0) {
        return NextResponse.json(
          {
            error:
              "Save a quote greater than £0 before requesting payment.",
          },
          { status: 400 }
        );
      }

      const { data: updated, error: updateError } = await admin
        .from("orders")
        .update({ status: "awaiting_payment" })
        .eq("id", orderId)
        .eq("status", "awaiting_review")
        .eq("payment_status", "unpaid")
        .gt("amount_pence", 0)
        .select(
          "id,amount_pence,status,payment_status,admin_notes,updated_at"
        )
        .maybeSingle();

      if (updateError || !updated) {
        if (updateError) {
          console.error(
            "Request payment failed:",
            updateError.message
          );
        }

        return NextResponse.json(
          {
            error:
              "Could not request payment. The order may have changed; refresh and try again.",
          },
          { status: updateError ? 500 : 409 }
        );
      }

      const { error: auditError } = await admin
        .from("order_audit")
        .insert({
          order_id: orderId,
          actor_id: auth.user.id,
          action: "admin_order_updated",
          details: {
            action_type: "payment_requested",
            amount_pence: updated.amount_pence,
            previous_status: existing.status,
            new_status: updated.status,
          },
        });

      if (auditError) {
        console.error(
          "Payment request audit failed:",
          auditError.message
        );

        return NextResponse.json(
          {
            error:
              "Payment was requested, but audit logging failed. Check the server logs.",
            order: updated,
          },
          { status: 500 }
        );
      }

      return NextResponse.json({ order: updated });
    }

    if (status === "awaiting_payment") {
      if (existing.amount_pence <= 0) {
        return NextResponse.json(
          {
            error:
              "An order must have a price greater than £0 before payment can be requested.",
          },
          { status: 400 }
        );
      }

      if (existing.payment_status !== "unpaid") {
        return NextResponse.json(
          {
            error:
              "Only unpaid orders can be moved to awaiting payment.",
          },
          { status: 409 }
        );
      }
    }

    // Require confirmed payment before progressing paid work.
    const statusesRequiringPayment = new Set<string>([
      "in_progress",
      "qa_review",
      "completed",
    ]);

    if (
      status !== undefined &&
      statusesRequiringPayment.has(status) &&
      existing.payment_status !== "paid"
    ) {
      return NextResponse.json(
        {
          error:
            "Payment must be confirmed before an order can enter the workshop, quality check or completed state.",
        },
        { status: 409 }
      );
    }
    const changes: Record<string, string | null> = {};

    if (status !== undefined) {
      changes.status = status;
    }

    if (adminNotes !== undefined) {
      changes.admin_notes = adminNotes;
    }

    const { data: updated, error: updateError } = await admin
      .from("orders")
      .update(changes)
      .eq("id", orderId)
      .eq("status", existing.status)
      .eq("payment_status", existing.payment_status)
      .select(
        "id,amount_pence,status,payment_status,admin_notes,updated_at"
      )
      .maybeSingle();

    if (updateError || !updated) {
      if (updateError) {
        console.error("Order update failed:", updateError.message);
      }

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
          action_type: "order_updated",
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
          error:
            "The order was updated, but audit logging failed. Check the server logs.",
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


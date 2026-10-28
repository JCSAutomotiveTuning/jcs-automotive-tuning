import { NextResponse } from "next/server";
import Stripe from "stripe";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const schema = z.object({ orderId: z.string().uuid(), confirmation: z.literal("REFUND") });

export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle();
  if (profile?.role !== "admin") return NextResponse.json({ error: "Admin access required." }, { status: 403 });

  const origin = req.headers.get("origin");
  const site = process.env.NEXT_PUBLIC_SITE_URL;
  if (origin && (!site || new URL(origin).origin !== new URL(site).origin)) {
    return NextResponse.json({ error: "Invalid request origin." }, { status: 403 });
  }
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Confirm the full refund." }, { status: 400 });

  const secret = process.env.STRIPE_SECRET_KEY;
  if (!secret || !/^sk_(live|test)_/.test(secret) ||
      (process.env.VERCEL_ENV === "production" && !secret.startsWith("sk_live_"))) {
    return NextResponse.json({ error: "Stripe is not configured for this environment." }, { status: 503 });
  }

  const admin = createAdminClient();
  const { data: order, error: orderError } = await admin.from("orders")
    .select("id,user_id,amount_pence,currency,payment_status,checkout_session_id")
    .eq("id", parsed.data.orderId).maybeSingle();
  if (orderError) return NextResponse.json({ error: "Order lookup failed." }, { status: 500 });
  if (!order) return NextResponse.json({ error: "Order not found." }, { status: 404 });
  if (order.payment_status !== "paid" || !order.checkout_session_id ||
      order.currency !== "GBP" || !Number.isSafeInteger(order.amount_pence) || order.amount_pence <= 0) {
    return NextResponse.json({ error: "This order has no eligible confirmed Stripe payment." }, { status: 409 });
  }

  try {
    const stripe = new Stripe(secret);
    const session = await stripe.checkout.sessions.retrieve(order.checkout_session_id);
    if (session.payment_status !== "paid" || session.mode !== "payment" ||
        session.metadata?.type !== "order_payment" ||
        session.metadata.order_id !== order.id || session.metadata.user_id !== order.user_id ||
        session.client_reference_id !== order.user_id || session.currency !== "gbp" ||
        session.amount_total !== order.amount_pence || !session.payment_intent) {
      return NextResponse.json({ error: "Stripe payment does not match this order." }, { status: 409 });
    }
    const intentId = typeof session.payment_intent === "string" ? session.payment_intent : session.payment_intent.id;
    // A full refund must never ignore prior partial or pending refunds.
    // Stripe enforces the total too, but fail closed before attempting a duplicate charge reversal.
    const prior = await stripe.refunds.list({ payment_intent: intentId, limit: 100 });
    if (prior.has_more || prior.data.length > 0) {
      return NextResponse.json({
        error: "A refund already exists for this payment. Review Stripe refund history before any further action.",
      }, { status: 409 });
    }
    const refund = await stripe.refunds.create({
      payment_intent: intentId,
      amount: order.amount_pence,
      reason: "requested_by_customer",
      metadata: { order_id: order.id, initiated_by_admin: user.id },
    }, { idempotencyKey: `jcs-full-refund-v1-${order.id}-${intentId}` });
    if (refund.status !== "succeeded") {
      return NextResponse.json({ error: "Refund is pending. Check Stripe before retrying.", refundStatus: refund.status }, { status: 202 });
    }
    const { data: updated, error: updateError } = await admin.from("orders")
      .update({ payment_status: "refunded" }).eq("id", order.id).eq("payment_status", "paid")
      .eq("checkout_session_id", session.id).select("id,payment_status").maybeSingle();
    if (updateError || !updated) {
      console.error("Refund succeeded but order status reconciliation is required:", order.id, refund.id, updateError?.message);
      return NextResponse.json({ error: "Stripe refund succeeded; database reconciliation required. Do not refund again." }, { status: 500 });
    }
    const { error: auditError } = await admin.from("order_audit").insert({
      order_id: order.id, actor_id: user.id, action: "admin_order_updated",
      details: { action_type: "stripe_full_refund", refund_id: refund.id, amount_pence: refund.amount, previous_payment_status: "paid", new_payment_status: "refunded" },
    });
    if (auditError) {
      console.error("Refund audit logging failed:", order.id, refund.id, auditError.message);
      return NextResponse.json({ error: "Refund completed but audit logging needs reconciliation. Do not refund again." }, { status: 500 });
    }
    return NextResponse.json({ ok: true, order: updated, refundId: refund.id });
  } catch (error) {
    console.error("Admin refund operation failed:", error instanceof Error ? error.message : "unknown");
    return NextResponse.json({ error: "Refund could not be completed. Check Stripe before retrying." }, { status: 502 });
  }
}

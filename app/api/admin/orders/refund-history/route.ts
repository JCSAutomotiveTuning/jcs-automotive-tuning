import { NextResponse } from "next/server";
import Stripe from "stripe";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  const { data: profile, error: profileError } = await supabase.from("profiles")
    .select("role").eq("id", user.id).maybeSingle();
  if (profileError || profile?.role !== "admin") {
    return NextResponse.json({ error: "Admin access required." }, { status: 403 });
  }

  const id = new URL(req.url).searchParams.get("orderId") ?? "";
  if (!/^[0-9a-f]{8}-[0-9a-f-]{27,}$/i.test(id)) {
    return NextResponse.json({ error: "Invalid order reference." }, { status: 400 });
  }
  const admin = createAdminClient();
  const { data: order, error: orderError } = await admin.from("orders")
    .select("id,user_id,amount_pence,currency,checkout_session_id")
    .eq("id", id).maybeSingle();
  if (orderError) return NextResponse.json({ error: "Order lookup failed." }, { status: 500 });
  if (!order) return NextResponse.json({ error: "Order not found." }, { status: 404 });
  if (!order.checkout_session_id) {
    return NextResponse.json({ refunds: [], refundablePence: 0, verifiedPayment: false });
  }

  const key = process.env.STRIPE_SECRET_KEY;
  if (!key || !/^(sk|rk)_(live|test)_/.test(key) ||
      (process.env.VERCEL_ENV === "production" && !/^(sk|rk)_live_/.test(key))) {
    return NextResponse.json({ error: "Stripe configuration unavailable." }, { status: 503 });
  }
  try {
    const stripe = new Stripe(key);
    const session = await stripe.checkout.sessions.retrieve(order.checkout_session_id);
    if (session.mode !== "payment" || session.payment_status !== "paid" ||
        session.metadata?.type !== "order_payment" ||
        session.metadata.order_id !== order.id ||
        session.metadata.user_id !== order.user_id ||
        session.client_reference_id !== order.user_id ||
        session.currency !== "gbp" || session.amount_total !== order.amount_pence ||
        !session.payment_intent) {
      return NextResponse.json({ refunds: [], refundablePence: 0, verifiedPayment: false });
    }
    const intentId = typeof session.payment_intent === "string" ? session.payment_intent : session.payment_intent.id;
    const paymentIntent = await stripe.paymentIntents.retrieve(intentId);
    if (paymentIntent.currency !== "gbp" || paymentIntent.amount_received !== order.amount_pence) {
      return NextResponse.json({ error: "Payment amount mismatch. Reconciliation required." }, { status: 409 });
    }
    const all = await stripe.refunds.list({ payment_intent: intentId, limit: 100 });
    if (all.has_more) return NextResponse.json({ error: "Refund history exceeds one page. Reconciliation required." }, { status: 409 });
    const refunds = all.data.map((r) => ({
      id: r.id, amountPence: r.amount, status: r.status ?? "unknown",
      created: r.created, reason: r.reason ?? null,
    }));
    // Pending refunds also reserve part of the original amount.
    const reserved = refunds.filter((r) => r.status !== "failed" && r.status !== "canceled")
      .reduce((total, r) => total + r.amountPence, 0);
    return NextResponse.json({
      verifiedPayment: true,
      originalPence: order.amount_pence,
      refundablePence: Math.max(0, order.amount_pence - reserved),
      refunds,
    }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("Admin refund history lookup failed:", error instanceof Error ? error.message : "unknown");
    return NextResponse.json({ error: "Could not verify Stripe refund history." }, { status: 502 });
  }
}

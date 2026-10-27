import { NextResponse } from "next/server";
import Stripe from "stripe";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function POST(req: Request) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: "Please sign in to pay for this order." }, { status: 401 });
    }

    const body = await req.json().catch(() => null);
    const orderId = body && typeof body.orderId === "string" ? body.orderId : "";
    if (!uuidPattern.test(orderId)) {
      return NextResponse.json({ error: "A valid order ID is required." }, { status: 400 });
    }

    const secretKey = process.env.STRIPE_SECRET_KEY;
    if (!secretKey || !/^sk_(test|live)_/.test(secretKey)) {
      console.error("Stripe server secret key is missing or has an invalid prefix.");
      return NextResponse.json({ error: "Payments are not configured correctly." }, { status: 503 });
    }

    if (process.env.VERCEL_ENV === "production" && !secretKey.startsWith("sk_live_")) {
      console.error("Production checkout requires a live Stripe secret key.");
      return NextResponse.json({ error: "Live payments are not configured correctly." }, { status: 503 });
    }
    if (process.env.VERCEL_ENV === "preview" && !secretKey.startsWith("sk_test_")) {
      console.error("Preview checkout requires a test-mode Stripe secret key.");
      return NextResponse.json({ error: "Test payments are not configured correctly." }, { status: 503 });
    }

    const admin = createAdminClient();
    const { data: order, error: orderError } = await admin.from("orders")
      .select("id,user_id,service_code,service_name,amount_pence,currency,status,payment_status,checkout_session_id,checkout_attempt_id")
      .eq("id", orderId).eq("user_id", user.id).maybeSingle();
    if (orderError) {
      console.error("Order checkout lookup failed:", orderError.message);
      return NextResponse.json({ error: "Could not load this order." }, { status: 500 });
    }
    if (!order) return NextResponse.json({ error: "Order not found." }, { status: 404 });
    if (order.status !== "awaiting_payment" || order.payment_status !== "unpaid") {
      return NextResponse.json({ error: "This order is not currently available for payment." }, { status: 409 });
    }
    if (order.currency !== "GBP" || !Number.isSafeInteger(order.amount_pence) || order.amount_pence <= 0) {
      return NextResponse.json({ error: "This order does not have a valid payment amount." }, { status: 400 });
    }

    // Do not take payment for a tuning file which cannot yet be safely inspected.
    // A customer cannot add files once an order leaves awaiting_review.
    const { data: inputFiles, error: inputError } = await admin.from("order_files")
      .select("id,scan_status").eq("order_id", order.id)
      .eq("kind", "customer_original").limit(500);
    if (inputError || !inputFiles) {
      console.error("Order file safety preflight failed:", inputError?.message);
      return NextResponse.json({ error: "Cannot verify the safety of this order's files." }, { status: 503 });
    }
    const uploadRequired = new Set([
      "ecu_stage1", "dsg_tcu", "log_review", "datalog_analysis", "custom_ecu", "custom_tcu", "ecu_tcu_package",
    ]);
    if (uploadRequired.has(order.service_code) && inputFiles.length === 0) {
      return NextResponse.json({ error: "Please upload the required original file or datalog before payment is requested." }, { status: 409 });
    }
    if (inputFiles.some(file => file.scan_status !== "clean")) {
      return NextResponse.json({ error: "The uploaded file is still awaiting antivirus clearance. No payment was taken." }, { status: 409 });
    }

    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/+$/, "");
    if (!siteUrl || !/^https?:\/\//.test(siteUrl)) {
      return NextResponse.json({ error: "Payment return URL is not configured." }, { status: 503 });
    }
    const stripe = new Stripe(secretKey);

    // A legacy session must be reconciled before adopting the attempt-based flow.
    if (order.checkout_session_id && !order.checkout_attempt_id) {
      const existing = await stripe.checkout.sessions.retrieve(order.checkout_session_id);
      if (existing.status === "open" && existing.payment_status === "unpaid" && existing.url &&
          existing.metadata?.type === "order_payment" && existing.metadata.order_id === order.id &&
          existing.metadata.user_id === user.id && existing.client_reference_id === user.id &&
          existing.currency === "gbp" && existing.amount_total === order.amount_pence) {
        return NextResponse.json({ url: existing.url });
      }
      return NextResponse.json({ error: "Legacy checkout needs manual reconciliation." }, { status: 409 });
    }

    const { data: reserved, error: reserveError } = await admin.rpc("reserve_order_checkout", {
      p_order_id: order.id, p_user_id: user.id,
    });
    if (reserveError) {
      console.error("Order checkout reservation failed:", reserveError.message);
      return NextResponse.json({ error: "Could not reserve checkout. Reconciliation may be required." }, { status: 409 });
    }
    const attempt = Array.isArray(reserved) ? reserved[0] : reserved;
    if (!attempt || !uuidPattern.test(attempt.attempt_id)) {
      return NextResponse.json({ error: "Invalid checkout reservation." }, { status: 500 });
    }

    if (attempt.session_id) {
      const existing = await stripe.checkout.sessions.retrieve(attempt.session_id);
      const matches = existing.metadata?.type === "order_payment" &&
        existing.metadata.order_id === order.id && existing.metadata.user_id === user.id &&
        existing.metadata.checkout_attempt_id === attempt.attempt_id &&
        existing.client_reference_id === user.id && existing.currency === "gbp" &&
        existing.amount_total === order.amount_pence;
      if (!matches) {
        return NextResponse.json({ error: "Checkout reference mismatch. Manual reconciliation required." }, { status: 409 });
      }
      if (existing.status === "open" && existing.payment_status === "unpaid" && existing.url) {
        return NextResponse.json({ url: existing.url });
      }
      if (existing.status === "expired" && existing.payment_status === "unpaid") {
        const { data: cleared, error: resetError } = await admin.rpc("reset_expired_order_checkout", {
          p_order_id: order.id, p_user_id: user.id, p_attempt_id: attempt.attempt_id,
          p_session_id: existing.id,
        });
        if (resetError || cleared !== true) {
          console.error("Expired checkout reset failed:", resetError?.message);
          return NextResponse.json({ error: "Expired checkout needs reconciliation." }, { status: 409 });
        }
        return NextResponse.json({ error: "Expired checkout cleared. Please retry payment." }, { status: 409 });
      }
      return NextResponse.json({ error: "Checkout payment status needs reconciliation." }, { status: 409 });
    }

    // Attempt-specific idempotency allows retry after a verified expired attempt.
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      client_reference_id: user.id,
      customer_email: user.email,
      metadata: {
        type: "order_payment", order_id: order.id, user_id: user.id,
        checkout_attempt_id: attempt.attempt_id,
      },
      line_items: [{
        quantity: 1,
        price_data: {
          currency: "gbp", unit_amount: order.amount_pence,
          product_data: {
            name: order.service_name,
            description: `JCS Automotive Tuning order ${order.id.slice(0, 8)}`,
          },
        },
      }],
      success_url: `${siteUrl}/dashboard?payment=success`,
      cancel_url: `${siteUrl}/dashboard?payment=cancelled`,
    }, { idempotencyKey: `jcs-order-${order.id}-${attempt.attempt_id}` });

    if (!session.url || !session.expires_at) {
      return NextResponse.json({ error: "Stripe did not return a complete checkout session." }, { status: 502 });
    }

    const { data: recorded, error: recordError } = await admin.rpc("record_order_checkout", {
      p_order_id: order.id, p_user_id: user.id, p_attempt_id: attempt.attempt_id,
      p_session_id: session.id, p_expires_at: new Date(session.expires_at * 1000).toISOString(),
    });
    if (recordError || recorded !== true) {
      console.error("Order checkout recording failed:", recordError?.message, recorded);
      // Preserve the Stripe session for safe reconciliation.
      return NextResponse.json({ error: "Checkout requires reconciliation. No payment URL issued." }, { status: 409 });
    }

    // A webhook may have confirmed payment before record_order_checkout returned.
    const { data: current, error: currentError } = await admin.from("orders")
      .select("payment_status,checkout_attempt_id,checkout_session_id")
      .eq("id", order.id).eq("user_id", user.id).maybeSingle();
    if (currentError || !current || current.payment_status !== "unpaid" ||
        current.checkout_attempt_id !== attempt.attempt_id || current.checkout_session_id !== session.id) {
      return NextResponse.json({ error: "Checkout status changed. Refresh your order." }, { status: 409 });
    }
    return NextResponse.json({ url: session.url });
  } catch (error) {
    if (
      error instanceof Stripe.errors.StripeError &&
      (error.statusCode === 409 ||
        error.code === "idempotency_key_in_use")
    ) {
      return NextResponse.json(
        {
          error: "Checkout is already being created. Please retry shortly.",
          retry: true,
        },
        { status: 409 }
      );
    }
    console.error("Order checkout creation failed:", error);
    return NextResponse.json({ error: "Could not start checkout. Please try again." }, { status: 500 });
  }
}

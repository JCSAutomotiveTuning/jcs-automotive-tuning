
import { NextResponse } from "next/server";
import Stripe from "stripe";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const secretKey = process.env.STRIPE_SECRET_KEY;
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!secretKey || !webhookSecret) {
    return NextResponse.json(
      { error: "Webhook is not configured." },
      { status: 500 }
    );
  }

  // Never mix Stripe's test and live environments in hosted deployments.
  if ((!/^sk_(test|live)_/.test(secretKey)) || !webhookSecret.startsWith("whsec_") ||
      (process.env.VERCEL_ENV === "production" && !secretKey.startsWith("sk_live_")) ||
      (process.env.VERCEL_ENV === "preview" && !secretKey.startsWith("sk_test_"))) {
    console.error("Stripe webhook configuration does not match this environment.");
    return NextResponse.json({ error: "Webhook is not configured for this environment." }, { status: 503 });
  }

  const stripe = new Stripe(secretKey);
  const signature = req.headers.get("stripe-signature");

  if (!signature) {
    return NextResponse.json(
      { error: "Missing signature." },
      { status: 400 }
    );
  }

  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(
      await req.text(),
      signature,
      webhookSecret
    );
  } catch {
    return NextResponse.json(
      { error: "Invalid webhook signature." },
      { status: 400 }
    );
  }

  if ((process.env.VERCEL_ENV === "production" && event.livemode !== true) ||
      (process.env.VERCEL_ENV === "preview" && event.livemode !== false)) {
    console.error("Stripe webhook event mode does not match deployment.");
    return NextResponse.json({ error: "Payment mode mismatch." }, { status: 400 });
  }

  const handledCheckoutEvents = new Set<string>([
    "checkout.session.completed",
    "checkout.session.async_payment_succeeded",
    "checkout.session.async_payment_failed",
  ]);

  if (!handledCheckoutEvents.has(event.type)) {
    return NextResponse.json({ received: true });
  }

  const session = event.data.object as Stripe.Checkout.Session;

  if (event.type === "checkout.session.async_payment_failed") {
    console.warn("Stripe asynchronous checkout payment failed:", session.id);
    return NextResponse.json({ received: true });
  }

  if (
    session.mode !== "payment" ||
    session.payment_status !== "paid"
  ) {
    return NextResponse.json({ received: true });
  }

  const admin = createAdminClient();

  // VAG technical information requests.
  if (session.metadata?.type === "technical_request") {
    const requestId = session.metadata.request_id;
    const userId = session.metadata.user_id;
    const attemptId = session.metadata.checkout_attempt_id;

    const uuidPattern =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

    if (
      !requestId ||
      !uuidPattern.test(requestId) ||
      !userId ||
      !uuidPattern.test(userId) ||
      !attemptId ||
      !uuidPattern.test(attemptId) ||
      session.client_reference_id !== userId ||
      session.mode !== "payment" ||
      session.payment_status !== "paid" ||
      session.currency !== "gbp" ||
      session.amount_total !== 1500
    ) {
      console.error("Invalid technical payment reference:", session.id);

      return NextResponse.json(
        { error: "Invalid technical payment reference" },
        { status: 400 }
      );
    }

    const { data: result, error: confirmationError } = await admin.rpc(
      "confirm_technical_payment",
      {
        p_request_id: requestId,
        p_user_id: userId,
        p_attempt_id: attemptId,
        p_session_id: session.id,
        p_amount_pence: session.amount_total,
        p_currency: "GBP",
      }
    );

    if (confirmationError) {
      console.error(
        "Technical payment confirmation failed:",
        confirmationError.message
      );

      return NextResponse.json(
        { error: "Technical payment confirmation failed" },
        { status: 500 }
      );
    }

    if (result === "confirmed" || result === "already_confirmed") {
      return NextResponse.json({ received: true });
    }

    console.error(
      "Technical payment requires reconciliation:",
      requestId,
      session.id,
      result
    );

    return NextResponse.json(
      { error: "Technical payment requires reconciliation" },
      { status: 409 }
    );
  }
  // Customer order payments: legacy and reserved attempts are confirmed atomically.
  if (session.metadata?.type === "order_payment") {
    const orderId = session.metadata.order_id;
    const userId = session.metadata.user_id;
    const attemptId = session.metadata.checkout_attempt_id;
    const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!orderId || !uuid.test(orderId) || !userId || !uuid.test(userId) ||
        session.client_reference_id !== userId || session.currency !== "gbp" ||
        !Number.isSafeInteger(session.amount_total) || (session.amount_total ?? 0) <= 0 ||
        (attemptId !== undefined && !uuid.test(attemptId))) {
      return NextResponse.json({ error: "Invalid order payment reference." }, { status: 400 });
    }

    // Never let an old-format webhook bypass a newly reserved checkout attempt.
    if (!attemptId) {
      const { data: legacyOrder, error: lookupError } = await admin.from("orders")
        .select("checkout_attempt_id").eq("id", orderId).eq("user_id", userId).maybeSingle();
      if (lookupError || !legacyOrder || legacyOrder.checkout_attempt_id) {
        console.error("Legacy order payment needs reconciliation:", orderId);
        return NextResponse.json({ error: "Order payment needs reconciliation." }, { status: 409 });
      }
    }

    const { data: result, error } = attemptId
      ? await admin.rpc("confirm_reserved_order_payment", {
          p_order_id: orderId, p_user_id: userId, p_attempt_id: attemptId,
          p_session_id: session.id, p_amount_pence: session.amount_total,
        })
      : await admin.rpc("confirm_order_payment", {
          p_order_id: orderId, p_user_id: userId,
          p_session_id: session.id, p_amount_pence: session.amount_total,
        });
    if (error) {
      console.error("Order payment confirmation failed:", error.message);
      return NextResponse.json({ error: "Order payment confirmation failed." }, { status: 500 });
    }
    if (result === "confirmed" || result === "already_confirmed") {
      return NextResponse.json({ received: true });
    }
    console.error("Order payment requires reconciliation:", orderId, session.id, result);
    return NextResponse.json({ error: "Order payment requires reconciliation." }, { status: 409 });
  }
  // Existing ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â£20 wallet top-up flow ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â preserved.
  if (
    session.amount_total !== 2000 ||
    session.currency !== "gbp" ||
    session.metadata?.type !== "wallet_topup" ||
    session.metadata?.top_up_pence !== "2000"
  ) {
    return NextResponse.json({ received: true });
  }

  const userId = session.metadata?.user_id;
  const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

  if (!userId || !uuid.test(userId) || session.client_reference_id !== userId) {
    return NextResponse.json(
      { error: "Invalid customer reference." },
      { status: 400 }
    );
  }

  const { error } = await admin.rpc("credit_wallet_topup", {
    p_user_id: userId,
    p_session_id: session.id,
    p_amount_pence: 2000,
  });

  if (error) {
    console.error("Wallet credit failed:", error);

    return NextResponse.json(
      { error: "Could not credit wallet." },
      { status: 500 }
    );
  }

  return NextResponse.json({ received: true });
}



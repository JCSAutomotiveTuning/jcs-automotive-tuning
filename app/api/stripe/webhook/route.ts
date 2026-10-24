
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
  // Customer order payments
  if (session.metadata?.type === "order_payment") {
    const orderId = session.metadata.order_id;
    const userId = session.metadata.user_id;

    if (
      !orderId ||
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
        orderId
      ) ||
      !userId ||
      session.client_reference_id !== userId
    ) {
      console.error("Stripe order payment has invalid references.");

      return NextResponse.json(
        { error: "Invalid order payment reference." },
        { status: 400 }
      );
    }

    if (
      session.currency !== "gbp" ||
      !Number.isSafeInteger(session.amount_total) ||
      (session.amount_total ?? 0) <= 0
    ) {
      console.error("Stripe order payment has an invalid amount or currency.");

      return NextResponse.json(
        { error: "Invalid order payment amount or currency." },
        { status: 400 }
      );
    }

    const { data: order, error: lookupError } = await admin
      .from("orders")
      .select(
        "id,user_id,amount_pence,currency,status,payment_status"
      )
      .eq("id", orderId)
      .maybeSingle();

    if (lookupError) {
      console.error("Order payment lookup failed:", lookupError.message);

      return NextResponse.json(
        { error: "Could not verify the order." },
        { status: 500 }
      );
    }

    if (!order || order.user_id !== userId) {
      console.error("Stripe order payment does not match an order/customer.");

      return NextResponse.json(
        { error: "Order or customer does not match." },
        { status: 400 }
      );
    }

    if (
      order.currency !== "GBP" ||
      order.amount_pence !== session.amount_total
    ) {
      console.error("Stripe payment amount does not match the order:", orderId);

      return NextResponse.json(
        { error: "Payment amount does not match the order." },
        { status: 409 }
      );
    }

    // Stripe can deliver the same event more than once.
    if (order.payment_status === "paid") {
      return NextResponse.json({ received: true });
    }

    if (
      order.status !== "awaiting_payment" ||
      order.payment_status !== "unpaid"
    ) {
      console.error(
        "Order is not payable but Stripe reports a completed payment:",
        orderId
      );

      return NextResponse.json(
        { error: "Order state needs payment reconciliation." },
        { status: 409 }
      );
    }

    const { data: updatedOrder, error: updateError } = await admin
      .from("orders")
      .update({
        status: "paid",
        payment_status: "paid",
        updated_at: new Date().toISOString(),
      })
      .eq("id", orderId)
      .eq("user_id", userId)
      .eq("amount_pence", session.amount_total)
      .eq("currency", "GBP")
      .eq("status", "awaiting_payment")
      .eq("payment_status", "unpaid")
      .select("id")
      .maybeSingle();

    if (updateError) {
      console.error("Could not mark order as paid:", updateError.message);

      return NextResponse.json(
        { error: "Could not update the order payment." },
        { status: 500 }
      );
    }

    if (!updatedOrder) {
      // Another delivery may have completed the update concurrently.
      const { data: latestOrder, error: latestError } = await admin
        .from("orders")
        .select("payment_status,amount_pence,currency,user_id")
        .eq("id", orderId)
        .maybeSingle();

      if (
        !latestError &&
        latestOrder?.user_id === userId &&
        latestOrder.payment_status === "paid" &&
        latestOrder.amount_pence === session.amount_total &&
        latestOrder.currency === "GBP"
      ) {
        return NextResponse.json({ received: true });
      }

      console.error("Order payment update needs reconciliation:", orderId);

      return NextResponse.json(
        { error: "Could not safely confirm the order payment." },
        { status: 500 }
      );
    }

    return NextResponse.json({ received: true });
  }

  // Existing Ãƒâ€šÃ‚Â£20 wallet top-up flow ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â preserved.
  if (
    session.amount_total !== 2000 ||
    session.currency !== "gbp" ||
    session.metadata?.top_up_pence !== "2000"
  ) {
    return NextResponse.json({ received: true });
  }

  const userId = session.metadata?.user_id;

  if (!userId || session.client_reference_id !== userId) {
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

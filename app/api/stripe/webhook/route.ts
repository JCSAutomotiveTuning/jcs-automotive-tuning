
import { NextResponse } from "next/server";
import Stripe from "stripe";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

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

  if (event.type !== "checkout.session.completed") {
    return NextResponse.json({ received: true });
  }

  const session = event.data.object as Stripe.Checkout.Session;

  if (
    session.mode !== "payment" ||
    session.payment_status !== "paid" ||
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

  const admin = createAdminClient();

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

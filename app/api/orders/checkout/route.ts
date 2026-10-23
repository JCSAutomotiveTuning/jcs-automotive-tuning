
import { NextResponse } from "next/server";
import Stripe from "stripe";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const supabase = createClient();

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: "Please sign in to pay for this order." },
        { status: 401 }
      );
    }

    const body = await req.json().catch(() => null);
    const orderId =
      body && typeof body.orderId === "string" ? body.orderId : "";

    if (
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
        orderId
      )
    ) {
      return NextResponse.json(
        { error: "A valid order ID is required." },
        { status: 400 }
      );
    }

    const secretKey = process.env.STRIPE_SECRET_KEY;

    if (!secretKey) {
      console.error("STRIPE_SECRET_KEY is not configured.");

      return NextResponse.json(
        { error: "Payments are not configured yet." },
        { status: 503 }
      );
    }

    const admin = createAdminClient();

    const { data: order, error: orderError } = await admin
      .from("orders")
      .select(
        "id,user_id,service_name,amount_pence,currency,status,payment_status"
      )
      .eq("id", orderId)
      .eq("user_id", user.id)
      .maybeSingle();

    if (orderError) {
      console.error("Order checkout lookup failed:", orderError.message);

      return NextResponse.json(
        { error: "Could not load this order." },
        { status: 500 }
      );
    }

    if (!order) {
      return NextResponse.json(
        { error: "Order not found." },
        { status: 404 }
      );
    }

    if (
      order.status !== "awaiting_payment" ||
      order.payment_status !== "unpaid"
    ) {
      return NextResponse.json(
        { error: "This order is not currently available for payment." },
        { status: 409 }
      );
    }

    if (
      order.currency !== "GBP" ||
      !Number.isSafeInteger(order.amount_pence) ||
      order.amount_pence <= 0
    ) {
      return NextResponse.json(
        { error: "This order does not have a valid payment amount." },
        { status: 400 }
      );
    }

    const requestOrigin = new URL(req.url).origin;
    const configuredSiteUrl = process.env.NEXT_PUBLIC_SITE_URL;

    const siteUrl = configuredSiteUrl
      ? configuredSiteUrl.replace(/\/+$/, "")
      : requestOrigin;

    const stripe = new Stripe(secretKey);

const session = await stripe.checkout.sessions.create({
  mode: "payment",
  client_reference_id: user.id,
      customer_email: user.email,
      metadata: {
        type: "order_payment",
        order_id: order.id,
        user_id: user.id,
      },
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: "gbp",
            unit_amount: order.amount_pence,
            product_data: {
              name: order.service_name,
              description: `JCS Automotive Tuning order ${order.id.slice(0, 8)}`,
            },
          },
        },
      ],
      success_url: `${siteUrl}/dashboard?payment=success`,
      cancel_url: `${siteUrl}/dashboard?payment=cancelled`,
    });

    if (!session.url) {
      return NextResponse.json(
        { error: "Stripe did not return a checkout URL." },
        { status: 502 }
      );
    }

    return NextResponse.json({ url: session.url });
  } catch (error) {
    console.error("Order checkout creation failed:", error);

    return NextResponse.json(
      { error: "Could not start checkout. Please try again." },
      { status: 500 }
    );
  }
}

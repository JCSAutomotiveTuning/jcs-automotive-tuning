
import { NextResponse } from "next/server";
import Stripe from "stripe";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

export async function POST() {
  try {
    const supabase = createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: "Please sign in first." },
        { status: 401 }
      );
    }

    const secretKey = process.env.STRIPE_SECRET_KEY;
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL;

    if (!secretKey || !siteUrl) {
      return NextResponse.json(
        { error: "Payment service is not configured." },
        { status: 500 }
      );
    }

    const stripe = new Stripe(secretKey);

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
     
      line_items: [
        {
          price_data: {
            currency: "gbp",
            product_data: {
              name: "JCS Automotive Tuning Wallet Top-Up",
              description: "£20 prepaid wallet credit",
            },
            unit_amount: 2000,
          },
          quantity: 1,
        },
      ],
      client_reference_id: user.id,
      metadata: {
        user_id: user.id,
        top_up_pence: "2000",
      },
      success_url: `${siteUrl}/dashboard?topup=success`,
      cancel_url: `${siteUrl}/dashboard?topup=cancelled`,
    });

    if (!session.url) {
      return NextResponse.json(
        { error: "Stripe did not provide a checkout URL." },
        { status: 500 }
      );
    }

    return NextResponse.json({ url: session.url });
  } catch (error) {
    console.error("Stripe Checkout creation failed:", error);
    return NextResponse.json(
      { error: "Could not start checkout. Please try again." },
      { status: 500 }
    );
  }
}

import { NextResponse } from "next/server";
import Stripe from "stripe";
import {
  technicalServices,
  technicalUser,
  uuidPattern,
} from "@/lib/technical-requests";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const user = await technicalUser();

  if (!user) {
    return NextResponse.json({ error: "Sign in required" }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  const id = body?.id;

  if (typeof id !== "string" || !uuidPattern.test(id)) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  if (!process.env.STRIPE_SECRET_KEY) {
    return NextResponse.json(
      { error: "Stripe not configured" },
      { status: 503 }
    );
  }

  const admin = createAdminClient();

  const { data: request, error: lookupError } = await admin
    .from("technical_requests")
    .select(
      "id,user_id,service_type,amount_pence,currency,status,payment_status"
    )
    .eq("id", id)
    .eq("user_id", user.id)
    .maybeSingle();

  if (lookupError || !request) {
    return NextResponse.json(
      { error: "Request not found" },
      { status: 404 }
    );
  }

  if (
    request.status !== "awaiting_payment" ||
    request.payment_status !== "unpaid" ||
    request.amount_pence !== 1500 ||
    request.currency !== "GBP"
  ) {
    return NextResponse.json(
      { error: "Request is not payable" },
      { status: 409 }
    );
  }

  const { data: attempts, error: reservationError } = await admin.rpc(
    "reserve_technical_checkout",
    {
      p_request_id: request.id,
      p_user_id: user.id,
    }
  );

  if (reservationError || !attempts?.length) {
    return NextResponse.json(
      { error: "Unable to reserve Checkout" },
      { status: 409 }
    );
  }

  const attempt = attempts[0];

  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

  if (attempt.session_id) {
    try {
      const existing = await stripe.checkout.sessions.retrieve(
        attempt.session_id
      );

      const matches =
        existing.id === attempt.session_id &&
        existing.mode === "payment" &&
        existing.client_reference_id === user.id &&
        existing.metadata?.type === "technical_request" &&
        existing.metadata?.request_id === request.id &&
        existing.metadata?.user_id === user.id &&
        existing.metadata?.checkout_attempt_id === attempt.attempt_id &&
        existing.currency === "gbp" &&
        existing.amount_total === 1500;

      if (!matches) {
        console.error("Technical checkout session mismatch:", request.id);

        return NextResponse.json(
          { error: "Checkout session requires reconciliation." },
          { status: 409 }
        );
      }

      if (
        existing.status === "open" &&
        existing.payment_status === "unpaid" &&
        existing.url
      ) {
        return NextResponse.json({ url: existing.url });
      }

      if (
        existing.status === "expired" &&
        existing.payment_status === "unpaid"
      ) {
        const { data: reset, error: resetError } = await admin.rpc(
          "reset_verified_expired_technical_checkout",
          {
            p_request_id: request.id,
            p_user_id: user.id,
            p_attempt_id: attempt.attempt_id,
            p_session_id: existing.id,
          }
        );

        if (resetError || reset !== true) {
          return NextResponse.json(
            { error: "Unable to reset expired Checkout session." },
            { status: 409 }
          );
        }

        return NextResponse.json(
          {
            error: "Previous Checkout expired. Please retry payment.",
            retry: true,
          },
          { status: 409 }
        );
      }

      return NextResponse.json(
        { error: "Checkout session requires reconciliation." },
        { status: 409 }
      );
    } catch {
      return NextResponse.json(
        { error: "Unable to verify existing Checkout session." },
        { status: 503 }
      );
    }
  }
  // Checkout redirects must use the trusted configured site, never request headers.
  const configuredSiteUrl = process.env.NEXT_PUBLIC_SITE_URL;
  let base: string;
  try {
    const parsed = new URL(configuredSiteUrl ?? "");
    if (parsed.protocol !== "https:" && !(process.env.NODE_ENV !== "production" && parsed.protocol === "http:" && parsed.hostname === "localhost")) {
      throw new Error("Invalid site URL protocol");
    }
    if (parsed.username || parsed.password || parsed.search || parsed.hash) {
      throw new Error("Invalid site URL components");
    }
    base = parsed.origin + parsed.pathname.replace(/\/+$/, "");
  } catch {
    console.error("Technical checkout return URL is not configured correctly.");
    return NextResponse.json({ error: "Payment return URL is not configured." }, { status: 503 });
  }

  try {
    const session = await stripe.checkout.sessions.create(
      {
        mode: "payment",
        client_reference_id: user.id,
        customer_email: user.email,
        metadata: {
          type: "technical_request",
          request_id: request.id,
          user_id: user.id,
          checkout_attempt_id: attempt.attempt_id,
        },
        line_items: [
          {
            quantity: 1,
            price_data: {
              currency: "gbp",
              unit_amount: 1500,
              product_data: {
                name:
                  technicalServices[
                    request.service_type as keyof typeof technicalServices
                  ],
              },
            },
          },
        ],
        success_url: `${base}/dashboard/technical-requests?payment=success`,
        cancel_url: `${base}/dashboard/technical-requests?payment=cancelled`,
      },
      {
        idempotencyKey: `technical-checkout-${attempt.attempt_id}`,
      }
    );

    if (!session.expires_at || !session.url) {
      return NextResponse.json(
        { error: "Stripe returned an incomplete Checkout session" },
        { status: 502 }
      );
    }

    const { data: recorded, error: recordError } = await admin.rpc(
      "record_technical_checkout",
      {
        p_request_id: request.id,
        p_user_id: user.id,
        p_attempt_id: attempt.attempt_id,
        p_session_id: session.id,
        p_expires_at: new Date(session.expires_at * 1000).toISOString(),
      }
    );

    if (recordError || recorded !== true) {
      return NextResponse.json(
        { error: "Unable to record Checkout session" },
        { status: 409 }
      );
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
    return NextResponse.json(
      { error: "Unable to create Checkout session" },
      { status: 503 }
    );
  }
}


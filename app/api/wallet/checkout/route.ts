import { NextResponse } from "next/server";
import Stripe from "stripe";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
const OPTIONS = new Set([2000,4000,10000]);

export async function POST(req: Request) {
  if (process.env.JCS_WALLET_DEPOSITS_ENABLED !== "true") {
    return NextResponse.json({ error: "New wallet deposits are not enabled yet." }, { status: 503 });
  }
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user || !user.email) return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  const origin = req.headers.get("origin");
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/+$/, "");
  if (!siteUrl || !siteUrl.startsWith("https://") || (origin && new URL(origin).origin !== new URL(siteUrl).origin)) {
    return NextResponse.json({ error: "Invalid request origin or payment URL." }, { status: 403 });
  }
  const payload = await req.json().catch(() => null);
  const amount = payload?.amountPence;
  if (!Number.isSafeInteger(amount) || !OPTIONS.has(amount)) {
    return NextResponse.json({ error: "Choose £20, £40 or £100." }, { status: 400 });
  }
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key || !/^(sk|rk)_(test|live)_/.test(key) ||
    (process.env.VERCEL_ENV === "production" && !/^(sk|rk)_live_/.test(key)) ||
    (process.env.VERCEL_ENV === "preview" && !/^(sk|rk)_test_/.test(key))) {
    return NextResponse.json({ error: "Stripe is not configured for this environment." }, { status: 503 });
  }
  try {
    const stripe = new Stripe(key);
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      client_reference_id: user.id,
      customer_email: user.email,
      metadata: { type: "deposit_wallet_topup", user_id: user.id, top_up_pence: String(amount) },
      line_items: [{ quantity: 1, price_data: {
        currency: "gbp", unit_amount: amount,
        product_data: { name: "JCS prepaid order deposits", description: "Refundable or transferable according to JCS deposit terms; applied toward final tuning invoices." }
      }}],
      success_url: `${siteUrl}/dashboard?wallet=success`,
      cancel_url: `${siteUrl}/dashboard?wallet=cancelled`
    });
    return NextResponse.json({ url: session.url }, { headers: { "Cache-Control": "no-store" } });
  } catch (err) {
    console.error("Deposit wallet Stripe checkout failed:", err instanceof Error ? err.message : "unknown");
    return NextResponse.json({ error: "Could not start credit checkout." }, { status: 502 });
  }
}

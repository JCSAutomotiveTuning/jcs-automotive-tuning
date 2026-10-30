import { NextResponse } from "next/server";
import Stripe from "stripe";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Sign in required." }, { status: 401 });

  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle();
  if (profile?.role !== "admin") return NextResponse.json({ error: "Administrator access required." }, { status: 403 });

  const admin = createAdminClient();
  const { data: transactions, error } = await admin
    .from("wallet_transactions")
    .select("id,user_id,amount_pence,transaction_type,stripe_session_id,description,created_at,order_id")
    .order("created_at", { ascending: false })
    .limit(500);

  if (error) {
    console.error("Admin transactions query failed:", error.message);
    return NextResponse.json({ error: "Could not load transactions." }, { status: 500 });
  }

  const rows = transactions ?? [];
  const userIds = [...new Set(rows.map((t) => t.user_id))];
  const { data: profiles, error: profilesError } = userIds.length
    ? await admin.from("profiles").select("id,email").in("id", userIds)
    : { data: [], error: null };

  if (profilesError) return NextResponse.json({ error: "Could not load customer details." }, { status: 500 });

  const emails = Object.fromEntries((profiles ?? []).map((p) => [p.id, p.email]));
  // Stripe is the authority for charges/refunds. Wallet events are a separate ledger.
  // Do not write Stripe activity into wallet_transactions: that would create credits.
  let stripeActivity: {
    id: string; created_at: string; amount_pence: number; transaction_type: string;
    description: string; stripe_reference: string; status: string;
  }[] = [];
  let stripeWarning: string | null = null;
  const key = process.env.STRIPE_SECRET_KEY;
  const isProduction = process.env.VERCEL_ENV === "production";
  if (!key || !/^(sk|rk)_(live|test)_/.test(key) ||
      (isProduction && !/^(sk|rk)_live_/.test(key))) {
    stripeWarning = "Stripe history is unavailable: payment environment is not configured correctly.";
  } else {
    try {
      const stripe = new Stripe(key);
      const [payments, refunds] = await Promise.all([
        stripe.paymentIntents.list({ limit: 100 }),
        stripe.refunds.list({ limit: 100 }),
      ]);
      const refundByIntent = new Map<string, number>();
      for (const refund of refunds.data) {
        const intent = typeof refund.payment_intent === "string"
          ? refund.payment_intent : refund.payment_intent?.id;
        if (intent && refund.status === "succeeded")
          refundByIntent.set(intent, (refundByIntent.get(intent) ?? 0) + refund.amount);
      }
      const expectedMode = isProduction ? true : /^(sk|rk)_live_/.test(key);
      stripeActivity = [
        ...payments.data.filter(payment => payment.livemode === expectedMode && payment.status === "succeeded")
          .map(payment => ({
            id: payment.id,
            created_at: new Date(payment.created * 1000).toISOString(),
            amount_pence: payment.amount_received,
            transaction_type: "stripe_payment",
            description: (refundByIntent.get(payment.id) ?? 0) >= payment.amount_received
              ? "Successful Stripe payment (subsequently refunded)"
              : "Successful Stripe payment",
            stripe_reference: payment.id,
            status: payment.status,
          })),
        ...refunds.data.filter(refund => refund.livemode === expectedMode)
          .map(refund => ({
            id: refund.id,
            created_at: new Date(refund.created * 1000).toISOString(),
            amount_pence: -refund.amount,
            transaction_type: "stripe_refund",
            description: "Stripe refund",
            stripe_reference: refund.id,
            status: refund.status ?? "unknown",
          })),
      ].sort((x,y) => Date.parse(y.created_at) - Date.parse(x.created_at));
      if (payments.has_more || refunds.has_more)
        stripeWarning = "Showing the most recent 100 Stripe payments and 100 refunds. Older Stripe activity may not be included.";
    } catch (error) {
      console.error("Stripe transaction history lookup failed:", error instanceof Error ? error.message : "unknown");
      stripeWarning = "Stripe activity could not be loaded. Wallet history is still available.";
    }
  }
  return NextResponse.json({
    transactions: rows.map((t) => ({ ...t, customer_email: emails[t.user_id] ?? "Unknown customer" })),
    stripeActivity, stripeWarning,
  }, { headers: { "Cache-Control": "private, no-store" } });
}


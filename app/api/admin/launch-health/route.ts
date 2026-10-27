import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Read-only admin health report. This never initiates a payment or changes an order.
export async function GET() {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  const { data: profile, error: roleError } = await supabase.from("profiles")
    .select("role").eq("id", user.id).maybeSingle();
  if (roleError || profile?.role !== "admin") {
    return NextResponse.json({ error: "Administrator access required." }, { status: 403 });
  }

  const key = process.env.STRIPE_SECRET_KEY ?? "";
  const production = process.env.VERCEL_ENV === "production";
  const keyForEnvironment = production ? key.startsWith("sk_live_") : key.startsWith("sk_test_");
  const check: {
    stripeLiveKey: boolean;
    webhookSigningSecretPresent: boolean;
    stripeApiReachable: boolean;
    expectedAccountMatches: boolean;
    chargesEnabled: boolean;
    payoutsEnabled: boolean;
    verificationPending: boolean | null;
    stripeCheckError: boolean;
  } = {
    stripeLiveKey: production && key.startsWith("sk_live_"),
    webhookSigningSecretPresent: Boolean(process.env.STRIPE_WEBHOOK_SECRET?.startsWith("whsec_")),
    stripeApiReachable: false,
    expectedAccountMatches: false,
    chargesEnabled: false,
    payoutsEnabled: false,
    verificationPending: null,
    stripeCheckError: false,
  };
  if (keyForEnvironment) {
    try {
      // Query the merchant account tied to the active secret key, not a Connect account.
      const reply = await fetch("https://api.stripe.com/v1/account", {
        headers: { Authorization: `Bearer ${key}` },
        cache: "no-store",
        signal: AbortSignal.timeout(8000),
      });
      if (!reply.ok) throw new Error("Stripe account status check failed");
      const account = await reply.json() as {
        id?: string;
        charges_enabled?: boolean;
        payouts_enabled?: boolean;
        requirements?: { currently_due?: string[]; past_due?: string[]; disabled_reason?: string | null };
      };
      check.stripeApiReachable = true;
      check.expectedAccountMatches = account.id === (production ? "acct_1UTUpbIt6MsI2RWr" : "acct_1UTh2sEeCDJNUGHR");
      check.chargesEnabled = account.charges_enabled === true;
      check.payoutsEnabled = account.payouts_enabled === true;
      check.verificationPending = Boolean(account.requirements?.currently_due?.length || account.requirements?.past_due?.length || account.requirements?.disabled_reason);
    } catch (error) {
      console.error("Admin health check: Stripe account lookup failed:", error instanceof Error ? error.name : "unknown");
      check.stripeCheckError = true;
    }
  }

  const db = createAdminClient();
  const [orderQueue, technicalQueue, inconsistentOrders] = await Promise.all([
    db.from("order_files").select("id", { head: true, count: "exact" }).eq("scan_status", "pending"),
    db.from("technical_request_files").select("id", { head: true, count: "exact" }).eq("scan_status", "pending"),
    db.from("orders").select("id", { head: true, count: "exact" }).eq("status", "paid").neq("payment_status", "paid"),
  ]);
  const databaseOk = !orderQueue.error && !technicalQueue.error && !inconsistentOrders.error;
  const report = {
    generatedAt: new Date().toISOString(),
    environment: production ? "production" : "nonproduction",
    stripe: check,
    pendingUploads: databaseOk ? {
      tuningFiles: orderQueue.count ?? 0,
      technicalFiles: technicalQueue.count ?? 0,
    } : null,
    workflowStatusMismatchCount: databaseOk ? inconsistentOrders.count ?? 0 : null,
    notifications: {
      cronConfigured: Boolean(process.env.CRON_SECRET),
      emailProviderConfigured: Boolean(process.env.RESEND_API_KEY && process.env.NOTIFICATION_FROM_EMAIL),
    },
    // ClamAV requires an active worker and successful EICAR + benign-file testing.
    // This check cannot verify a remotely operated scanner from environment values alone.
    manualLaunchChecksStillRequired: [
      "Verify ClamAV worker is running and detect EICAR before accepting file jobs",
      "Complete a test-mode order payment, signed webhook, status update and retry",
      "Confirm any historic status/financial mismatches before treating orders as paid",
      "Enable server-side leaked password protection in Supabase Auth settings",
    ],
  };
  return NextResponse.json(report, {
    headers: { "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" },
  });
}

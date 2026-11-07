import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Read-only launch audit. Never returns customer details or changes financial records.
 * Errors fail the whole report closed instead of presenting false green checks.
 */
export async function GET() {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  const { data: profile, error: profileError } = await supabase
    .from("profiles").select("role").eq("id", user.id).single();
  if (profileError || profile?.role !== "admin") {
    return NextResponse.json({ error: "Admin access required." }, { status: 403 });
  }

  const admin = createAdminClient();
  try {
    const [ordersResult, filesResult, technicalResult] = await Promise.all([
      admin.from("orders")
        .select("id,service_code,status,payment_status,checkout_session_id,stripe_payment_session_id,checkout_attempt_id")
        .order("created_at", { ascending: false }).limit(1000),
      admin.from("order_files")
        .select("id,order_id,scan_status,kind,delivery_status").limit(1000),
      admin.from("technical_requests")
        .select("id,status,payment_status,stripe_session_id,checkout_session_id")
        .order("created_at", { ascending: false }).limit(1000),
    ]);
    if (ordersResult.error || filesResult.error || technicalResult.error ||
        !ordersResult.data || !filesResult.data || !technicalResult.data) {
      console.error("Launch audit failed:",
        ordersResult.error?.message, filesResult.error?.message, technicalResult.error?.message);
      return NextResponse.json({ error: "Could not read launch audit data." }, { status: 503 });
    }

    const orders = ordersResult.data;
    const files = filesResult.data;
    const technicalRequests = technicalResult.data;
    const production = process.env.VERCEL_ENV === "production";
    const mismatchedStatuses = orders.filter(o =>
      ["paid", "in_progress", "qa_review", "completed"].includes(o.status) && o.payment_status !== "paid"
    );
    const paidWithoutStripeSession = orders.filter(o =>
      o.payment_status === "paid" && !o.stripe_payment_session_id
    );
    const technicalTestSessions = production ? technicalRequests.filter(t =>
      [t.stripe_session_id, t.checkout_session_id]
        .some(sessionId => sessionId?.startsWith("cs_test_"))
    ) : [];
    const inconsistentOrders = orders.filter(o =>
      (["paid", "in_progress", "qa_review", "completed"].includes(o.status) && o.payment_status !== "paid") ||
      (o.payment_status === "paid" && !o.stripe_payment_session_id)
    );
    const awaitingReconciliation = orders.filter(o =>
      o.checkout_session_id && o.payment_status !== "paid" &&
      !["awaiting_payment", "cancelled", "failed"].includes(o.status)
    );
    const awaitingScans = files.filter(f => f.kind === "customer_original" && f.scan_status !== "clean");
    const requiresDeliverable = new Set(["ecu_stage1","dsg_tcu","custom_ecu","custom_tcu","ecu_tcu_package"]);
    const completedWithoutApprovedOutput = orders.filter(o =>
      o.status === "completed" && o.payment_status === "paid" && requiresDeliverable.has(o.service_code) &&
      !files.some(f => f.order_id === o.id && f.kind === "completed_output" &&
        f.scan_status === "clean" && f.delivery_status === "approved")
    );
    const response = {
      checked_at: new Date().toISOString(),
      order_limit: 1000,
      file_limit: 1000,
      truncated: orders.length === 1000 || files.length === 1000 || technicalRequests.length === 1000,
      deposit_wallet_enabled: process.env.JCS_WALLET_DEPOSITS_ENABLED === "true",
      counters: {
        orders_checked: orders.length,
        files_checked: files.length,
        technical_requests_checked: technicalRequests.length,
        inconsistent_orders: inconsistentOrders.length,
        paid_status_mismatches: mismatchedStatuses.length,
        paid_orders_without_stripe_session: paidWithoutStripeSession.length,
        production_technical_requests_with_test_sessions: technicalTestSessions.length,
        checkout_reconciliation_candidates: awaitingReconciliation.length,
        files_not_cleared: awaitingScans.length,
        paid_completed_orders_without_approved_file: completedWithoutApprovedOutput.length,
      },
      needs_manual_review: {
        inconsistent_order_ids: inconsistentOrders.map(o => o.id),
        paid_status_mismatch_order_ids: mismatchedStatuses.map(o => o.id),
        orders_without_stripe_session_ids: paidWithoutStripeSession.map(o => o.id),
        technical_test_session_request_ids: technicalTestSessions.map(t => t.id),
        checkout_order_ids: awaitingReconciliation.map(o => o.id),
        finished_file_delivery_order_ids: completedWithoutApprovedOutput.map(o => o.id),
      },
      warning: "Read-only database audit. Manual/bank payments may legitimately lack a Stripe session and require independent evidence. Test-mode technical request sessions in production require classification, never automatic financial alteration. Missing finished-file approvals require checksum/calibration QA. Stripe refunds/disputes and authenticated file isolation still require end-to-end verification.",
    };
    return NextResponse.json(response, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("Launch audit request failed:", error);
    return NextResponse.json({ error: "Could not complete launch audit." }, { status: 500 });
  }
}

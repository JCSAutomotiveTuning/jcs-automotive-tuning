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
    const [ordersResult, filesResult] = await Promise.all([
      admin.from("orders")
        .select("id,status,payment_status,checkout_session_id,stripe_payment_session_id,checkout_attempt_id")
        .order("created_at", { ascending: false }).limit(1000),
      admin.from("order_files")
        .select("id,scan_status,kind").limit(1000),
    ]);
    if (ordersResult.error || filesResult.error || !ordersResult.data || !filesResult.data) {
      console.error("Launch audit failed:", ordersResult.error?.message, filesResult.error?.message);
      return NextResponse.json({ error: "Could not read launch audit data." }, { status: 503 });
    }

    const orders = ordersResult.data;
    const files = filesResult.data;
    const inconsistentOrders = orders.filter(o =>
      (["paid", "in_progress", "qa_review", "completed"].includes(o.status) && o.payment_status !== "paid") ||
      (o.payment_status === "paid" && !o.stripe_payment_session_id)
    );
    const awaitingReconciliation = orders.filter(o =>
      o.checkout_session_id && o.payment_status !== "paid" &&
      !["awaiting_payment", "cancelled", "failed"].includes(o.status)
    );
    const awaitingScans = files.filter(f => f.kind === "customer_original" && f.scan_status !== "clean");
    const response = {
      checked_at: new Date().toISOString(),
      order_limit: 1000,
      file_limit: 1000,
      truncated: orders.length === 1000 || files.length === 1000,
      counters: {
        orders_checked: orders.length,
        files_checked: files.length,
        inconsistent_orders: inconsistentOrders.length,
        checkout_reconciliation_candidates: awaitingReconciliation.length,
        files_not_cleared: awaitingScans.length,
      },
      needs_manual_review: {
        inconsistent_order_ids: inconsistentOrders.map(o => o.id),
        checkout_order_ids: awaitingReconciliation.map(o => o.id),
      },
      warning: "Read-only database audit. Stripe payments, refund/dispute handling, antivirus execution, and customer download isolation require separate end-to-end verification.",
    };
    return NextResponse.json(response, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("Launch audit request failed:", error);
    return NextResponse.json({ error: "Could not complete launch audit." }, { status: 500 });
  }
}

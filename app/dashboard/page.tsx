import { PriceVisibilityToggle, MaskedAmount } from "@/components/PriceVisibility";
import PriceVisibilityStyles from "@/components/PriceVisibilityStyles";
import LoyaltyBalance from "@/components/LoyaltyBalance";

import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import NewOrder from "./new-order";
import DepositWalletPanel from "./DepositWalletPanel";
import ResumeUpload from "./ResumeUpload";
import OrderPaymentButton from "./OrderPaymentButton";
import LiveClock from "@/components/LiveClock";

// @next-codemod-ignore Cache Components adoption: this segment temporarily allows blocking.
// Remove this opt-out after verifying the segment passes validation without it.
// See: https://nextjs.org/docs/app/guides/migrating-to-cache-components

const orderStages = [
  "Received",
  "Review",
  "Payment",
  "Workshop",
  "Quality check",
  "Complete",
];

const orderStatus: Record<
  string,
  { label: string; detail: string; stage: number; closed?: boolean }
> = {
  awaiting_review: {
    label: "Awaiting review",
    detail: "Your order is in the queue for a compatibility review.",
    stage: 1,
  },
  awaiting_payment: {
    label: "Awaiting payment",
    detail: "Review is complete. Payment is needed before work can begin.",
    stage: 2,
  },
  paid: {
    label: "Paid",
    detail: "Payment is confirmed and your job is ready to enter the workshop queue.",
    stage: 3,
  },
  in_progress: {
    label: "In progress",
    detail: "A technician is working on your job.",
    stage: 3,
  },
  needs_customer_info: {
    label: "Info requested",
    detail: "Work is paused while we wait for more information from you.",
    stage: 3,
  },
  qa_review: {
    label: "Quality check",
    detail: "The completed work is going through final checks.",
    stage: 4,
  },
  completed: {
    label: "Complete",
    detail: "Your job has been completed.",
    stage: 5,
  },
  cancelled: {
    label: "Cancelled",
    detail: "This order has been cancelled.",
    stage: -1,
    closed: true,
  },
  failed: {
    label: "Unable to proceed",
    detail: "We could not complete this order.",
    stage: -1,
    closed: true,
  },
};

function formatPrice(amountPence: number, currency: string) {
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency,
  }).format(amountPence / 100);
}

export default async function Dashboard({ searchParams }: { searchParams: Promise<{ service?: string }> }) {
  const requestedService = (await searchParams).service;
  const initialService = requestedService === "datalog_analysis" ? "datalog_analysis" : "ecu_stage1";
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const depositsEnabled = process.env.JCS_WALLET_DEPOSITS_ENABLED === "true";
  const [
    { data: orders, error: ordersError },
    { data: profile },
  ] = await Promise.all([
    supabase
      .from("orders")
      .select(
        "id,service_code,service_name,status,payment_status,amount_pence,currency,created_at,vehicle_make,vehicle_model,engine_code,admin_notes,order_files(id,scan_status)"
      )
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(50),
    supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .maybeSingle(),
  ]);

  const { data: depositWallet } = depositsEnabled
    ? await supabase.from("deposit_wallets").select("balance_pence").eq("user_id", user.id).maybeSingle()
    : { data: null };

  const { data: depositEvents, error: depositEventsError } = depositsEnabled
    ? await supabase.from("deposit_wallet_events")
        .select("id,amount_pence,transaction_type,description,created_at,order_id")
        .eq("user_id",user.id)
        .order("created_at",{ascending:false}).limit(8)
    : {data:[],error:null};
  if(depositEventsError)console.error("Deposit wallet history unavailable:",depositEventsError.message);

  if (ordersError) {
    console.error("Dashboard order lookup failed:", ordersError.message);
  }

  const visibleOrders = (orders ?? []).filter(o => !o.admin_notes?.includes("[LAUNCH TEST ARCHIVED 2026-10-29]"));

  return (
    <>
    <PriceVisibilityStyles />
    <main className="wrap">
      <nav className="nav jcs-dashboard-nav" aria-label="Customer portal">
        <Link className="brand" href="/">JCS <span>PORTAL</span></Link>
        <div className="jcs-account-actions">
          <LiveClock />
          <PriceVisibilityToggle />
          <span className="pill jcs-account-email">{user.email}</span>
          {profile?.role === "admin" && <Link className="btn blue" href="/admin">Admin</Link>}
          <form action="/auth/signout" method="post"><button className="btn secondary" type="submit">Sign out</button></form>
        </div>
      </nav>
      <nav className="jcs-tool-nav" aria-label="Portal tools">
        <Link href="/dashboard/technical-requests">Parts &amp; Wiring</Link>
        <Link href="/dashboard/dtc">DTC Lookup</Link>
        <Link href="/dashboard/datalog-analysis">Datalog Analysis</Link>
        <Link href="/dashboard/file-compare">File Compare</Link>
        <Link href="/dashboard/file-identification">File ID</Link>
        <Link href="/dashboard/tool-compatibility">Tool Compatibility</Link>
        <Link href="/dashboard/vehicle-ecu-search">Vehicle &amp; ECU Finder</Link>
        <Link href="/dashboard/dealer">Dealer Application</Link>
        <Link href="/dashboard/vehicle-lookup">ECU Database</Link>
        <Link href="/dashboard/notification-preferences">Notifications</Link>
        <Link href="/dashboard/support">Support Centre</Link>
      </nav>

      <section className="jcs-workspace-hero">
        <div>
          <div className="eyebrow">JCS Automotive Tuning / Customer workspace</div>
          <h1>Calibration <em>workspace.</em></h1>
          <p>Submit ECU and TCU files, monitor your jobs and access diagnostic tools from one place.</p>
          <div className="jcs-workspace-actions">
            <a href="#upload-tuning-file" className="btn">+ New tuning request</a>
            <a href="#order-history" className="btn secondary">View orders</a>
            <Link href="/dashboard/support" className="btn secondary">Get support</Link>
          </div>
        </div>
        <div className="jcs-workspace-summary">
          <div className="jcs-summary-label">Your workspace</div>
          <div className="jcs-summary-grid">
            <div><strong>{visibleOrders.length}</strong><span>Recent orders</span></div>
            <div><strong>{visibleOrders.filter(o=>!["completed","cancelled","failed"].includes(o.status)).length ?? 0}</strong><span>Active jobs</span></div>
            <div><strong>{visibleOrders.filter(o=>o.status==="completed").length ?? 0}</strong><span>Completed</span></div>
            
          </div>
          <p>Orders shown: latest 50. Order and payment details are available below.</p>
        </div>
      </section>
      {depositsEnabled && <DepositWalletPanel balancePence={depositWallet?.balance_pence ?? 0} events={depositEvents ?? []} />}
      <div className="jcs-section-heading"><div><span className="eyebrow">File services</span><h2>Manage your tuning jobs</h2></div><span className="pill">Private customer workspace</span></div>
      <div className="two">
        <section id="upload-tuning-file" className="card" style={{ scrollMarginTop: 24 }}>
          <h2>Submit a job</h2>
          {depositsEnabled && <p className="notice">A verified £20 wallet deposit is required before submitting a new request. It is credited toward the final quote.</p>}
          <NewOrder initialService={initialService} />
        </section>

        <section id="order-history" className="card" style={{scrollMarginTop:24}}>
          <h2>Order history</h2>

          {!visibleOrders.length ? (
            <p>No orders yet. Submit your first job to get started.</p>
          ) : (
            <div className="stack">
              {visibleOrders.map((o) => {
                const progress = orderStatus[o.status] ?? {
                  label: "Status update",
                  detail: "Your order status has been updated.",
                  stage: -1,
                  closed: true,
                };

                const validCurrency = o.currency === "GBP";
                const hasPrice =
                  Number.isSafeInteger(o.amount_pence) &&
                  o.amount_pence >= 0 &&
                  validCurrency;

                const canPay =
                  o.status === "awaiting_payment" &&
                  o.payment_status === "unpaid" &&
                  Number.isSafeInteger(o.amount_pence) &&
                  o.amount_pence > 0 &&
                  validCurrency;

                const canResumeUpload =
                  o.status === "awaiting_review" &&
                  o.payment_status === "unpaid" &&
                  o.currency === "GBP" &&
                  Number.isSafeInteger(o.amount_pence);

                return (
                  <article className="order-entry order-card" key={o.id}>
                    <div className="row" style={{ gap: 12, flexWrap: "wrap", alignItems: "center", justifyContent: "space-between" }}>
                      <strong>
                        {o.service_name ||
                          o.service_code.replaceAll("_", " ").toUpperCase()}
                      </strong>

                      <span
                        className={`order-badge${
                          progress.closed
                            ? " is-closed"
                            : o.status === "needs_customer_info"
                              ? " needs-info"
                              : ""
                        }`}
                      >
                        {progress.label}
                      </span>
                    </div>

                    <p className="order-vehicle">
                      {[o.vehicle_make, o.vehicle_model, o.engine_code]
                        .filter(Boolean)
                        .join(" · ") || "Vehicle details not supplied"}
                    </p>

                    {hasPrice && (
                      <p className="order-total">
                        <strong>Total <MaskedAmount>{formatPrice(o.amount_pence, o.currency)}</MaskedAmount></strong>
                      </p>
                    )}

                    <p className="order-detail">{progress.detail}</p>
                    {(o.order_files?.length ?? 0) > 0 && (
                      <p className="order-detail" aria-label="Uploaded file security status">
                        File safety: {o.order_files.some(f => f.scan_status === "blocked")
                          ? "Quarantined — contact support"
                          : o.order_files.every(f => f.scan_status === "clean")
                            ? "Safety check passed"
                            : "Awaiting safety validation — downloads restricted"}
                      </p>
                    )}

                    {!progress.closed && (
                      <ol
                        className="order-progress"
                        aria-label={`Order progress: ${progress.label}`}
                      >
                        {orderStages.map((stage, index) => (
                          <li
                            className={
                              index < progress.stage
                                ? "is-done"
                                : index === progress.stage
                                  ? "is-current"
                                  : ""
                            }
                            aria-current={
                              index === progress.stage ? "step" : undefined
                            }
                            key={stage}
                          >
                            <span className="progress-dot" />
                            <span>{stage}</span>
                          </li>
                        ))}
                      </ol>
                    )}

                    {canPay && <OrderPaymentButton orderId={o.id} bankEnabled={!!process.env.JCS_BANK_ACCOUNT_NAME && /^\d{6}$/.test((process.env.JCS_BANK_SORT_CODE||"").replace(/\D/g,"")) && /^\d{8}$/.test((process.env.JCS_BANK_ACCOUNT_NUMBER||"").replace(/\\D/g,""))} />}

                     {canResumeUpload && (
                       <ResumeUpload orderId={o.id} />
                     )}

                    {o.status === "awaiting_review" && o.payment_status === "unpaid" && (
                      <p className="order-detail" role="status">
                        {o.amount_pence === 0
                          ? "Your order is awaiting review and a confirmed quote. No payment is due yet."
                          : "Payment will become available here once JCS reviews your uploaded file, confirms the price and requests payment."}
                      </p>
                    )}

                    <div className="order-meta">
                      <span>Order #{o.id.slice(0, 8)}</span>
                      <span
                        className={`payment-badge ${
                          o.payment_status === "paid" ? "is-paid" : "is-unpaid"
                        }`}
                      >
                        Payment: {o.payment_status.replaceAll("_", " ")}
                      </span>
                      <span>
                        {new Date(o.created_at).toLocaleDateString("en-GB")}
                      </span>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </section>
      </div>

      <div style={{ marginTop: 24 }}>
        <LoyaltyBalance />
      </div>

      <footer>
        JCS Automotive Tuning | Keep a separate backup of your original ECU/TCU
        read.
      </footer>
    </main>
    </>
  );
}

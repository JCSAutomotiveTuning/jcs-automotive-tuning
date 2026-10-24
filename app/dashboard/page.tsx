import { PriceVisibilityToggle, MaskedAmount } from "@/components/PriceVisibility";
import PriceVisibilityStyles from "@/components/PriceVisibilityStyles";
import LoyaltyBalance from "@/components/LoyaltyBalance";

import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import NewOrder from "./new-order";
import WalletPanel from "./wallet-panel";
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

export default async function Dashboard() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const [
    { data: orders, error: ordersError },
    { data: profile },
    { data: wallet },
  ] = await Promise.all([
    supabase
      .from("orders")
      .select(
        "id,service_code,service_name,status,payment_status,amount_pence,currency,created_at,vehicle_make,vehicle_model,engine_code"
      )
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(50),
    supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .maybeSingle(),
    supabase
      .from("customer_wallets")
      .select("balance_pence")
      .eq("user_id", user.id)
      .maybeSingle(),
  ]);

  if (ordersError) {
    console.error("Dashboard order lookup failed:", ordersError.message);
  }

  const balancePence = wallet?.balance_pence ?? 0;

  return (
    <>
    <PriceVisibilityStyles />
    <main className="wrap">
      <nav className="nav">
  <Link className="brand" href="/">
    JCS <span>PORTAL</span>
  </Link>

  <div className="row">
        <LiveClock />
    <PriceVisibilityToggle />
    <span className="pill">{user.email}</span>

    <Link className="btn secondary" href="/dashboard/dtc">DTC Lookup</Link>
    <Link className="btn secondary" href="/dashboard/support">
      Support Centre
    </Link>

    <form action="/auth/signout" method="post">
      <button className="btn secondary" type="submit">
        Sign out
      </button>
    </form>

    {profile?.role === "admin" && (
      <Link className="btn blue" href="/admin">
        Admin
      </Link>
    )}
  </div>
</nav>

      <section className="hero">
        <div className="eyebrow">Customer dashboard</div>

        <h1 style={{ fontSize: 54 }}>
          Your <em>orders.</em>
        </h1>

        <p>
          Submit a new job and track progress here. File uploads are private
          and orders are reviewed before any calibration file is released.
        </p>
      </section>

      <div style={{ margin: "20px 0" }}>
  <a
    href="#upload-tuning-file"
    className="btn"
    style={{
      display: "inline-flex",
      alignItems: "center",
      justifyContent: "center",
      gap: 10,
      padding: "14px 24px",
      fontWeight: 700,
      textDecoration: "none",
    }}
  >
    ↑ Upload Tuning File
  </a>
</div>
      <div className="two">
        <section id="upload-tuning-file" className="card" style={{ scrollMarginTop: 24 }}>
          <h2>Submit a job</h2>
          <NewOrder />
        </section>

        <section className="card">
          <h2>Order history</h2>

          {!orders?.length ? (
            <p>No orders yet. Submit your first job to get started.</p>
          ) : (
            <div className="stack">
              {orders.map((o) => {
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

                    {canPay && <OrderPaymentButton orderId={o.id} />}

                    {o.status === "awaiting_review" &&
                      o.payment_status === "unpaid" &&
                      o.amount_pence === 0 && (
                        <p className="order-detail">
                          Your order is awaiting review and a price confirmation.
                          No payment is due yet.
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
        <WalletPanel balancePence={balancePence} />
        <LoyaltyBalance />
      </div>

      <footer>
        JCS Automotive Tuning Ãƒâ€š| Keep a separate backup of your original ECU/TCU
        read.
      </footer>
    </main>
    </>
  );
}

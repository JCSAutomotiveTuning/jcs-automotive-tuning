import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

// @next-codemod-ignore Cache Components adoption: this segment temporarily allows blocking.
// Remove this opt-out after verifying the segment passes validation without it.
// See: https://nextjs.org/docs/app/guides/migrating-to-cache-components

export const dynamic = "force-dynamic";

type PageProps = {
  searchParams: Promise<{ q?: string | string[] }>;
};

const money = (pence: number) =>
  new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
  }).format(pence / 100);

const isUuid = (value: string) =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value
  );

export default async function AdminCustomersPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const rawQuery = Array.isArray(params.q) ? params.q[0] : params.q;
  const query = (rawQuery ?? "").trim().slice(0, 100);

  const supabase = await createClient();

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (profile?.role !== "admin") redirect("/dashboard");

  const admin = createAdminClient();
  let customersQuery = admin
    .from("profiles")
    .select("id,email,created_at")
    .eq("role", "customer")
    .order("created_at", { ascending: false })
    .limit(500);

  if (query) {
    if (isUuid(query)) {
      customersQuery = customersQuery.eq("id", query);
    } else {
      // Escape PostgREST filter metacharacters before using the value in ilike.
      const emailQuery = query.replace(/[\\%_,()]/g, " ").trim();
      customersQuery = customersQuery.ilike("email", `%${emailQuery}%`);
    }
  }

  const { data: customers, error } = await customersQuery;

  if (error) {
    console.error("Admin customers query failed:", error.message);
  }

  const customerIds = (customers ?? []).map((customer) => customer.id);

  const [walletsResult, ordersResult] =
    customerIds.length > 0
      ? await Promise.all([
          admin
            .from("customer_wallets")
            .select("user_id,balance_pence")
            .in("user_id", customerIds),
          admin
            .from("orders")
            .select("user_id")
            .in("user_id", customerIds),
        ])
      : [
          { data: [], error: null },
          { data: [], error: null },
        ];

  const relatedDataError = walletsResult.error || ordersResult.error;

  const walletByUserId = new Map<string, number>(
    (walletsResult.data ?? []).map((wallet) => [
      wallet.user_id,
      Number(wallet.balance_pence ?? 0),
    ])
  );

  const orderCountByUserId = new Map<string, number>();
  for (const order of ordersResult.data ?? []) {
    orderCountByUserId.set(
      order.user_id,
      (orderCountByUserId.get(order.user_id) ?? 0) + 1
    );
  }

  const rows = (customers ?? []).map((customer) => ({
    ...customer,
    balance: walletByUserId.get(customer.id) ?? 0,
    orderCount: orderCountByUserId.get(customer.id) ?? 0,
  }));

  const totalWalletPence = rows.reduce((total, customer) => total + customer.balance, 0);
  const totalOrders = rows.reduce((total, customer) => total + customer.orderCount, 0);

  return (
    <main className="admin-shell">
      <header className="admin-header">
        <div>
          <p className="eyebrow">JCS AUTOMOTIVE TUNING</p>
          <h1>Customers</h1>
          <p className="muted">
            Find customer accounts and review wallet balances and order activity.
          </p>
        </div>
        <Link className="button button-secondary" href="/admin">
          Back to overview
        </Link>
      </header>

      <section className="panel">
        <div className="panel-header">
          <div>
            <h2>Customer overview</h2>
            <p className="muted">
              {query
                ? `${rows.length} result${rows.length === 1 ? "" : "s"} for “${query}”.`
                : `Showing ${rows.length} customer accounts (maximum 500).`}
            </p>
          </div>
        </div>

        <form
          action="/admin/customers"
          method="get"
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: "0.75rem",
            alignItems: "center",
            marginBottom: "1.25rem",
          }}
        >
          <label htmlFor="customer-search" className="muted">
            Search email or exact customer ID
          </label>
          <input
            id="customer-search"
            name="q"
            type="search"
            defaultValue={query}
            placeholder="name@example.com or customer UUID"
            maxLength={100}
            style={{
              flex: "1 1 260px",
              minWidth: 0,
              padding: "0.7rem 0.85rem",
              border: "1px solid var(--border, #d1d5db)",
              borderRadius: "8px",
              background: "var(--input, transparent)",
              color: "inherit",
            }}
          />
          <button className="button" type="submit">
            Search customers
          </button>
          {query ? (
            <Link className="button button-secondary" href="/admin/customers">
              Clear search
            </Link>
          ) : null}
        </form>

        {!error && !relatedDataError && rows.length > 0 ? (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
              gap: "0.75rem",
              marginBottom: "1.25rem",
            }}
          >
            <div className="panel" style={{ padding: "1rem" }}>
              <p className="muted">Customers in results</p>
              <h2>{rows.length}</h2>
            </div>
            <div className="panel" style={{ padding: "1rem" }}>
              <p className="muted">Combined wallet balance</p>
              <h2>{money(totalWalletPence)}</h2>
            </div>
            <div className="panel" style={{ padding: "1rem" }}>
              <p className="muted">Orders in results</p>
              <h2>{totalOrders}</h2>
            </div>
          </div>
        ) : null}

        {error ? (
          <p className="error-message">
            Customers could not be loaded. Check the server logs.
          </p>
        ) : relatedDataError ? (
          <p className="error-message">
            Customer accounts loaded, but wallet balances or order counts could
            not be loaded. Check the database schema and server logs.
          </p>
        ) : rows.length === 0 ? (
          <p className="muted">
            {query
              ? "No customers matched that search. Try part of an email address or an exact customer ID."
              : "No customer accounts found."}
          </p>
        ) : (
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Email</th>
                  <th>Registered</th>
                  <th>Wallet balance</th>
                  <th>Total orders</th>
                  <th>Customer ID</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((customer) => (
                  <tr key={customer.id}>
                    <td>
                      {customer.email ? (
                        <a href={`mailto:${customer.email}`}>
                          {customer.email}
                        </a>
                      ) : (
                        "No email"
                      )}
                    </td>
                    <td>
                      {customer.created_at
                        ? new Date(customer.created_at).toLocaleDateString("en-GB")
                        : "Unknown"}
                    </td>
                    <td>{money(customer.balance)}</td>
                    <td>{customer.orderCount}</td>
                    <td>
                      <span className="muted">{customer.id}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <p className="muted" style={{ marginTop: "1rem", fontSize: "0.875rem" }}>
          Wallet totals and order counts are calculated for the customers currently shown.
          This page does not change customer accounts or wallet funds.
        </p>
      </section>
    </main>
  );
}

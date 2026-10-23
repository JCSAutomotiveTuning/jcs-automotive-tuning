import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

const money = (pence: number) =>
  new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
  }).format(pence / 100);

export default async function AdminCustomersPage() {
  const supabase = createClient();

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

  const { data: customers, error } = await admin
    .from("profiles")
    .select("id,email,created_at")
    .eq("role", "customer")
    .order("created_at", { ascending: false })
    .limit(500);

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

  const relatedDataError =
    walletsResult.error || ordersResult.error;

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

  return (
    <main className="admin-shell">
      <header className="admin-header">
        <div>
          <p className="eyebrow">JCS AUTOMOTIVE TUNING</p>
          <h1>Customers</h1>
          <p className="muted">
            Customer accounts, wallet balances and order history.
          </p>
        </div>

        <Link className="button button-secondary" href="/admin">
          Back to overview
        </Link>
      </header>

      <section className="panel">
        <div className="panel-header">
          <div>
            <h2>Customer accounts</h2>
            <p className="muted">
              Showing {rows.length} customer accounts.
            </p>
          </div>
        </div>

        {error ? (
          <p className="error-message">
            Customers could not be loaded. Check the server logs.
          </p>
        ) : relatedDataError ? (
          <p className="error-message">
            Customer accounts loaded, but wallet balances or order counts
            could not be loaded. Check the database schema and server logs.
          </p>
        ) : rows.length === 0 ? (
          <p className="muted">No customer accounts found.</p>
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
                    <td>{customer.email ?? "No email"}</td>
                    <td>
                      {customer.created_at
                        ? new Date(customer.created_at).toLocaleDateString(
                            "en-GB"
                          )
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
      </section>
    </main>
  );
}
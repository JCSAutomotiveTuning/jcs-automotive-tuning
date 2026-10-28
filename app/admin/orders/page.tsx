
import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import OrdersManager from "./OrdersManager";

export const dynamic = "force-dynamic";

export default async function AdminOrdersPage() {
  const supabase = await createClient();

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    redirect("/login");
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (profileError || profile?.role !== "admin") {
    redirect("/dashboard");
  }

  const admin = createAdminClient();

  const { data: orders, error } = await admin
    .from("orders")
    .select(
      "id,user_id,service_code,service_name,amount_pence,currency,status,payment_status,vehicle_make,vehicle_model,engine_code,software_id,customer_notes,admin_notes,created_at,checkout_session_id"
    )
    .order("created_at", { ascending: false })
    .limit(200);

  if (error) {
    console.error("Admin orders page query failed:", error.message);
  }

  const userIds = [
    ...new Set((orders ?? []).map((order) => order.user_id)),
  ];

  let emailByUserId: Record<string, string> = {};

  if (userIds.length > 0) {
    const { data: profiles, error: profilesError } = await admin
      .from("profiles")
      .select("id,email")
      .in("id", userIds);

    if (profilesError) {
      console.error(
        "Admin customer profiles query failed:",
        profilesError.message
      );
    } else {
      emailByUserId = Object.fromEntries(
        (profiles ?? []).map((item) => [
          item.id,
          item.email ?? "Unknown customer",
        ])
      );
    }
  }

  const rows = (orders ?? []).map((order) => ({
    ...order,
    customer_email: emailByUserId[order.user_id] ?? "Unknown customer",
  }));

  return (
    <main className="admin-shell">
      <header className="admin-header">
        <div>
          <p className="eyebrow">JCS AUTOMOTIVE TUNING</p>
          <h1>Orders Management</h1>
          <p className="muted">
            Review customer submissions, set custom quotes, and manage job
            progress.
          </p>
        </div>

        <Link className="button button-secondary" href="/admin">
          Back to overview
        </Link>
      </header>

      <section className="panel">
        <div className="panel-header">
          <div>
            <h2>Customer orders</h2>
            <p className="muted">
              Showing the latest {rows.length} orders.
            </p>
          </div>
        </div>

        {error ? (
          <p className="error-message">
            Orders could not be loaded. Check the server logs.
          </p>
        ) : (
          <OrdersManager initialOrders={rows} />
        )}
      </section>
    </main>
  );
}

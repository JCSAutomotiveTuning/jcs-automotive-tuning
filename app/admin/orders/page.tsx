import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import OrdersManager from "./OrdersManager";

export const dynamic = "force-dynamic";

export default async function AdminOrdersPage() {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) redirect("/login");

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();
  if (profileError || profile?.role !== "admin") redirect("/dashboard");

  const admin = createAdminClient();
  const { data: orders, error } = await admin.from("orders")
    .select("id,user_id,service_code,service_name,amount_pence,currency,status,payment_status,vehicle_make,vehicle_model,engine_code,software_id,customer_notes,admin_notes,created_at,updated_at")
    .order("created_at", { ascending: false })
    .limit(200);
  if (error) {
    console.error("Admin orders page query failed:", error.message);
    throw new Error("Unable to load tuning orders.");
  }

  const ids = Array.from(new Set((orders ?? []).map((order) => order.user_id)));
  let emails: Record<string, string> = {};
  if (ids.length) {
    const { data: customers, error: customersError } = await admin.from("profiles")
      .select("id,email")
      .in("id", ids);
    if (customersError) {
      console.error("Order customer lookup failed:", customersError.message);
      throw new Error("Unable to load order customers.");
    }
    emails = Object.fromEntries((customers ?? []).map((customer) => [customer.id, customer.email ?? "Unknown customer"]));
  }

  const initialOrders = (orders ?? []).map((order) => ({
    ...order,
    customer_email: emails[order.user_id] ?? "Unknown customer",
  }));
  return <OrdersManager initialOrders={initialOrders} />;
}

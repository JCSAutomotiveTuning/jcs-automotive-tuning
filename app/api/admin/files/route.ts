import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

async function getAdmin() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { response: NextResponse.json({ error: "Sign in required." }, { status: 401 }) };

  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle();
  if (profile?.role !== "admin") return { response: NextResponse.json({ error: "Administrator access required." }, { status: 403 }) };

  return { user, admin: createAdminClient() };
}

export async function GET() {
  const auth = await getAdmin();
  if ("response" in auth) return auth.response;

  const { data: files, error } = await auth.admin
    .from("order_files")
    .select("id,order_id,user_id,storage_path,original_filename,size_bytes,kind,scan_status,sha256,created_at")
    .order("created_at", { ascending: false })
    .limit(300);

  if (error) {
    console.error("Admin files query failed:", error.message);
    return NextResponse.json({ error: "Could not load tuning files." }, { status: 500 });
  }

  const rows = files ?? [];
  const userIds = [...new Set(rows.map((f) => f.user_id))];
  const orderIds = [...new Set(rows.map((f) => f.order_id))];

  const [profilesResult, ordersResult] = await Promise.all([
    userIds.length ? auth.admin.from("profiles").select("id,email").in("id", userIds) : Promise.resolve({ data: [], error: null }),
    orderIds.length ? auth.admin.from("orders").select("id,service_name,vehicle_make,vehicle_model").in("id", orderIds) : Promise.resolve({ data: [], error: null }),
  ]);

  if (profilesResult.error || ordersResult.error) {
    return NextResponse.json({ error: "Could not load file details." }, { status: 500 });
  }

  const emails = Object.fromEntries((profilesResult.data ?? []).map((p) => [p.id, p.email]));
  const orders = Object.fromEntries((ordersResult.data ?? []).map((o) => [o.id, o]));

  return NextResponse.json({
    files: rows.map((f) => ({
      ...f,
      customer_email: emails[f.user_id] ?? "Unknown customer",
      order: orders[f.order_id] ?? null,
    })),
  });
}

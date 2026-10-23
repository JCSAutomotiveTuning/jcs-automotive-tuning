import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export async function GET() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Sign in required." }, { status: 401 });

  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle();
  if (profile?.role !== "admin") return NextResponse.json({ error: "Administrator access required." }, { status: 403 });

  const admin = createAdminClient();
  const { data: transactions, error } = await admin
    .from("wallet_transactions")
    .select("id,user_id,amount_pence,transaction_type,stripe_session_id,description,created_at,order_id")
    .order("created_at", { ascending: false })
    .limit(500);

  if (error) {
    console.error("Admin transactions query failed:", error.message);
    return NextResponse.json({ error: "Could not load transactions." }, { status: 500 });
  }

  const rows = transactions ?? [];
  const userIds = [...new Set(rows.map((t) => t.user_id))];
  const { data: profiles, error: profilesError } = userIds.length
    ? await admin.from("profiles").select("id,email").in("id", userIds)
    : { data: [], error: null };

  if (profilesError) return NextResponse.json({ error: "Could not load customer details." }, { status: 500 });

  const emails = Object.fromEntries((profiles ?? []).map((p) => [p.id, p.email]));
  return NextResponse.json({
    transactions: rows.map((t) => ({ ...t, customer_email: emails[t.user_id] ?? "Unknown customer" })),
  });
}

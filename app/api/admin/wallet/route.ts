import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

async function getAdmin() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { response: NextResponse.json({ error: "Sign in required." }, { status: 401 }) };

  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle();
  if (profile?.role !== "admin") return { response: NextResponse.json({ error: "Administrator access required." }, { status: 403 }) };

  return { user, admin: createAdminClient() };
}

export async function GET() {
  const auth = await getAdmin();
  if ("response" in auth) return auth.response;

  const [profilesResult, walletsResult] = await Promise.all([
    auth.admin.from("profiles").select("id,email,created_at").eq("role", "customer").order("created_at", { ascending: false }).limit(500),
    auth.admin.from("customer_wallets").select("user_id,balance_pence,updated_at"),
  ]);

  if (profilesResult.error || walletsResult.error) {
    return NextResponse.json({ error: "Could not load wallets." }, { status: 500 });
  }

  const wallets = Object.fromEntries((walletsResult.data ?? []).map((w) => [w.user_id, w]));
  return NextResponse.json({
    customers: (profilesResult.data ?? []).map((p) => ({
      ...p,
      wallet: wallets[p.id] ?? { user_id: p.id, balance_pence: 0, updated_at: null },
    })),
  });
}

const schema = z.object({
  userId: z.string().uuid(),
  amountPence: z.number().int().min(-1000000).max(1000000).refine((n) => n !== 0),
  reason: z.string().trim().min(1).max(500),
});

export async function POST(req: Request) {
  const auth = await getAdmin();
  if ("response" in auth) return auth.response;

  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Enter a customer, a non-zero amount up to £10,000, and a reason." }, { status: 400 });

  const { userId, amountPence, reason } = parsed.data;
  const { data, error } = await auth.admin.rpc("admin_adjust_wallet", {
    p_user_id: userId,
    p_actor_id: auth.user.id,
    p_amount_pence: amountPence,
    p_reason: reason,
  });

  if (error) {
    console.error("Wallet adjustment failed:", error.message);
    return NextResponse.json({ error: error.message.includes("negative") ? "This adjustment would make the wallet balance negative." : "Could not apply wallet adjustment." }, { status: 400 });
  }

  return NextResponse.json({ balancePence: data });
}


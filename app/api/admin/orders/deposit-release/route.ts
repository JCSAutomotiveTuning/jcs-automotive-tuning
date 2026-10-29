import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
const schema = z.object({ orderId: z.string().uuid(), confirmation: z.literal("RELEASE_DEPOSIT") });
export async function POST(req: Request) {
  if (process.env.JCS_WALLET_DEPOSITS_ENABLED !== "true")
    return NextResponse.json({ error: "Deposit wallet is not enabled." }, { status: 503 });
  const site = process.env.NEXT_PUBLIC_SITE_URL;
  const origin = req.headers.get("origin");
  if (origin && (!site || new URL(origin).origin !== new URL(site).origin))
    return NextResponse.json({ error: "Invalid request origin." }, { status: 403 });
  const supabase=await createClient();
  const { data: { user } }=await supabase.auth.getUser();
  if(!user) return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  const { data: profile }=await supabase.from("profiles").select("role").eq("id",user.id).maybeSingle();
  if(profile?.role!=="admin") return NextResponse.json({ error: "Admin access required." }, { status: 403 });
  const parsed=schema.safeParse(await req.json().catch(()=>null));
  if(!parsed.success) return NextResponse.json({ error: "Confirmation required." }, { status: 400 });
  const admin=createAdminClient();
  const { data: result,error }=await admin.rpc("release_cancelled_order_deposit",{p_order_id:parsed.data.orderId});
  if(error || !["released","already_released"].includes(result))
    return NextResponse.json({ error:"Deposit could not be returned. Check that the order is cancelled and still unpaid." }, { status:409 });
  if(result==="released") {
    const { error: auditError }=await admin.from("order_audit").insert({
      order_id:parsed.data.orderId,actor_id:user.id,action:"admin_order_updated",
      details:{action_type:"wallet_deposit_released",amount_pence:2000}
    });
    if(auditError) return NextResponse.json({ error:"Deposit returned but audit reconciliation is required. Do not retry blindly." }, {status:500});
  }
  return NextResponse.json({ok:true,result});
}

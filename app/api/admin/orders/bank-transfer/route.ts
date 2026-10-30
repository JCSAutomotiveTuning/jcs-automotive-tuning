import {NextResponse} from "next/server";
import {z} from "zod";
import {createClient} from "@/lib/supabase/server";
import {createAdminClient} from "@/lib/supabase/admin";
export const runtime="nodejs";
const schema=z.object({orderId:z.string().uuid(),bankReference:z.string().trim().min(3).max(120)});
export async function POST(req:Request){
 const auth=await createClient();const {data:{user}}=await auth.auth.getUser();
 if(!user)return NextResponse.json({error:"Sign in."},{status:401});
 const {data:profile}=await auth.from("profiles").select("role").eq("id",user.id).maybeSingle();
 if(profile?.role!=="admin")return NextResponse.json({error:"Admin access required."},{status:403});
 const input=schema.safeParse(await req.json().catch(()=>null));
 if(!input.success)return NextResponse.json({error:"Provide order and actual bank transaction reference."},{status:400});
 const admin=createAdminClient();
 const {data:pending,error:lookupError}=await admin.from("order_bank_transfers").select("order_id,reference,amount_pence,state").eq("order_id",input.data.orderId).maybeSingle();
 if(lookupError||!pending)return NextResponse.json({error:"No bank transfer request for this order."},{status:404});
 if(pending.state!=="awaiting_transfer")return NextResponse.json({error:"This transfer has already been reviewed."},{status:409});
 const {data:result,error}=await admin.rpc("confirm_manual_bank_transfer",{p_order_id:input.data.orderId,p_admin_id:user.id,p_bank_reference:input.data.bankReference});
 if(error||result!=="confirmed"){console.error("Bank transfer confirmation failed:",error?.code,error?.message);return NextResponse.json({error:"Could not confirm this transfer. Review amount, payment state and bank receipt."},{status:409});}
 return NextResponse.json({ok:true,orderId:input.data.orderId,paymentStatus:"paid"});
}

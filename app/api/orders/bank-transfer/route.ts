import {NextResponse} from "next/server";
import {z} from "zod";
import {createClient} from "@/lib/supabase/server";
import {createAdminClient} from "@/lib/supabase/admin";
export const runtime="nodejs";
export const dynamic="force-dynamic";
const schema=z.object({orderId:z.string().uuid()});
async function handler(req:Request){
 const auth=await createClient();
 const {data:{user},error:authError}=await auth.auth.getUser();
 if(authError||!user)return NextResponse.json({error:"Sign in first."},{status:401});
 const input=schema.safeParse(await req.json().catch(()=>null));
 if(!input.success)return NextResponse.json({error:"Invalid order."},{status:400});
 const holder=(process.env.JCS_BANK_ACCOUNT_NAME||"").trim(),sort=(process.env.JCS_BANK_SORT_CODE||"").replace(/\D/g,""),number=(process.env.JCS_BANK_ACCOUNT_NUMBER||"").replace(/\D/g,"");
 if(!holder||!/^[0-9]{6}$/.test(sort)||!/^[0-9]{8}$/.test(number))return NextResponse.json({error:"Bank transfer is not configured yet. Please use card payment."},{status:503});
 const admin=createAdminClient();
 const {data:order,error}=await admin.from("orders").select("id,user_id,amount_pence,deposit_pence,currency,status,payment_status,checkout_attempt_id,checkout_session_id").eq("id",input.data.orderId).eq("user_id",user.id).maybeSingle();
 if(error||!order)return NextResponse.json({error:"Order not found."},{status:404});
 if(order.currency!=="GBP"||order.status!=="awaiting_payment"||order.payment_status!=="unpaid")return NextResponse.json({error:"This order is not awaiting payment."},{status:409});
 // A reserved or active Stripe checkout cannot coexist with a bank transfer.
 if(order.checkout_attempt_id||order.checkout_session_id)return NextResponse.json({error:"A card checkout already exists for this order. Ask JCS to reconcile or expire it before paying by bank transfer."},{status:409});
 const amount=Math.max(0,order.amount_pence-(order.deposit_pence||0));
 if(amount<=0)return NextResponse.json({error:"No outstanding bank transfer balance."},{status:409});
 const ref="JCS-"+order.id.replace(/-/g,"").slice(0,16).toUpperCase();
 const {data:reservation,error:reservationError}=await admin.rpc("reserve_order_bank_transfer",{
   p_order_id:order.id,p_user_id:user.id,p_amount_pence:amount,p_reference:ref
 });
 if(reservationError){console.error("Bank transfer reservation failed:",reservationError.code,reservationError.message);
  return NextResponse.json({error:"Could not safely reserve bank payment. Contact JCS."},{status:503});}
 if(!["created","existing"].includes(reservation)){
  return NextResponse.json({error:reservation==="card_checkout_exists"?"Card checkout already reserved. Contact JCS before bank transfer.":"Bank transfer needs reconciliation before payment."},{status:409});}
 return NextResponse.json({accountName:holder,sortCode:sort.slice(0,2)+"-"+sort.slice(2,4)+"-"+sort.slice(4),accountNumber:number,reference:ref,amountPence:amount,currency:"GBP",notice:"Pay by bank transfer using the exact reference. Your order remains unpaid and files locked until JCS manually verifies cleared funds in the business bank account."},{headers:{"Cache-Control":"private, no-store"}});
}
export async function POST(req:Request){return handler(req);}

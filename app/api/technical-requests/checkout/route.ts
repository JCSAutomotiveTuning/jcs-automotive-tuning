import { NextResponse } from "next/server";
import Stripe from "stripe";
import { technicalServices,technicalUser,uuidPattern } from "@/lib/technical-requests";
import { createAdminClient } from "@/lib/supabase/admin";
export const runtime="nodejs";
export async function POST(req:Request){
 const user=await technicalUser();if(!user)return NextResponse.json({error:"Sign in required"},{status:401});
 const body=await req.json().catch(()=>null);const id=body?.id;
 if(typeof id!=="string"||!uuidPattern.test(id))return NextResponse.json({error:"Invalid request"},{status:400});
 const {data:r,error}=await createAdminClient().from("technical_requests").select("id,user_id,service_type,amount_pence,currency,status,payment_status").eq("id",id).eq("user_id",user.id).maybeSingle();
 if(error||!r)return NextResponse.json({error:"Request not found"},{status:404});
 if(r.status!=="awaiting_payment"||r.payment_status!=="unpaid"||r.amount_pence!==1500||r.currency!=="GBP")return NextResponse.json({error:"Request is not payable"},{status:409});
 if(!process.env.STRIPE_SECRET_KEY)return NextResponse.json({error:"Stripe not configured"},{status:503});
 const base=process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/+$/,'')||new URL(req.url).origin;
 const stripe=new Stripe(process.env.STRIPE_SECRET_KEY);
 const session=await stripe.checkout.sessions.create({mode:"payment",client_reference_id:user.id,customer_email:user.email,
 metadata:{type:"technical_request",request_id:r.id,user_id:user.id},
 line_items:[{quantity:1,price_data:{currency:"gbp",unit_amount:1500,product_data:{name:technicalServices[r.service_type as keyof typeof technicalServices]}}}],
 success_url:`${base}/dashboard/technical-requests?payment=success`,cancel_url:`${base}/dashboard/technical-requests?payment=cancelled`
 },{idempotencyKey:`technical-checkout-${r.id}-${crypto.randomUUID()}`});
 return NextResponse.json({url:session.url});
}

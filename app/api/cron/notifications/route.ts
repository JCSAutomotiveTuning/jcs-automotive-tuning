import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
type Event = { id:string;user_id:string;event_type:string;payload:Record<string,unknown>;attempts:number };
const gbp = (n:number)=>new Intl.NumberFormat("en-GB",{style:"currency",currency:"GBP"}).format(n/100);
function safeUrl():string {const raw=process.env.NEXT_PUBLIC_SITE_URL; if(!raw)throw new Error("NEXT_PUBLIC_SITE_URL missing");const url=new URL(raw);if(url.protocol!=="https:" && url.hostname!=="localhost")throw new Error("Site URL must use HTTPS");return url.origin;}
async function email(to:string,subject:string,body:string, key:string):Promise<string> {
 const api=process.env.RESEND_API_KEY;const from=process.env.NOTIFICATION_FROM_EMAIL;
 if(!api||!from)throw new Error("Resend email not configured");
 const r=await fetch("https://api.resend.com/emails",{method:"POST",headers:{Authorization:`Bearer ${api}`,"Content-Type":"application/json","Idempotency-Key":key},body:JSON.stringify({from,to,subject,text:body})});
 const data=await r.json().catch(()=>({}));if(!r.ok)throw new Error(`Resend HTTP ${r.status}`);
 return typeof data.id==="string"?data.id:"accepted";
}
async function sms(to:string,body:string):Promise<string> {
 const sid=process.env.TWILIO_ACCOUNT_SID;const token=process.env.TWILIO_AUTH_TOKEN;const from=process.env.TWILIO_FROM_NUMBER;
 if(!sid||!token||!from)throw new Error("Twilio SMS not configured");
 const params=new URLSearchParams({To:to,From:from,Body:body});
 const r=await fetch(`https://api.twilio.com/2010-04-01/Accounts/${encodeURIComponent(sid)}/Messages.json`,{method:"POST",headers:{Authorization:`Basic ${Buffer.from(`${sid}:${token}`).toString("base64")}`,"Content-Type":"application/x-www-form-urlencoded"},body:params.toString()});
 const data=await r.json().catch(()=>({}));if(!r.ok)throw new Error(`Twilio HTTP ${r.status}`);
 return typeof data.sid==="string"?data.sid:"accepted";
}
export async function GET(req:Request) {
 const secret=process.env.CRON_SECRET;
 if(!secret||req.headers.get("authorization")!==`Bearer ${secret}`)return NextResponse.json({error:"Unauthorized"},{status:401});
 const db=createAdminClient();const {data:claimed,error:claimError}=await db.rpc("jcs_claim_notifications",{p_limit:10});
 if(claimError){console.error("Notification claim failed",claimError.message);return NextResponse.json({error:"Queue unavailable"},{status:500});}
 let sent=0,failed=0;
 for(const event of (claimed??[]) as Event[]) {
  try {
   const {data:profile,error:profileError}=await db.from("profiles").select("email").eq("id",event.user_id).maybeSingle();
   const {data:pref,error:prefError}=await db.from("notification_preferences").select("email_enabled,sms_enabled,phone_e164,phone_verified_at").eq("user_id",event.user_id).maybeSingle();
   if(profileError||prefError)throw new Error("Recipient lookup failed");
   let subject="JCS Automotive Tuning notification";let body="";
   if(event.event_type==="wallet_adjustment") {
    const amount=Number(event.payload.amount_pence);
    if(!Number.isSafeInteger(amount)||amount===0)throw new Error("Invalid wallet event");
    subject="Your JCS wallet balance has changed";
    body=`Your JCS Automotive Tuning wallet was ${amount>0?"credited":"debited"} ${gbp(Math.abs(amount))}. Sign in to view your current balance: ${safeUrl()}/dashboard`;
   } else if(event.event_type==="file_ready") {
    const orderId=String(event.payload.order_id??"");
    const {data:order,error:orderError}=await db.from("orders").select("status,payment_status,amount_pence,user_id").eq("id",orderId).maybeSingle();
    const {data:files,error:filesError}=await db.from("order_files").select("id").eq("order_id",orderId).eq("kind","completed_output").eq("scan_status","clean").limit(1);
    if(orderError||filesError)throw new Error("Order readiness lookup failed");
    if(!order||order.user_id!==event.user_id||order.payment_status!=="unpaid"||order.status!=="awaiting_payment"||!files?.length){
     await db.from("notification_outbox").update({status:"sent",sent_at:new Date().toISOString(),last_error:"No longer payable/ready; skipped"}).eq("id",event.id);continue;
    }
    subject="Your JCS tuning file is ready for payment";
    body=`Your tuning file is ready. Payment of ${gbp(order.amount_pence)} is required to unlock your file. Sign in and pay securely through your portal: ${safeUrl()}/dashboard. We never ask for card details by email or SMS.`;
   } else throw new Error("Unknown event type");
   const channels: Array<{name:"email"|"sms";enabled:boolean;destination:string|null}>= [
    {name:"email",enabled:pref?.email_enabled??true,destination:profile?.email??null},
    {name:"sms",enabled:Boolean(pref?.sms_enabled&&pref.phone_verified_at),destination:pref?.phone_e164??null},
   ];
   let hasFailure=false;
   for(const ch of channels) {
    if(!ch.enabled||!ch.destination)continue;
    const {data:prior,error:priorError}=await db.from("notification_deliveries").select("status").eq("outbox_id",event.id).eq("channel",ch.name).maybeSingle();
    if(priorError)throw new Error("Delivery lookup failed");
    if(prior?.status==="sent")continue;
    try {
     const providerId=ch.name==="email"?await email(ch.destination,subject,body,`jcs-${event.id}-email`):await sms(ch.destination,body);
     const {error:writeError}=await db.from("notification_deliveries").upsert({outbox_id:event.id,channel:ch.name,status:"sent",provider_id:providerId,error:null},{onConflict:"outbox_id,channel"});
     if(writeError)throw new Error("Delivery record failed");
    } catch(e) {
     hasFailure=true;console.error("Notification channel failed",event.id,ch.name,e instanceof Error?e.message:"unknown");
     await db.from("notification_deliveries").upsert({outbox_id:event.id,channel:ch.name,status:"failed",error:e instanceof Error?e.message:"unknown"},{onConflict:"outbox_id,channel"});
    }
   }
   if(hasFailure)throw new Error("One or more channels failed");
   const {error:updateError}=await db.from("notification_outbox").update({status:"sent",sent_at:new Date().toISOString(),last_error:null,locked_at:null}).eq("id",event.id);
   if(updateError)throw new Error("Queue update failed");sent++;
  }catch(e){failed++;const message=e instanceof Error?e.message:"Unknown delivery failure";
   console.error("Notification processing failed",event.id,message);
   const terminal=event.attempts>=5;
   await db.from("notification_outbox").update({status:terminal?"failed":"pending",next_attempt_at:new Date(Date.now()+Math.min(60,2**event.attempts)*60000).toISOString(),last_error:message,locked_at:null}).eq("id",event.id);
  }
 }
 return NextResponse.json({processed:(claimed??[]).length,sent,failed});
}

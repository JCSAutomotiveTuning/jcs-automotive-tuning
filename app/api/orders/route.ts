import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isServiceCode, SERVICES } from "@/lib/pricing";
import { ADDON_LABELS, addonPrice, parseDtcCodes, DTC_REVIEW_PRICE_PENCE } from "@/lib/tuning-addons";

const schema = z.object({
  serviceCode: z.string(),
  vehicleMake: z.string().trim().min(1).max(60),
  vehicleModel: z.string().trim().min(1).max(80),
  engineCode: z.string().trim().max(80).optional().default(""),
  softwareId: z.string().trim().max(120).optional().default(""),
  notes: z.string().trim().max(2500).optional().default(""),
  fuelType: z.enum(["petrol","diesel"]).nullable().optional(),
  addons: z.array(z.string()).max(24).optional().default([]),
  dtcReview: z.boolean().optional().default(false),
  dtcCodes: z.string().max(100).optional().default(""),
});

export async function POST(req: Request) {
  const supabase = await createClient();
  const {data:{user}} = await supabase.auth.getUser();
  if(!user) return NextResponse.json({error:"Please sign in first."},{status:401});

  const parsed=schema.safeParse(await req.json().catch(()=>null));
  if(!parsed.success) return NextResponse.json({error:"Please check the submitted fields."},{status:400});
  const v=parsed.data;
  if(!isServiceCode(v.serviceCode)) return NextResponse.json({error:"Unsupported service."},{status:400});

  const tcuOnly = v.serviceCode==="dsg_tcu" || v.serviceCode==="custom_tcu";
  const reviewOnly = v.serviceCode==="log_review" || v.serviceCode==="datalog_analysis" || v.serviceCode==="emissions_diagnostics";
  const ecuAllowed = !tcuOnly && !reviewOnly;
  const tcuAllowed = tcuOnly || v.serviceCode==="ecu_tcu_package" || v.serviceCode==="addons_only";
  const unique = [...new Set(v.addons)];
  if(unique.some(key=>{
    if(!(key in ADDON_LABELS)) return true;
    const group=key.split(":")[0];
    if (group === "diagnostics") return reviewOnly;
    return group==="tcu" ? !tcuAllowed : !ecuAllowed || group!==v.fuelType;
  })) return NextResponse.json({error:"Invalid or incompatible add-on selection."},{status:400});

  if(v.serviceCode==="addons_only" && unique.length===0 && !v.dtcReview) return NextResponse.json({error:"Select at least one add-on or DTC review."},{status:400});
  const dtcCodes = v.dtcReview ? parseDtcCodes(v.dtcCodes) : [];
  if (v.dtcReview && (!dtcCodes || reviewOnly)) return NextResponse.json({error:"Enter 1-10 valid P or U DTC codes for an ECU or TCU service."},{status:400});
  if (!v.dtcReview && v.dtcCodes.trim()) return NextResponse.json({error:"Enable DTC review to submit fault codes."},{status:400});
  const service=SERVICES[v.serviceCode];
  const addonTotal=unique.reduce((sum,key)=>sum+(addonPrice(key)??0),0) + (v.dtcReview ? DTC_REVIEW_PRICE_PENCE : 0);
  const quoteRequired=["custom_ecu","custom_tcu","ecu_tcu_package","addons_only"].includes(v.serviceCode) ||
    unique.some(key=>addonPrice(key)===null);
  const addonsText=unique.length
    ? "\n\nRequested add-ons (pending compatibility and quotation):\n" +
      unique.map(key=>`- ${ADDON_LABELS[key]} [${key}]`).join("\n")
    : "";
  const fuelText=ecuAllowed && v.fuelType ? `\nFuel type: ${v.fuelType}` : "";
  const dtcText = dtcCodes?.length ? `\nDTC review requested (GBP 30.00 fixed for ${dtcCodes.length} code(s)): ${dtcCodes.join(", ")}\nDTC requests subject to diagnostics, safety and legal compliance.` : "";
  const pricingText=`\nIndicative priced add-ons: GBP ${(addonTotal/100).toFixed(2)}` +
    (quoteRequired ? "\nFINAL PRICE REQUIRES MANUAL CONFIRMATION - DO NOT TAKE PAYMENT YET." : "");
  const customerNotes=`${v.notes}${fuelText}${addonsText}${dtcText}${pricingText}`.trim();
  if(customerNotes.length>3000) return NextResponse.json({error:"Please shorten notes or reduce add-on selections."},{status:400});

  if (process.env.JCS_WALLET_DEPOSITS_ENABLED === "true") {
    const admin = createAdminClient();
    const { data: orderId, error: depositError } = await admin.rpc("create_wallet_deposit_order", {
      p_user_id: user.id, p_service_code: v.serviceCode, p_service_name: service.name,
      p_amount_pence: quoteRequired ? 0 : service.pricePence + addonTotal,
      p_vehicle_make: v.vehicleMake, p_vehicle_model: v.vehicleModel,
      p_engine_code: v.engineCode || null, p_software_id: v.softwareId || null,
      p_customer_notes: customerNotes || null,
    });
    if (depositError || !orderId) {
      const message = depositError?.message ?? "";
      if (message.includes("Insufficient wallet credit"))
        return NextResponse.json({ error: "Add at least £20 wallet credit before submitting a job." }, { status: 402 });
      if (message.includes("Active order limit"))
        return NextResponse.json({ error: "You can have at most three open jobs. Finish an existing job before submitting another." }, { status: 429 });
      console.error("Deposit-backed order submission failed:", depositError?.message);
      return NextResponse.json({ error: "Could not reserve your £20 deposit. No new order was created." }, { status: 503 });
    }
    return NextResponse.json({
      order: { id: orderId, status: "awaiting_review", payment_status: "unpaid",
        amount_pence: quoteRequired ? 0 : service.pricePence + addonTotal, service_code: v.serviceCode },
      quoteRequired, depositPence: 2000,
      message: "Job submitted. Your £20 wallet deposit is credited toward the final service price.",
    });
  }

  const {data:order,error}=await createAdminClient().from("orders").insert({
    user_id:user.id,
    service_code:v.serviceCode,
    service_name:service.name,
    // Server-calculated price. Custom-quote orders MUST NOT be checked out
    // before an admin confirms and updates the agreed final amount.
    // Quoted work has no payable amount until an administrator saves the agreed quote.
    amount_pence: quoteRequired ? 0 : service.pricePence + addonTotal,
    currency:"GBP",
    status:"awaiting_review",
    payment_status:"unpaid",
    vehicle_make:v.vehicleMake,
    vehicle_model:v.vehicleModel,
    engine_code:v.engineCode||null,
    software_id:v.softwareId||null,
    customer_notes:customerNotes||null,
  }).select("id,service_code,status,payment_status,amount_pence").single();
  if(error) {
    console.error("Order creation failed:",error);
    return NextResponse.json({error:"Could not create order. Check database setup."},{status:500});
  }
  return NextResponse.json({
    order,quoteRequired,
    message:quoteRequired
      ? "Request submitted. JCS must review add-ons and confirm a quote before work proceeds."
      : "Order submitted for review.",
  });
}

import { NextResponse } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { technicalUser } from "@/lib/technical-requests";
export const runtime="nodejs";
const schema=z.object({
 service_type:z.enum(["parts","wiring"]),registration:z.string().trim().min(2).max(12),
 make:z.enum(["Volkswagen","Audi","SEAT","Skoda","CUPRA"]),model:z.string().trim().min(1).max(100),
 model_year:z.coerce.number().int().min(1950).max(2100),
 vin:z.string().trim().toUpperCase().regex(/^[A-HJ-NPR-Z0-9]{17}$/).optional().or(z.literal("")),
 engine_code:z.string().trim().max(60).optional(),module_reference:z.string().trim().max(100).optional(),
 description:z.string().trim().min(10).max(5000)
});
export async function GET(){
 const user=await technicalUser();if(!user)return NextResponse.json({error:"Sign in required"},{status:401});
 const {data,error}=await createAdminClient().from("technical_requests").select("id,service_type,registration,make,model,model_year,vin,engine_code,module_reference,description,status,payment_status,amount_pence,created_at").eq("user_id",user.id).order("created_at",{ascending:false}).limit(100);
 if(error)return NextResponse.json({error:"Unable to load requests"},{status:500});
 return NextResponse.json({requests:data});
}
export async function POST(req:Request){
 const user=await technicalUser();if(!user)return NextResponse.json({error:"Sign in required"},{status:401});
 const body=await req.json().catch(()=>null);const parsed=schema.safeParse(body);
 if(!parsed.success)return NextResponse.json({error:"Check vehicle details, VIN and description."},{status:400});
 const input=parsed.data;
 const {data,error}=await createAdminClient().from("technical_requests").insert({
 user_id:user.id,service_type:input.service_type,registration:input.registration.toUpperCase().replace(/\s+/g,""),
 make:input.make,model:input.model,model_year:input.model_year,vin:input.vin||null,
 engine_code:input.engine_code||null,module_reference:input.module_reference||null,description:input.description
 }).select("id").single();
 if(error||!data)return NextResponse.json({error:"Unable to create request"},{status:500});
 return NextResponse.json({id:data.id},{status:201});
}

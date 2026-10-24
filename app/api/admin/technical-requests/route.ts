import { NextResponse } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { technicalAdmin,technicalUser,uuidPattern } from "@/lib/technical-requests";
export const runtime="nodejs";
export async function GET(){
 const user=await technicalUser();if(!user||!await technicalAdmin(user.id))return NextResponse.json({error:"Forbidden"},{status:403});
 const {data,error}=await createAdminClient().from("technical_requests").select("*").order("created_at",{ascending:false}).limit(200);
 if(error)return NextResponse.json({error:"Unable to load requests"},{status:500});return NextResponse.json({requests:data});
}
export async function PATCH(req:Request){
 const user=await technicalUser();if(!user||!await technicalAdmin(user.id))return NextResponse.json({error:"Forbidden"},{status:403});
 const parsed=z.object({id:z.string().uuid(),status:z.enum(["paid","in_progress","needs_customer_info","completed","cancelled"])}).safeParse(await req.json().catch(()=>null));
 if(!parsed.success)return NextResponse.json({error:"Invalid status"},{status:400});
 const {id,status}=parsed.data;if(!uuidPattern.test(id))return NextResponse.json({error:"Invalid ID"},{status:400});
 const admin=createAdminClient();const {data:r}=await admin.from("technical_requests").select("payment_status,status").eq("id",id).maybeSingle();
 if(!r)return NextResponse.json({error:"Not found"},{status:404});

 if (r.status === "cancelled") {
   return NextResponse.json({error:"Cancelled ticket cannot be reopened here"},{status:409});
 }
 if (r.payment_status !== "paid") {
   return NextResponse.json({error:"Payment must be confirmed before changing ticket status"},{status:409});
 }
 const {error}=await admin.from("technical_requests").update({status,updated_at:new Date().toISOString()}).eq("id",id);
 if(error)return NextResponse.json({error:"Unable to update ticket"},{status:500});return NextResponse.json({ok:true});
}

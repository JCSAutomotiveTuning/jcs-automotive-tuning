import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
export const runtime="nodejs";
const schema=z.object({id:z.string().uuid(),status:z.enum(["pending","accepted","in_progress","completed","cancelled"])});
export async function PATCH(req:Request){const s=await createClient();const {data:{user}}=await s.auth.getUser();if(!user)return NextResponse.json({error:"Sign in required"},{status:401});const {data:p}=await s.from("profiles").select("role").eq("id",user.id).maybeSingle();if(p?.role!=="admin")return NextResponse.json({error:"Admin access required"},{status:403});let body:unknown;try{body=await req.json()}catch{return NextResponse.json({error:"Invalid JSON"},{status:400})}const parsed=schema.safeParse(body);if(!parsed.success)return NextResponse.json({error:"Invalid request"},{status:400});const admin=createAdminClient();const {data,error}=await admin.from("jcs_remote_support_requests").update({status:parsed.data.status,updated_at:new Date().toISOString()}).eq("id",parsed.data.id).select("id").maybeSingle();if(error)return NextResponse.json({error:"Update failed"},{status:500});if(!data)return NextResponse.json({error:"Request not found"},{status:404});return NextResponse.json({ok:true})}

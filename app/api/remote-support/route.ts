import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
export const runtime="nodejs";
const schema=z.object({subject:z.string().trim().min(3).max(120),details:z.string().trim().min(10).max(3000),rustdeskId:z.string().trim().max(40).regex(/^[a-zA-Z0-9 -]*$/).optional().default("")});
export async function POST(req:Request){
 const supabase=await createClient();const {data:{user}}=await supabase.auth.getUser();if(!user)return NextResponse.json({error:"Sign in required"},{status:401});
 let body:unknown;try{body=await req.json()}catch{return NextResponse.json({error:"Invalid JSON"},{status:400})}
 const parsed=schema.safeParse(body);if(!parsed.success)return NextResponse.json({error:"Invalid request details"},{status:400});
 const {subject,details,rustdeskId}=parsed.data;
 const {error}=await supabase.from("jcs_remote_support_requests").insert({user_id:user.id,subject,details,rustdesk_id:rustdeskId||null});
 if(error)return NextResponse.json({error:"Could not save request. Check remote support migration."},{status:500});
 return NextResponse.json({ok:true},{status:201});
}

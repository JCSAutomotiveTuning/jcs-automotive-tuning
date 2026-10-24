import { NextResponse } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { technicalAdmin,technicalUser,uuidPattern } from "@/lib/technical-requests";
export const runtime="nodejs";
async function access(id:string,userId:string){
 const admin=createAdminClient();const {data:r}=await admin.from("technical_requests").select("id,user_id,status,payment_status").eq("id",id).maybeSingle();
 const isAdmin=await technicalAdmin(userId);return {r,allowed:!!r&&(r.user_id===userId||isAdmin),isAdmin};
}
export async function GET(_req:Request,{params}:{params:Promise<{id:string}>}){
 const {id}=await params;const user=await technicalUser();if(!user)return NextResponse.json({error:"Sign in required"},{status:401});
 if(!uuidPattern.test(id))return NextResponse.json({error:"Invalid ID"},{status:400});
 const a=await access(id,user.id);if(!a.allowed)return NextResponse.json({error:"Not found"},{status:404});
 const {data,error}=await createAdminClient().from("technical_request_messages").select("id,sender_role,body,created_at").eq("request_id",id).order("created_at").limit(200);
 if(error)return NextResponse.json({error:"Unable to load messages"},{status:500});return NextResponse.json({messages:data});
}
export async function POST(req:Request,{params}:{params:Promise<{id:string}>}){
 const {id}=await params;const user=await technicalUser();if(!user)return NextResponse.json({error:"Sign in required"},{status:401});
 if(!uuidPattern.test(id))return NextResponse.json({error:"Invalid ID"},{status:400});
 const a=await access(id,user.id);if(!a.allowed)return NextResponse.json({error:"Not found"},{status:404});
 if(a.r?.status==="cancelled")return NextResponse.json({error:"Ticket is closed"},{status:409});
 if(!a.isAdmin&&a.r?.payment_status!=="paid")return NextResponse.json({error:"Payment required"},{status:403});
 const parsed=z.object({body:z.string().trim().min(1).max(5000)}).safeParse(await req.json().catch(()=>null));
 if(!parsed.success)return NextResponse.json({error:"Message must be 1–5000 characters"},{status:400});
 const {error}=await createAdminClient().from("technical_request_messages").insert({request_id:id,sender_id:user.id,sender_role:a.isAdmin?"admin":"customer",body:parsed.data.body});
 if(error)return NextResponse.json({error:"Unable to save message"},{status:500});return NextResponse.json({ok:true});
}

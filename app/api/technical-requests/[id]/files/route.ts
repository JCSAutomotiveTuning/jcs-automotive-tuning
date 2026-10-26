import { NextResponse } from "next/server";
import {createAdminClient} from "@/lib/supabase/admin";
import {technicalAdmin,technicalUser,uuidPattern} from "@/lib/technical-requests";
export const runtime="nodejs";
export async function GET(_req:Request,{params}:{params:Promise<{id:string}>}){
 const {id}=await params;const user=await technicalUser();if(!user)return NextResponse.json({error:"Sign in required"},{status:401});
 if(!uuidPattern.test(id))return NextResponse.json({error:"Invalid ticket"},{status:400});
 const admin=createAdminClient();const {data:r}=await admin.from("technical_requests").select("user_id,payment_status,status").eq("id",id).maybeSingle();
 if(!r||!(r.user_id===user.id||await technicalAdmin(user.id)))return NextResponse.json({error:"Not found"},{status:404});
 if(!(await technicalAdmin(user.id))&&(r.payment_status!=="paid"||r.status!=="completed"))return NextResponse.json({files:[]});
 const {data,error}=await admin.from("technical_request_files").select("id,file_name,created_at").eq("request_id",id).eq("scan_status","clean").not("storage_path","like",`${id}/customer-%`).order("created_at");
 if(error)return NextResponse.json({error:"Unable to load files"},{status:500});return NextResponse.json({files:data});
}


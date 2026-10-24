import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { technicalAdmin,technicalUser,uuidPattern } from "@/lib/technical-requests";
export const runtime="nodejs";
export async function GET(_req:Request,{params}:{params:Promise<{fileId:string}>}){
 const {fileId}=await params;const user=await technicalUser();if(!user)return NextResponse.json({error:"Sign in required"},{status:401});
 if(!uuidPattern.test(fileId))return NextResponse.json({error:"Invalid file"},{status:400});
 const admin=createAdminClient();const {data:file}=await admin.from("technical_request_files").select("storage_path,request_id").eq("id",fileId).maybeSingle();
 if(!file)return NextResponse.json({error:"Not found"},{status:404});
 const {data:r}=await admin.from("technical_requests").select("user_id,payment_status,status").eq("id",file.request_id).maybeSingle();
 const isAdmin=await technicalAdmin(user.id);
 if(!r||(!isAdmin&&(r.user_id!==user.id||r.payment_status!=="paid"||r.status!=="completed")))return NextResponse.json({error:"Not found"},{status:404});
 const {data,error}=await admin.storage.from("technical-deliverables").createSignedUrl(file.storage_path,60);
 if(error||!data?.signedUrl)return NextResponse.json({error:"Download unavailable"},{status:500});
 return NextResponse.redirect(data.signedUrl,302);
}

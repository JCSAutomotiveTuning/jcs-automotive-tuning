import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { technicalAdmin,technicalUser,uuidPattern } from "@/lib/technical-requests";
export const runtime="nodejs";
const allowed=new Set(["application/pdf","text/plain","text/csv","image/png","image/jpeg","application/zip"]);
export async function POST(req:Request,{params}:{params:Promise<{id:string}>}){
 const {id}=await params;const user=await technicalUser();if(!user||!await technicalAdmin(user.id))return NextResponse.json({error:"Forbidden"},{status:403});
 if(!uuidPattern.test(id))return NextResponse.json({error:"Invalid ticket"},{status:400});
 const admin=createAdminClient();const {data:r}=await admin.from("technical_requests").select("id,payment_status,status").eq("id",id).maybeSingle();
 if (!r || r.status === "cancelled" || r.payment_status !== "paid") {
   return NextResponse.json({error:"Ticket must be paid and active before file delivery"},{status:409});
 }
 const form=await req.formData().catch(()=>null);const file=form?.get("file");
 if(!(file instanceof File)||file.size<1||file.size>10485760||!allowed.has(file.type))return NextResponse.json({error:"PDF, TXT, CSV, PNG, JPG or ZIP up to 10MB only"},{status:400});
 const safeName=file.name.replace(/[^a-zA-Z0-9._-]/g,"_").slice(0,100)||"attachment";
 const path=`${id}/${crypto.randomUUID()}-${safeName}`;
 const {error:uploadError}=await admin.storage.from("technical-deliverables").upload(path,file,{contentType:file.type,upsert:false});
 if(uploadError)return NextResponse.json({error:"Upload failed"},{status:500});
 const {error}=await admin.from("technical_request_files").insert({request_id:id,storage_path:path,file_name:safeName,mime_type:file.type,size_bytes:file.size});
 if(error){await admin.storage.from("technical-deliverables").remove([path]);return NextResponse.json({error:"Unable to record file"},{status:500});}
 return NextResponse.json({ok:true});
}

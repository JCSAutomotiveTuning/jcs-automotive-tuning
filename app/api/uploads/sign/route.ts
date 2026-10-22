import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

const schema=z.object({orderId:z.string().uuid(),fileName:z.string().min(1).max(180),fileSize:z.number().int().positive().max(16*1024*1024),contentType:z.string().max(120)});
const allowed=new Set(["bin","ori","hex","frf","odx","txt","csv","log","zip"]);
export async function POST(req:Request) {
  const supabase=createClient();
  const {data:{user}}=await supabase.auth.getUser();
  if(!user) return NextResponse.json({error:"Sign in required."},{status:401});
  const parsed=schema.safeParse(await req.json().catch(()=>null));
  if(!parsed.success) return NextResponse.json({error:"Invalid upload details. Maximum file size is 16 MB."},{status:400});
  const v=parsed.data;
  const ext=v.fileName.split(".").pop()?.toLowerCase()||"";
  if(!allowed.has(ext)) return NextResponse.json({error:"This file extension is not accepted."},{status:400});
  const {data:order}=await supabase.from("orders").select("id,user_id,status").eq("id",v.orderId).eq("user_id",user.id).maybeSingle();
  if(!order) return NextResponse.json({error:"Order not found."},{status:404});
  if(order.status!=="awaiting_review") return NextResponse.json({error:"This order is not accepting uploads."},{status:409});
  const path=`${user.id}/${v.orderId}/${crypto.randomUUID()}-${v.fileName.replace(/[^a-zA-Z0-9._-]/g,"_")}`;
  const admin=createAdminClient();
  const {data,error}=await admin.storage.from("tuning-files").createSignedUploadUrl(path,{upsert:false});
  if(error||!data) return NextResponse.json({error:"Could not create secure upload link. Confirm the private bucket exists."},{status:500});
  return NextResponse.json({signedUrl:data.signedUrl,path,token:data.token});
}

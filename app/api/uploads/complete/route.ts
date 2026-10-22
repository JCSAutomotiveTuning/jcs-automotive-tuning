import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

const schema=z.object({orderId:z.string().uuid(),path:z.string().min(1).max(500),fileName:z.string().min(1).max(180),fileSize:z.number().int().positive().max(16*1024*1024)});
export async function POST(req:Request) {
  const supabase=createClient();
  const {data:{user}}=await supabase.auth.getUser();
  if(!user) return NextResponse.json({error:"Sign in required."},{status:401});
  const parsed=schema.safeParse(await req.json().catch(()=>null));
  if(!parsed.success) return NextResponse.json({error:"Invalid completion request."},{status:400});
  const v=parsed.data;
  if(!v.path.startsWith(`${user.id}/${v.orderId}/`)) return NextResponse.json({error:"Upload path does not match your account."},{status:403});
  const {data:order}=await supabase.from("orders").select("id").eq("id",v.orderId).eq("user_id",user.id).maybeSingle();
  if(!order) return NextResponse.json({error:"Order not found."},{status:404});
  const admin=createAdminClient();
  const {data:obj,error:storageError}=await admin.storage.from("tuning-files").list(`${user.id}/${v.orderId}`,{search:v.path.split("/").pop(),limit:10});
  if(storageError||!obj?.length) return NextResponse.json({error:"Uploaded object could not be verified."},{status:400});
  const {error}=await supabase.from("order_files").insert({order_id:v.orderId,user_id:user.id,storage_path:v.path,original_filename:v.fileName,size_bytes:v.fileSize,kind:"customer_original",scan_status:"pending"});
  if(error) return NextResponse.json({error:"File uploaded but metadata could not be saved. Contact support with your order ID."},{status:500});
  return NextResponse.json({ok:true});
}

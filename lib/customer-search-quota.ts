import {NextResponse} from "next/server";
import {createClient} from "@/lib/supabase/server";
export async function chargeSearch(){
 const auth=await createClient();
 const {data:{user}}=await auth.auth.getUser();
 if(!user)return {blocked:NextResponse.json({error:"Sign in to search."},{status:401}),quota:null};
 const {data,error}=await auth.rpc("consume_customer_search");
 if(error||!Array.isArray(data)||!data[0]){
  console.error("Customer search quota check failed:",error?.code,error?.message);
  return {blocked:NextResponse.json({error:"Search is temporarily unavailable. Please try again later."},{status:503}),quota:null};
 }
 const quota=data[0] as {allowed:boolean;remaining:number;daily_limit:number;reset_at:string};
 if(!quota.allowed)return {blocked:NextResponse.json({error:"You have used your 5 free searches today. Your allowance resets at midnight UK time.",quota},{status:429,headers:{"Cache-Control":"no-store"}}),quota};
 return {blocked:null,quota};
}

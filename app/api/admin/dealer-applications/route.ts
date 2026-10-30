import {NextRequest,NextResponse} from "next/server";
import {createClient} from "@/lib/supabase/server";
import {createAdminClient} from "@/lib/supabase/admin";
import {z} from "zod";
export const dynamic="force-dynamic";
const updateSchema=z.object({applicationId:z.string().uuid(),status:z.enum(["approved","rejected"])});
async function requireAdmin(){
 const s=await createClient();const {data:{user},error}=await s.auth.getUser();
 if(error||!user)return {response:NextResponse.json({error:"Please sign in."},{status:401})};
 const p=await s.from("profiles").select("role").eq("id",user.id).maybeSingle();
 if(p.error||p.data?.role!=="admin")return {response:NextResponse.json({error:"Administrator access required."},{status:403})};
 return {user};
}
export async function GET(){
 const auth=await requireAdmin();if(auth.response)return auth.response;
 const {data,error}=await createAdminClient().from("dealer_applications")
 .select("id,user_id,business_name,website,message,status,created_at")
 .order("created_at",{ascending:false}).limit(100);
 if(error)return NextResponse.json({error:"Unable to load trade applications."},{status:500});
 return NextResponse.json({applications:data??[]},{headers:{"Cache-Control":"no-store"}});
}
export async function POST(req:NextRequest){
 const auth=await requireAdmin();if(auth.response)return auth.response;
 const parsed=updateSchema.safeParse(await req.json().catch(()=>null));
 if(!parsed.success)return NextResponse.json({error:"Invalid application or decision."},{status:400});
 const admin=createAdminClient();
 const {data,error}=await admin.from("dealer_applications")
 .update({status:parsed.data.status})
 .eq("id",parsed.data.applicationId).eq("status","pending")
 .select("id,status").maybeSingle();
 if(error)return NextResponse.json({error:"Unable to save dealer decision."},{status:500});
 if(!data)return NextResponse.json({error:"This application was already reviewed or no longer exists."},{status:409});
 return NextResponse.json({application:data});
}

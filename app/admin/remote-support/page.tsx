import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import RemoteSupportManager from "@/components/RemoteSupportManager";
export const dynamic="force-dynamic";
export default async function Page(){const s=await createClient();const {data:{user}}=await s.auth.getUser();if(!user)redirect("/login");const {data:p}=await s.from("profiles").select("role").eq("id",user.id).maybeSingle();if(p?.role!=="admin")redirect("/dashboard");const admin=createAdminClient();const {data,error}=await admin.from("jcs_remote_support_requests").select("id,user_id,subject,details,rustdesk_id,status,admin_notes,created_at").order("created_at",{ascending:false}).limit(100);return <main className="min-h-screen bg-[#090d14] p-6 text-white"><div className="mx-auto max-w-5xl space-y-6"><Link href="/admin" className="text-sky-300">← Admin</Link><h1 className="text-3xl font-bold">Remote Support Queue</h1><p className="text-slate-300">Accept requests and arrange attended RustDesk sessions. Never ask for or store customer passwords.</p>{error?<p className="text-amber-300">Apply the included Supabase migration before using this page.</p>:<RemoteSupportManager requests={data??[]}/>}</div></main>}

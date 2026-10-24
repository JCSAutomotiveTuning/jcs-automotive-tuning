import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import RemoteRequestForm from "@/components/RemoteRequestForm";
export const dynamic = "force-dynamic";
export default async function RemoteSupportPage() {
 const supabase=await createClient(); const {data:{user}}=await supabase.auth.getUser();
 if(!user) redirect("/login");
 const {data,error}=await supabase.from("jcs_remote_support_requests").select("id,subject,details,rustdesk_id,status,created_at").eq("user_id",user.id).order("created_at",{ascending:false}).limit(30);
 return <main className="min-h-screen bg-[#090d14] p-6 text-white"><div className="mx-auto max-w-4xl space-y-6">
 <Link href="/dashboard" className="text-sky-300">← Dashboard</Link>
 <h1 className="text-3xl font-bold">JCS Remote Support</h1>
 <p className="text-slate-300">Need help with an ECU/TCU file, VCDS, or flashing software? Request an attended RustDesk support session. Never submit passwords or private keys.</p>
 <a href="https://rustdesk.com/docs/en/client/" target="_blank" rel="noopener noreferrer" className="inline-block rounded-lg border border-sky-500 px-4 py-2 text-sky-300">Download / set up RustDesk ↗</a>
 <RemoteRequestForm />
 <section className="space-y-3"><h2 className="text-xl font-bold">Your requests</h2>{error?<p className="text-amber-300">Remote support database not configured yet. Apply the included SQL migration.</p>:(data?.length?data.map(r=><article key={r.id} className="rounded-xl border border-white/10 bg-[#101620] p-4"><div className="flex justify-between gap-3"><strong>{r.subject}</strong><span className="text-sky-300">{r.status.replaceAll("_"," ")}</span></div><p className="mt-2 whitespace-pre-wrap text-sm text-slate-300">{r.details}</p><p className="mt-2 text-xs text-slate-400">{new Date(r.created_at).toLocaleString("en-GB")}</p></article>):<p className="text-slate-400">No requests yet.</p>)}</section>
 </div></main>;
}

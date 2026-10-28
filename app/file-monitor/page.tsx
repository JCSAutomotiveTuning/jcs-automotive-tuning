import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

type Metric = { label:string; value:number; detail:string };
function MetricCard({label,value,detail}:{label:string;value:number;detail:string}) {
  return <div className="rounded-2xl border border-sky-300/15 bg-[#142331] p-5 shadow-lg shadow-black/10">
    <p className="text-sm text-slate-300">{label}</p>
    <p className="mt-2 text-4xl font-extrabold tabular-nums text-sky-200">{value.toLocaleString("en-GB")}</p>
    <p className="mt-2 text-xs text-slate-400">{detail}</p>
  </div>;
}
async function exactCount(query: PromiseLike<{ count: number|null; error: { message:string }|null }>) {
  const result = await query;
  if (result.error) throw new Error("File Monitor statistics unavailable.");
  return result.count ?? 0;
}

export default async function FileMonitorPage() {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) redirect("/login");
  const { data: profile, error: roleError } = await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle();
  if (roleError || !profile || !["admin","technician"].includes(profile.role)) redirect("/dashboard");

  const db = createAdminClient();
  let metrics: Metric[] = [];
  const isAdmin = profile.role === "admin";

  if (isAdmin) {
    const [originals,clean,notClean,identified,awaitingReview,inProgress,qa,assigned] = await Promise.all([
      exactCount(db.from("order_files").select("id",{count:"exact",head:true}).eq("kind","customer_original")),
      exactCount(db.from("order_files").select("id",{count:"exact",head:true}).eq("kind","customer_original").eq("scan_status","clean")),
      exactCount(db.from("order_files").select("id",{count:"exact",head:true}).eq("kind","customer_original").neq("scan_status","clean")),
      exactCount(db.from("original_file_catalog").select("file_id",{count:"exact",head:true}).not("hw_id","is",null).not("sw_id","is",null)),
      exactCount(db.from("orders").select("id",{count:"exact",head:true}).eq("status","awaiting_review")),
      exactCount(db.from("orders").select("id",{count:"exact",head:true}).eq("status","in_progress")),
      exactCount(db.from("orders").select("id",{count:"exact",head:true}).eq("status","qa_review")),
      exactCount(db.from("order_technicians").select("order_id",{count:"exact",head:true})),
    ]);
    metrics = [
      {label:"Original files",value:originals,detail:"Customer-supplied originals"},
      {label:"HW/SW identified",value:identified,detail:"Both ECU identifiers recorded"},
      {label:"Undefined originals",value:Math.max(0,originals-identified),detail:"Missing verified HW or SW"},
      {label:"Antivirus clean",value:clean,detail:"Originals cleared for admin download"},
      {label:"Not yet cleared",value:notClean,detail:"Pending, failed or blocked scans"},
      {label:"Awaiting review",value:awaitingReview,detail:"Customer orders needing assessment"},
      {label:"In progress",value:inProgress,detail:"Active workshop orders"},
      {label:"QA review",value:qa,detail:"Orders waiting for final approval"},
      {label:"Technician assignments",value:assigned,detail:"Orders currently assigned"},
    ];
  } else {
    const {data:assignments,error:assignError} = await db.from("order_technicians").select("order_id").eq("technician_id",user.id).limit(1000);
    if(assignError || !assignments) throw new Error("Assigned job statistics unavailable.");
    const ids = assignments.map(a=>a.order_id);
    let fileCount=0,cleanCount=0,needsScan=0,activeCount=0,qaCount=0;
    if(ids.length) {
      const [files,clean,uncleared,active,qa] = await Promise.all([
        exactCount(db.from("order_files").select("id",{count:"exact",head:true}).in("order_id",ids)),
        exactCount(db.from("order_files").select("id",{count:"exact",head:true}).in("order_id",ids).eq("scan_status","clean")),
        exactCount(db.from("order_files").select("id",{count:"exact",head:true}).in("order_id",ids).neq("scan_status","clean")),
        exactCount(db.from("orders").select("id",{count:"exact",head:true}).in("id",ids).eq("status","in_progress")),
        exactCount(db.from("orders").select("id",{count:"exact",head:true}).in("id",ids).eq("status","qa_review")),
      ]);
      [fileCount,cleanCount,needsScan,activeCount,qaCount] = [files,clean,uncleared,active,qa];
    }
    metrics = [
      {label:"My assigned jobs",value:ids.length,detail:"Only orders assigned to you"},
      {label:"Files in my jobs",value:fileCount,detail:"Original and completed file records"},
      {label:"Clean files",value:cleanCount,detail:"Antivirus scan passed"},
      {label:"Not yet cleared",value:needsScan,detail:"Not available for download"},
      {label:"In progress",value:activeCount,detail:"My active tuning jobs"},
      {label:"Awaiting QA",value:qaCount,detail:"My jobs awaiting admin review"},
    ];
  }
  return <main className="min-h-screen bg-[#090f18] px-4 py-8 text-slate-100 sm:px-8">
    <div className="mx-auto max-w-6xl">
      <header className="mb-8 flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-sky-300">JCS Automotive Tuning</p>
          <h1 className="mt-2 text-3xl font-black sm:text-4xl">File Monitor</h1>
          <p className="mt-3 max-w-2xl text-sm text-slate-400">Secure live totals from the portal database. Data refreshes when you reopen or reload this screen.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link className="rounded-xl bg-sky-300 px-4 py-3 text-sm font-bold text-slate-950" href={isAdmin?"/admin/original-library":"/staff"}>
            {isAdmin?"Open original library":"My technician jobs"}
          </Link>
          <Link className="rounded-xl border border-white/20 px-4 py-3 text-sm" href={isAdmin?"/admin":"/dashboard"}>Dashboard</Link>
        </div>
      </header>
      <div className="mb-6 inline-flex rounded-full border border-sky-300/20 px-3 py-1 text-xs font-semibold text-sky-200">{isAdmin?"Administrator view":"Assigned technician view"}</div>
      <section aria-label="File and workshop statistics" className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {metrics.map(m=><MetricCard key={m.label} {...m}/>)}
      </section>
      <p className="mt-8 text-xs leading-6 text-slate-500">Private monitoring only. No customer personal information, file contents or download links are included in these totals. Install this page using your browser's Add to Home Screen or Install App option.</p>
    </div>
  </main>;
}

"use client";
import {useEffect,useState} from "react";
type Application={id:string;business_name:string;website:string|null;message:string|null;status:string;created_at:string};
export default function DealerApplicationsReview(){
 const [items,setItems]=useState<Application[]>([]),[busy,setBusy]=useState<string|null>(null),[error,setError]=useState(""),[loaded,setLoaded]=useState(false);
 useEffect(()=>{let active=true;fetch("/api/admin/dealer-applications",{cache:"no-store"}).then(async r=>{const data=await r.json();if(!r.ok)throw Error(data.error||"Could not load dealer applications");return data;}).then(d=>{if(active)setItems(d.applications||[]);}).catch(e=>{if(active)setError(e instanceof Error?e.message:"Could not load dealer applications");}).finally(()=>{if(active)setLoaded(true);});return()=>{active=false};},[]);
 async function review(id:string,status:"approved"|"rejected"){
  if(busy||!window.confirm(`Mark this application as ${status}? This does not enable discounted pricing.`))return;
  setBusy(id);setError("");
  try{const r=await fetch("/api/admin/dealer-applications",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({applicationId:id,status})});const data=await r.json();if(!r.ok)throw Error(data.error||"Could not save decision");setItems(xs=>xs.map(x=>x.id===id?{...x,status}:x));}
  catch(e){setError(e instanceof Error?e.message:"Could not save decision");}finally{setBusy(null);}
 }
 const pending=items.filter(x=>x.status==="pending");
 return <section className="mt-8 rounded-3xl border border-white/10 bg-[#111923] p-5 sm:p-7" aria-labelledby="dealer-review-title">
  <div className="mb-4"><h2 id="dealer-review-title" className="text-xl font-bold text-white">Trade account applications</h2><p className="mt-1 text-sm text-slate-400">Review existing dealer requests here. Approval does not automatically activate discounts, wallet credit or extra search allowance.</p></div>
  {error&&<p role="alert" className="mb-3 text-sm text-rose-300">{error}</p>}
  {!loaded?<p className="text-sm text-slate-400">Loading dealer applications…</p>:pending.length===0?<p className="text-sm text-slate-400">No pending dealer applications.</p>:<div className="grid gap-3">{pending.map(a=><article key={a.id} className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
   <div className="flex flex-wrap justify-between gap-2"><strong className="text-white">{a.business_name}</strong><small className="text-slate-400">{new Date(a.created_at).toLocaleDateString("en-GB")}</small></div>
   {a.website&&<p className="mt-2 break-all text-xs text-sky-300">{a.website}</p>}
   {a.message&&<p className="mt-2 whitespace-pre-wrap text-sm text-slate-300">{a.message}</p>}
   <div className="mt-3 flex flex-wrap gap-2"><button type="button" disabled={!!busy} onClick={()=>void review(a.id,"approved")} className="rounded-lg border border-emerald-400/30 px-4 py-2 text-sm font-semibold text-emerald-200 disabled:opacity-50">Approve application</button><button type="button" disabled={!!busy} onClick={()=>void review(a.id,"rejected")} className="rounded-lg border border-rose-400/30 px-4 py-2 text-sm font-semibold text-rose-200 disabled:opacity-50">Reject</button></div>
  </article>)}</div>}
 </section>;
}

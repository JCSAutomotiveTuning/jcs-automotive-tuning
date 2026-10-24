"use client";
import { useEffect, useState } from "react";
export default function NotificationPreferencesPage() {
 const [email,setEmail]=useState(true); const [sms,setSms]=useState(false);
 const [verified,setVerified]=useState(false); const [phone,setPhone]=useState<string|null>(null);
 const [message,setMessage]=useState(""); const [busy,setBusy]=useState(true);
 useEffect(()=>{let active=true;void fetch("/api/notifications/preferences",{cache:"no-store"})
 .then(async r=>{const j=await r.json();if(!r.ok)throw new Error(j.error);return j;})
 .then(j=>{if(active){setEmail(j.emailEnabled);setSms(j.smsEnabled);setVerified(j.phoneVerified);setPhone(j.phone);}})
 .catch(e=>{if(active)setMessage(e instanceof Error?e.message:"Could not load preferences");})
 .finally(()=>{if(active)setBusy(false);});return()=>{active=false;};},[]);
 async function save(){setBusy(true);setMessage("");try{const r=await fetch("/api/notifications/preferences",{
 method:"PUT",headers:{"Content-Type":"application/json"},body:JSON.stringify({emailEnabled:email,smsEnabled:sms})});
 const j=await r.json();if(!r.ok)throw new Error(j.error);setMessage("Preferences saved.");}
 catch(e){setMessage(e instanceof Error?e.message:"Could not save preferences");}finally{setBusy(false);}}
 return <main className="mx-auto max-w-xl p-8 text-white"><h1 className="text-2xl font-bold">Notification preferences</h1>
 <p className="mt-3 text-sm text-slate-400">Choose how JCS Automotive Tuning contacts you about wallet changes and tuning files.</p>
 <label className="mt-6 flex gap-3"><input type="checkbox" checked={email} onChange={e=>setEmail(e.target.checked)} disabled={busy}/>Email notifications</label>
 <label className="mt-4 flex gap-3"><input type="checkbox" checked={sms} onChange={e=>setSms(e.target.checked)} disabled={busy||!verified}/>SMS notifications</label>
 <p className="mt-2 text-sm text-slate-400">{verified?`Verified number: ${phone??""}`:"SMS requires a verified mobile number. Phone verification is not yet available."}</p>
 <button onClick={()=>void save()} disabled={busy} className="mt-6 rounded bg-sky-400 px-5 py-3 font-bold text-slate-950 disabled:opacity-50">Save preferences</button>
 {message&&<p role="status" className="mt-4">{message}</p>}</main>;
}

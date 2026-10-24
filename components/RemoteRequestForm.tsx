"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
export default function RemoteRequestForm(){
 const router=useRouter(); const [subject,setSubject]=useState(""); const [details,setDetails]=useState("");const [rustdeskId,setRustdeskId]=useState("");const [busy,setBusy]=useState(false);const [message,setMessage]=useState("");
 async function submit(e:React.FormEvent<HTMLFormElement>){e.preventDefault();setBusy(true);setMessage("");try{const r=await fetch("/api/remote-support",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({subject,details,rustdeskId})});const j=await r.json();if(!r.ok)throw new Error(j.error||"Request failed");setMessage("Request submitted. We'll review it soon.");setSubject("");setDetails("");setRustdeskId("");router.refresh()}catch(e){setMessage(e instanceof Error?e.message:"Unable to submit request")}finally{setBusy(false)}}
 return <form onSubmit={submit} className="space-y-3 rounded-xl border border-white/10 bg-[#101620] p-5"><h2 className="text-xl font-bold">Request a session</h2>
 <label className="block text-sm">Issue summary<input required minLength={3} maxLength={120} value={subject} onChange={e=>setSubject(e.target.value)} placeholder="VCDS communication fault" className="mt-1 w-full rounded-lg bg-[#090d14] border border-white/20 p-3"/></label>
 <label className="block text-sm">Describe the problem<textarea required minLength={10} maxLength={3000} value={details} onChange={e=>setDetails(e.target.value)} rows={4} placeholder="Vehicle, ECU/TCU, tool, symptoms and error messages" className="mt-1 w-full rounded-lg bg-[#090d14] border border-white/20 p-3"/></label>
 <label className="block text-sm">RustDesk ID (optional — not password)<input maxLength={40} value={rustdeskId} onChange={e=>setRustdeskId(e.target.value)} placeholder="Your RustDesk ID" className="mt-1 w-full rounded-lg bg-[#090d14] border border-white/20 p-3"/></label>
 <p className="text-xs text-slate-400">You must be present to approve remote access. Do not enter your RustDesk password. Stop remote ECU flashing if connectivity or power is unstable.</p>
 <button disabled={busy} className="rounded-lg bg-sky-600 px-5 py-3 font-bold disabled:opacity-50">{busy?"Submitting...":"Send support request"}</button>{message&&<p role="status" className="text-sm text-sky-300">{message}</p>}
 </form>;
}

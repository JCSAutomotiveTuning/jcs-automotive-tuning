"use client";
import Link from "next/link";
import { useState } from "react";
type Match = { ecu_family:string;tool_name:string;method:string|null;protocol:string|null;verified:boolean;notes:string|null };
type DirectoryEntry = {name:string;category:string;source:string;methods:string};
type Vehicle = { make:string;model:string;engine_code:string|null;ecu_family:string;ecu_manufacturer:string|null;verified:boolean };
export default function Tools(){
 const [family,setFamily]=useState(""),[matches,setMatches]=useState<Match[]>([]),[vehicles,setVehicles]=useState<Vehicle[]>([]),[directory,setDirectory]=useState<DirectoryEntry[]>([]);
 const [error,setError]=useState(""),[busy,setBusy]=useState(false),[searched,setSearched]=useState(false);
 const [verifiedOnly,setVerifiedOnly]=useState(false),[method,setMethod]=useState("all");
 async function search(e:React.FormEvent){e.preventDefault();setBusy(true);setError("");setSearched(false);try{
 const r=await fetch("/api/ecu-tool-compatibility?"+new URLSearchParams({family}));const d=await r.json();
 if(!r.ok)throw Error(d.error||"Lookup failed");
 setMatches(d.matches||[]);setVehicles(d.vehicleReferences||[]);setDirectory(d.directory||[]);setSearched(true);
 }catch(e){setError(e instanceof Error?e.message:"Lookup failed");}finally{setBusy(false);}}
 return <main className="wrap"><nav className="nav"><Link className="brand" href="/dashboard">JCS <span>PORTAL</span></Link><Link className="btn secondary" href="/dashboard">Dashboard</Link></nav>
 <section className="hero"><div className="eyebrow">Tuning tools</div><h1>Tool <em>compatibility.</em></h1><p>Search by ECU family. Confirm exact hardware/software and current official tool protocol support before attempting a read or write.</p></section>
 <section className="card"><form onSubmit={search}><div className="field"><label htmlFor="family">ECU family</label><input id="family" required value={family} onChange={e=>setFamily(e.target.value)} placeholder="EDC16U31, MED9.1, EDC17"/></div><button className="btn" disabled={busy}>{busy?"Searching…":"Search compatibility"}</button></form>
 {error&&<p role="alert">{error}</p>}
 {searched&&<><div className="field" style={{display:"flex",alignItems:"end",gap:14,flexWrap:"wrap",margin:"20px 0"}}>
  <label style={{display:"flex",alignItems:"center",gap:8}}><input type="checkbox" checked={verifiedOnly} onChange={e=>setVerifiedOnly(e.target.checked)}/> Verified only</label>
  <label>Connection method <select style={{display:"block",minWidth:150}} value={method} onChange={e=>setMethod(e.target.value)}><option value="all">All methods</option><option value="obd">OBD</option><option value="bench">Bench</option><option value="boot">Boot</option></select></label>
 </div><h2>Tool compatibility</h2>{matches.filter(m=>(!verifiedOnly||m.verified)&&(method==="all"||(m.method||"").toLowerCase().includes(method))).length===0?<p>No matching records for these filters. This does not mean the ECU is unsupported.</p>:matches.filter(m=>(!verifiedOnly||m.verified)&&(method==="all"||(m.method||"").toLowerCase().includes(method))).map((m,i)=><div className="order-entry" key={i}><h3>{m.tool_name} — {m.method||"Method not listed"}</h3><p>{m.ecu_family} · {m.verified?"Verified":"Unverified"} · {m.protocol||"Protocol not listed"}</p>{m.notes&&<p>{m.notes}</p>}</div>)}

 <p style={{fontSize:13,opacity:.8}}>Always verify current official tool protocol support, read/write capability and recovery requirements before connection.</p>
 <h2>Read/write tool research directory</h2>
 <p>These tools are listed for research, not confirmed compatible with {family}. No OBD, bench, boot, read, or write support is implied without a verified exact ECU HW/SW and vendor protocol.</p>
 <div className="grid">{directory.map(t=><article className="card" key={t.name}>
   <h3>{t.name}</h3><p>{t.category}</p><small>{t.methods}</small>
   {t.source&&<p><a href={t.source} target="_blank" rel="noopener noreferrer" style={{textDecoration:"underline"}}>Manufacturer / reference website</a></p>}
 </article>)}</div>
 <h2>Related ECU catalogue records</h2>{vehicles.length===0?<p>No matching vehicle records found. Try a broader family such as EDC16 or MED9.</p>:<div className="grid">{vehicles.map((v,i)=><div className="card" key={i}><h3>{v.make} {v.model}</h3><p>{v.engine_code||"Engine not listed"} · {v.ecu_family}</p><small>{v.verified?"Verified vehicle record":"Provisional vehicle reference — not verified for tool support"}</small></div>)}</div>}
 </>}
 </section></main>;
}

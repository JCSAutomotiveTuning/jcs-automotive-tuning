"use client";
import Link from "next/link";
import { useState } from "react";
import { TOOL_DIRECTORY, ECU_FAMILIES } from "@/lib/ecu-tool-directory";
type Match = { ecu_family:string;tool_name:string;method:string|null;protocol:string|null;verified:boolean;notes:string|null;source_url?:string|null };
type Vehicle = { make:string;model:string;engine_code:string|null;ecu_family:string;ecu_manufacturer:string|null;verified:boolean };
export default function Tools(){
 const [family,setFamily]=useState(""),[matches,setMatches]=useState<Match[]>([]),[vehicles,setVehicles]=useState<Vehicle[]>([]);
 const [error,setError]=useState(""),[busy,setBusy]=useState(false),[searched,setSearched]=useState(false);
 const [verifiedOnly,setVerifiedOnly]=useState(false),[method,setMethod]=useState("all");
 async function search(e:React.FormEvent){e.preventDefault();setBusy(true);setError("");setSearched(false);try{
 const vehicleResponse=await fetch("/api/vehicle-ecu-search?"+new URLSearchParams({q:family}),{cache:"no-store"});
 const vehicleData=await vehicleResponse.json();
 if(!vehicleResponse.ok)throw Error(vehicleData.error||"Lookup failed");
 const sourced=(vehicleData.references||[]).map((v:{ecu_family:string;tool_name:string;connection_method:string;read_capability:string;write_capability:string;make:string;model:string;engine_code:string|null;source_year:number|null;source_url:string})=>({
  ecu_family:v.ecu_family,tool_name:v.tool_name,method:v.connection_method,
  protocol:`Read: ${v.read_capability}; Write: ${v.write_capability}`,
  verified:false,source_url:v.source_url,
  notes:`${v.make} ${v.model} ${v.engine_code||""} — historical vendor connection listing (${v.source_year||"undated"}). Confirm exact ECU and current manufacturer protocol before reading or writing.`
 }));
 setMatches([...(vehicleData.familyProtocolReferences||[]),...sourced]);
 setVehicles(vehicleData.candidateVehicles||[]);
 setSearched(true);
 }catch(e){setError(e instanceof Error?e.message:"Lookup failed");}finally{setBusy(false);}}
 return <main className="wrap"><nav className="nav"><Link className="brand" href="/dashboard">JCS <span>PORTAL</span></Link><Link className="btn secondary" href="/dashboard">Dashboard</Link></nav>
 <section className="hero"><div className="eyebrow">Tuning tools</div><h1>Tool <em>compatibility.</em></h1><p>Search by ECU family. Confirm exact hardware/software and current official tool protocol support before attempting a read or write.</p></section>
 <section className="card" style={{marginBottom:20}}><h2>Find ECU by vehicle</h2><p>Search by make, model, engine code or ECU family, with documented tool connections and sources.</p><Link className="btn" href="/dashboard/vehicle-ecu-search">Open Vehicle & ECU Finder</Link></section>
 <section className="card"><form onSubmit={search}><div className="field"><label htmlFor="family">ECU family</label><input id="family" required value={family} onChange={e=>setFamily(e.target.value)} placeholder="EDC16U31, MED9.1, EDC17"/></div><button className="btn" disabled={busy}>{busy?"Searching…":"Search compatibility"}</button></form>
 {error&&<p role="alert">{error}</p>}
 {searched&&<><div className="field" style={{display:"flex",alignItems:"end",gap:14,flexWrap:"wrap",margin:"20px 0"}}>
  <label style={{display:"flex",alignItems:"center",gap:8}}><input type="checkbox" checked={verifiedOnly} onChange={e=>setVerifiedOnly(e.target.checked)}/> Verified only</label>
  <label>Connection method <select style={{display:"block",minWidth:150}} value={method} onChange={e=>setMethod(e.target.value)}><option value="all">All methods</option><option value="obd">OBD</option><option value="bench">Bench</option><option value="boot">Boot</option></select></label>
 </div><h2>Tool compatibility</h2>{matches.filter(m=>(!verifiedOnly||m.verified)&&(method==="all"||(m.method||"").toLowerCase().includes(method))).length===0?<p>No sourced matches for this search and connection method yet. Try the Vehicle & ECU Finder or the latest manufacturer list.</p>:matches.filter(m=>(!verifiedOnly||m.verified)&&(method==="all"||(m.method||"").toLowerCase().includes(method))).map((m,i)=><div className="order-entry" key={i}><h3>{m.tool_name} — {m.method||"Method not listed"}</h3><p>{m.ecu_family} · {m.source_url?"Manufacturer-documented family support (exact ECU unverified)":m.verified?"Verified database record":"Unverified"} · {m.protocol||"Protocol not listed"}</p>{m.notes&&<p>{m.notes}</p>}{m.source_url&&<p><a href={m.source_url} target="_blank" rel="noopener noreferrer" style={{textDecoration:"underline"}}>Manufacturer protocol reference</a></p>}</div>)}

 <p style={{fontSize:13,opacity:.8}}>Always verify current official tool protocol support, read/write capability and recovery requirements before connection.</p>
 <h2>Related ECU catalogue records</h2>{vehicles.length===0?<p>No matching vehicle records found. Try a broader family such as EDC16 or MED9.</p>:<div className="grid">{vehicles.map((v,i)=><div className="card" key={i}><h3>{v.make} {v.model}</h3><p>{v.engine_code||"Engine not listed"} · {v.ecu_family}</p><small>{v.verified?"Verified vehicle record":"Provisional vehicle reference — not verified for tool support"}</small></div>)}</div>}
 </>}
 </section>
 <section className="card" style={{marginTop:20}}>
  <h2>ECU/TCU family reference</h2>
  <p style={{opacity:.8}}>Common families: {ECU_FAMILIES.join(" · ")}</p>
  <h2>Read/write tool directory ({TOOL_DIRECTORY.length})</h2>
  <p>Reference list only. Individual read, write, OBD, bench and boot support must be checked against the exact ECU hardware/software and manufacturer&apos;s protocol list.</p>
  <div className="grid">{TOOL_DIRECTORY.map(t=><article className="order-entry" key={t.name} style={{padding:16}}>
   <h3>{t.name}</h3><p>{t.category}</p><small>{t.methods}</small>
   {t.source&&<p><a href={t.source} target="_blank" rel="noopener noreferrer" style={{textDecoration:"underline"}}>Official/reference website</a></p>}
  </article>)}</div>
 </section></main>;
}

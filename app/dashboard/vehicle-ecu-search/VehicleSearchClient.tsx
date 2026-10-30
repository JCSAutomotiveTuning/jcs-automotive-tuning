"use client";
import {FormEvent,useState} from "react";
type RefRow={make:string;model:string;generation:string|null;engine_code:string|null;engine_label:string|null;power_ps:number|null;listed_year:number|null;ecu_manufacturer:string|null;ecu_family:string;tool_name:string;connection_method:string;read_capability:string;write_capability:string;coverage_status:string;source_url:string;source_label:string;source_year:number|null;ecu_hw_id:string|null;ecu_sw_id:string|null;mcu:string|null;fuel_type:string|null;tool_protocol:string|null;software_package:string|null;unlock_required:boolean|null;source_checked_at:string|null;technician_notes:string|null};
type Candidate={make:string;model:string;model_year_from:number|null;model_year_to:number|null;engine_code:string|null;engine_description:string|null;ecu_manufacturer:string|null;ecu_family:string|null;ecu_part_number:string|null;ecu_hw_id:string|null;ecu_sw_id:string|null;verified:boolean;source_url:string|null;verification_notes:string|null};
type FamilyTool={ecu_family:string;tool_name:string;method:string;protocol:string;verified:boolean;notes:string;source_url:string};
type Results={references:RefRow[];candidateVehicles:Candidate[];familyProtocolReferences:FamilyTool[];count:number;totalCount:number;page:number;hasMore:boolean;capped:boolean;disclaimer:string};
const brands=["","Volkswagen","Audi","SEAT","Skoda","BMW","Ford","Peugeot","Alfa Romeo","Abarth","Mercedes-Benz","Renault","Citroen","Opel","Fiat","Volvo","Hyundai","Nissan"];
const presets=["AXR","ASZ","BLT","ARL","BPX","PD130","CAYC","BKD","MED9.1","EDC17C46","N47"];
function Status({children}:{children:React.ReactNode}){return <small style={{border:"1px solid #37516a",borderRadius:6,padding:"3px 8px",color:"#bcd5e9"}}>{children}</small>;}
export default function VehicleSearchClient(){
 const [q,setQ]=useState(""),[make,setMake]=useState(""),[method,setMethod]=useState("all");
 const [result,setResult]=useState<Results|null>(null),[error,setError]=useState(""),[busy,setBusy]=useState(false);
 async function run(nextQ=q,nextMake=make,nextMethod=method,nextPage=1){
  setBusy(true);setError("");setResult(null);
  try{const params=new URLSearchParams({q:nextQ,make:nextMake,method:nextMethod,page:String(nextPage)});
   const response=await fetch("/api/vehicle-ecu-search?"+params.toString(),{cache:"no-store"});
   const data=await response.json();
   if(!response.ok)throw Error(data.error||"Vehicle database unavailable");
   setResult(data);
  }catch(e){setError(e instanceof Error?e.message:"Search failed");}finally{setBusy(false);}
 }
 function submit(e:FormEvent){e.preventDefault();void run();}
 return <div style={{display:"grid",gap:20,paddingBottom:32}}>
  <section className="card">
   <h2>Search vehicles and ECU types</h2>
   <p style={{opacity:.8}}>Search vehicle, model, engine code, ECU family or part number. Exact ECU identification is always required before programming.</p>
   <form onSubmit={submit}>
    <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(190px,1fr))",gap:14}}>
     <div className="field"><label htmlFor="veh-search">Vehicle / engine / ECU</label><input id="veh-search" value={q} onChange={e=>setQ(e.target.value)} maxLength={70} placeholder="Golf, AXR, 03L906022, EDC17"/></div>
     <div className="field"><label htmlFor="veh-make">Manufacturer</label><select id="veh-make" value={make} onChange={e=>setMake(e.target.value)}>{brands.map(b=><option key={b} value={b}>{b||"All makes"}</option>)}</select></div>
     <div className="field"><label htmlFor="veh-method">Connection</label><select id="veh-method" value={method} onChange={e=>setMethod(e.target.value)}><option value="all">Any method</option><option value="OBD">OBD</option><option value="Bench">Bench</option><option value="Boot">Boot</option><option value="BDM">BDM</option></select></div>
    </div>
    <div style={{display:"flex",gap:10,flexWrap:"wrap",marginTop:16,alignItems:"center"}}>
     <button className="btn" type="submit" disabled={busy||(!q.trim()&&!make)}>{busy?"Searching…":"Search database"}</button>
     <button className="btn secondary" type="button" onClick={()=>{setQ("");setMake("");setMethod("all");setResult(null);setError("");}}>Clear</button>
    </div>
   </form>
   <p style={{fontSize:13,opacity:.8,marginTop:14}}>Popular searches: {presets.map(p=><button key={p} type="button" onClick={()=>{setQ(p);void run(p,make,method);}} style={{margin:"3px 4px",padding:"5px 9px",border:"1px solid #39566e",borderRadius:7}}>{p}</button>)}</p>
  </section>
  {error&&<p role="alert" className="card" style={{color:"#ffb7b7"}}>{error}</p>}
  {result&&<><section className="card">
   <div style={{display:"flex",justifyContent:"space-between",gap:12,flexWrap:"wrap",alignItems:"baseline"}}><h2>Search results</h2><strong>{result.totalCount} matching records · Page {result.page}</strong></div>
   <p style={{fontSize:13,color:"#b3c5d5"}}>The results come from two separate sources: a dated manufacturer-published FLEX list and the existing JCS vehicle catalogue. Multiple ECUs may be listed for one engine.</p>
   {result.references.length===0&&result.candidateVehicles.length===0?<p>No matching vehicle references yet. Try engine code or ECU family instead, or consult the manufacturers' current vehicle lists below.</p>:null}
   {result.references.length>0&&<><h3>Manufacturer-published vehicle references ({result.references.length})</h3>
   <div style={{display:"grid",gap:12}}>{result.references.map((r,i)=><article className="order-entry" key={i} style={{padding:16}}>
    <div style={{display:"flex",gap:8,justifyContent:"space-between",flexWrap:"wrap",alignItems:"start"}}><div><strong>{r.make} {r.model} {r.generation||""}</strong><p style={{margin:"5px 0"}}>{r.engine_label||"Engine not specified"} {r.engine_code&&<>· <strong>{r.engine_code}</strong></>} {r.power_ps!=null&&<>· {r.power_ps} PS</>}</p></div><Status>Historical manufacturer listing · {r.source_year||"year unknown"}</Status></div>
    <p><strong>ECU:</strong> {r.ecu_manufacturer||"Not stated"} {r.ecu_family} {r.mcu&&<>· MCU {r.mcu}</>}</p>
    {(r.ecu_hw_id||r.ecu_sw_id)&&<p>HW: {r.ecu_hw_id||"Unlisted"} · SW: {r.ecu_sw_id||"Unlisted"}</p>}
    {r.tool_protocol&&<p>Protocol: {r.tool_protocol}</p>}{r.software_package&&<p>Software package: {r.software_package}</p>}
    {r.unlock_required!==null&&<p>Unlock required: {r.unlock_required?"Yes":"No recorded"}</p>}
    {r.technician_notes&&<p>{r.technician_notes}</p>}
    <div style={{display:"flex",gap:9,alignItems:"center",flexWrap:"wrap",margin:"10px 0"}}><Status>{r.tool_name}</Status><Status>{r.connection_method}</Status><Status>Read: {r.read_capability==="unknown"?"not specified":r.read_capability}</Status><Status>Write: {r.write_capability==="unknown"?"not specified":r.write_capability}</Status></div>
    <p style={{fontSize:13,opacity:.85}}>Documented application year: {r.listed_year??"not stated"} (not a verified production range). Tool listing does not guarantee current licensed support or full ECU backup.</p>
    <a href={r.source_url} target="_blank" rel="noopener noreferrer" style={{textDecoration:"underline"}}>View original manufacturer list</a>
   </article>)}</div></>}
   {result.candidateVehicles.length>0&&<><h3 style={{marginTop:24}}>Existing JCS vehicle catalogue ({result.candidateVehicles.length})</h3>
   <div style={{display:"grid",gap:10}}>{result.candidateVehicles.map((v,i)=><article className="order-entry" key={i} style={{padding:14}}>
    <strong>{v.make} {v.model}</strong> {v.engine_code&&<span>· {v.engine_code}</span>}
    <p>{v.engine_description||"Engine unspecified"} · ECU candidate: <strong>{v.ecu_manufacturer||""} {v.ecu_family||"not identified"}</strong></p>
    {v.ecu_part_number&&<p>ECU part number: {v.ecu_part_number}</p>}
    {(v.ecu_hw_id||v.ecu_sw_id)&&<p>HW: {v.ecu_hw_id||"–"} · SW: {v.ecu_sw_id||"–"}</p>}
    <small>{v.verified?"Catalogue verified flag (confirm exact vehicle)":"Provisional, not ECU-verified"} {v.model_year_from&&`· Model listed from ${v.model_year_from}`}</small>
    {v.source_url&&<p><a href={v.source_url} target="_blank" rel="noopener noreferrer" style={{textDecoration:"underline"}}>Source reference</a></p>}
   </article>)}</div></>}
   <div style={{display:"flex",gap:12,justifyContent:"space-between",marginTop:18}}>
    <button className="btn secondary" type="button" disabled={busy||result.page<=1} onClick={()=>void run(q,make,method,result.page-1)}>Previous</button>
    <button className="btn secondary" type="button" disabled={busy||!result.hasMore} onClick={()=>void run(q,make,method,result.page+1)}>Next page</button>
   </div>
  </section>
  {result.familyProtocolReferences.length>0&&<section className="card"><h2>Additional ECU family tool references</h2>
   <p>Family-level protocol announcements only. They do not establish compatibility with a specific ECU hardware/software revision.</p>
   {result.familyProtocolReferences.map((p,i)=><article key={i} className="order-entry"><strong>{p.tool_name} — {p.method}</strong><p>{p.ecu_family} · {p.protocol}</p><p>{p.notes}</p><a href={p.source_url} target="_blank" rel="noopener noreferrer" style={{textDecoration:"underline"}}>Manufacturer source</a></article>)}
  </section>}
  <section className="card"><h3>Before reading or writing</h3><p>{result.disclaimer}</p><p>Recommended process: identify ECU using an actual diagnostic ID or label; find the exact vendor protocol; confirm reading type, write prerequisites, voltage support and recovery path. Choose OBD only if that exact ECU and operation are supported. Bench/boot are not inherently safer for every model.</p></section>
  </>}
  <section className="card"><h2>Current official vehicle lists</h2><p>For the newest protocols and newly released vehicles, check manufacturer-maintained listings rather than relying on a fixed archive.</p>
   <div style={{display:"flex",gap:16,flexWrap:"wrap"}}><a href="https://www.alientech-tools.com/en/vehicles" target="_blank" rel="noopener noreferrer" style={{textDecoration:"underline"}}>Alientech KESS3</a><a href="https://www.autotuner.com/pages/compatibility" target="_blank" rel="noopener noreferrer" style={{textDecoration:"underline"}}>AutoTuner</a><a href="https://magicmotorsport.us/?page_id=49390" target="_blank" rel="noopener noreferrer" style={{textDecoration:"underline"}}>Magic Motorsport FLEX</a></div>
  </section>
 </div>;
}

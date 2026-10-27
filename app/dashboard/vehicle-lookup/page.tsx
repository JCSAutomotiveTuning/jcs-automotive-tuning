"use client";
import { FormEvent, useState } from "react";
import Link from "next/link";

type RecordData = Record<string, unknown>;
const asRecord = (value: unknown): RecordData => value && typeof value === "object" && !Array.isArray(value) ? value as RecordData : {};
const display = (value: unknown): string => value == null ? "Not listed" : typeof value === "object" ? JSON.stringify(value) : String(value);
const list = (value: unknown): RecordData[] => {
  const record = asRecord(value);
  const inner = record.data ?? record.results ?? record.items ?? value;
  return Array.isArray(inner) ? inner.map(asRecord) : [];
};
const identifier = (item: RecordData) => String(item.public_id ?? item.id ?? "");
const label = (item: RecordData) => String(item.name ?? item.title ?? item.label ?? item.engine ?? item.description ?? identifier(item));
type Vehicle = { registrationNumber?:string; make?:string; yearOfManufacture?:number; engineCapacity?:number; fuelType?:string; euroStatus?:string; colour?:string };
type Lookup = { vehicle:Vehicle; tuning:{ note:string } };
export default function VehicleLookup() {
  const steps = ["makes","models","generations","engines"] as const;
  const [options,setOptions]=useState<RecordData[][]>([[],[],[],[]]);
  const [selected,setSelected]=useState(["","","",""]);
  const [ecuResult,setEcuResult]=useState<RecordData|null>(null);
  const [ecuError,setEcuError]=useState("");
  const [ecuBusy,setEcuBusy]=useState(false);
  async function loadStep(index:number, id?:string) {
    setEcuBusy(true);setEcuError("");setEcuResult(null);
    try {
      const params=new URLSearchParams({step:steps[index]});
      if(index>0) params.set(["","make","model","generation"][index],id??"");
      const response=await fetch("/api/ecu-catalogue?"+params.toString(),{cache:"no-store"});
      const data=await response.json();
      if(!response.ok) throw new Error(data.error||"Catalogue lookup failed");
      const next=[...options];next[index]=list(data);
      for(let i=index+1;i<4;i++)next[i]=[];
      setOptions(next);
    }catch(e){setEcuError(e instanceof Error?e.message:"Catalogue lookup failed");}
    finally{setEcuBusy(false);}
  }
  async function selectStep(index:number,id:string){
    const next=[...selected];next[index]=id;
    for(let i=index+1;i<4;i++)next[i]="";
    setSelected(next);setEcuResult(null);
    if(!id)return;
    if(index<3){await loadStep(index+1,id);return;}
    setEcuBusy(true);setEcuError("");
    try {
      const response=await fetch("/api/ecu-catalogue?"+new URLSearchParams({step:"vehicle",engine:id}),{cache:"no-store"});
      const data=await response.json();
      if(!response.ok)throw new Error(data.error||"Vehicle lookup failed");
      setEcuResult(asRecord(asRecord(data).data ?? data));
    }catch(e){setEcuError(e instanceof Error?e.message:"Vehicle lookup failed");}
    finally{setEcuBusy(false);}
  }
  const [jcsMake,setJcsMake]=useState("");
  const [jcsModel,setJcsModel]=useState("");
  const [jcsEngine,setJcsEngine]=useState("");
  const [jcsResults,setJcsResults]=useState<RecordData[]>([]);
  const [jcsError,setJcsError]=useState("");
  const [jcsBusy,setJcsBusy]=useState(false);
  async function searchJcs(e:FormEvent<HTMLFormElement>) {
    e.preventDefault();setJcsBusy(true);setJcsError("");setJcsResults([]);
    try {
      const response=await fetch("/api/jcs-ecu-catalogue?"+new URLSearchParams({make:jcsMake,model:jcsModel,engine:jcsEngine}),{cache:"no-store"});
      const data=await response.json();
      if(!response.ok)throw new Error(data.error||"Search failed");
      setJcsResults(Array.isArray(data.matches)?data.matches:[]);
      if(!data.matches?.length)setJcsError("No verified ECU record found yet. Please provide an ECU ID or contact JCS.");
    }catch(e){setJcsError(e instanceof Error?e.message:"Search failed");}
    finally{setJcsBusy(false);}
  }
  const [vin,setVin]=useState("");
  const [vinResult,setVinResult]=useState<RecordData|null>(null);
  const [vinError,setVinError]=useState("");
  const [vinBusy,setVinBusy]=useState(false);
  async function decodeVin(e:FormEvent<HTMLFormElement>) {
    e.preventDefault();setVinBusy(true);setVinError("");setVinResult(null);
    try {
      const response=await fetch("/api/vin-decode?"+new URLSearchParams({vin:vin.trim().toUpperCase()}),{cache:"no-store"});
      const data=await response.json();
      if(!response.ok)throw new Error(data.error||"VIN lookup failed");
      setVinResult(asRecord(data));
    } catch(e){setVinError(e instanceof Error?e.message:"VIN lookup failed");}
    finally{setVinBusy(false);}
  }
  const [registration,setRegistration]=useState("");
  const [result,setResult]=useState<Lookup|null>(null);
  const [error,setError]=useState("");
  const [busy,setBusy]=useState(false);
  async function search(e:FormEvent<HTMLFormElement>) {
    e.preventDefault();setBusy(true);setError("");setResult(null);
    try {
      const response=await fetch("/api/vehicle-lookup",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({registration})});
      const data=await response.json();
      if(!response.ok) throw new Error(data.error||"Lookup failed");
      setResult(data);
    } catch(e) {setError(e instanceof Error?e.message:"Vehicle lookup failed");}
    finally {setBusy(false);}
  }
  return <main className="wrap"><nav className="nav"><Link className="brand" href="/">JCS <span>AUTOMOTIVE TUNING</span></Link><Link href="/dashboard">Back to dashboard</Link></nav><section className="card" style={{maxWidth:700,margin:"45px auto"}}><div className="eyebrow">Vehicle information</div><h1>Vehicle &amp; ECU lookup</h1><p>Search ECU records by vehicle or decode a VIN for free. ECU identification and Stage 1 figures require a matched, verified tuning record.</p><h2>JCS ECU database</h2><p>Search verified JCS records by make, model and engine code. This catalogue is being populated; missing entries are not guesses.</p><form onSubmit={searchJcs}><div className="field"><label>Make</label><input value={jcsMake} onChange={e=>setJcsMake(e.target.value)} maxLength={60} placeholder="Volkswagen" required/></div><div className="field"><label>Model</label><input value={jcsModel} onChange={e=>setJcsModel(e.target.value)} maxLength={60} placeholder="Golf" required/></div><div className="field"><label>Engine code</label><input value={jcsEngine} onChange={e=>setJcsEngine(e.target.value)} maxLength={60} placeholder="BLS" required/></div><button className="btn" disabled={jcsBusy}>{jcsBusy?"Searching…":"Search JCS ECU database"}</button></form>{jcsError&&<p role="status">{jcsError}</p>}{jcsResults.map((item,i)=><section key={i}><h3>{display(item.ecu_manufacturer)} {display(item.ecu_family)}</h3><p>ECU part number: {display(item.ecu_part_number)}</p><p>Stock: {display(item.stock_bhp)} bhp / {display(item.stock_torque_nm)} Nm</p><p>Stage 1 estimate: {display(item.stage1_bhp)} bhp / {display(item.stage1_torque_nm)} Nm</p><p>EGR: {display(item.egr_fitment)} · DPF: {display(item.dpf_fitment)} · AdBlue: {display(item.adblue_fitment)}</p><p>Tools: {display(item.supported_tools)}</p><small>Verify actual ECU identification before ordering.</small></section>)}
  <h2>Find your ECU by vehicle</h2><p>Select the exact make, model, generation and engine. ECU fitment is catalogue information and must be confirmed against the vehicle.</p><button className="btn" type="button" onClick={()=>loadStep(0)} disabled={ecuBusy}>{ecuBusy?"Loading…":"Browse vehicle catalogue"}</button>
  {steps.map((step,index)=>options[index].length>0&&<div className="field" key={step}><label htmlFor={step}>{["Make","Model","Generation","Engine"][index]}</label><select id={step} value={selected[index]} onChange={e=>selectStep(index,e.target.value)}><option value="">Select {step}</option>{options[index].map((item,i)=><option key={identifier(item)||i} value={identifier(item)}>{label(item)}</option>)}</select></div>)}
  {ecuError&&<p role="alert">{ecuError}</p>}
  {ecuResult&&<section aria-live="polite"><h2>ECU catalogue result</h2><p>Reference data only. Check ECU hardware/software ID before ordering a file.</p><dl>{Object.entries(ecuResult).filter(([key])=>!["photo","logo","logo_url"].includes(key)).map(([key,value])=><div key={key} style={{marginBottom:10}}><dt><strong>{key.replaceAll("_"," ")}</strong></dt><dd style={{marginLeft:0,overflowWrap:"anywhere"}}>{display(value)}</dd></div>)}</dl></section>}
  <h2>Free VIN decoder</h2><p>Enter a 17-character VIN to retrieve available manufacturer-submitted vehicle specifications from NHTSA vPIC. UK vehicle data may be incomplete.</p><form onSubmit={decodeVin}><div className="field"><label htmlFor="vin">Vehicle identification number (VIN)</label><input id="vin" value={vin} onChange={e=>setVin(e.target.value.toUpperCase())} minLength={17} maxLength={17} pattern="[A-HJ-NPR-Za-hj-npr-z0-9]{17}" placeholder="17-character VIN" autoComplete="off" required/></div><button className="btn" disabled={vinBusy}>{vinBusy?"Decoding…":"Decode VIN (free)"}</button></form>
  {vinError&&<p role="alert">{vinError}</p>}
  {vinResult&&<section aria-live="polite"><h2>VIN decode results</h2>{vinResult.warning&&<p role="status">{display(vinResult.warning)}</p>}<dl>{Object.entries(asRecord(vinResult.vehicle)).map(([key,value])=><div key={key} style={{marginBottom:10}}><dt><strong>{key.replace(/([A-Z])/g," $1")}</strong></dt><dd style={{marginLeft:0}}>{display(value)}</dd></div>)}</dl><p>ECU, Stage 1 gains, EGR, DPF and AdBlue are not verified by this VIN decoder.</p></section>}
  <section><h2>UK registration lookup</h2><p>Registration-based vehicle details require an active DVLA Vehicle Enquiry API connection. This service is not configured yet, so registration searches are temporarily unavailable. You can use the free VIN decoder or search the JCS ECU database above.</p></section></section></main>;
}

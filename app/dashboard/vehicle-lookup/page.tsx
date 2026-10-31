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
type Lookup = { quota?:SearchQuota; vehicle:Vehicle; tuning:{ note:string } };
type SearchQuota = {remaining:number;daily_limit:number;reset_at:string};
export default function VehicleLookup() {
  const steps = ["makes","models","generations","engines"] as const;
  const [options,setOptions]=useState<RecordData[][]>([[],[],[],[]]);
  const [selected,setSelected]=useState(["","","",""]);
  const [quota,setQuota]=useState<SearchQuota|null>(null);
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
      if(data.quota)setQuota(data.quota);
      if(!response.ok)throw new Error(data.error||"Vehicle lookup failed");
      setEcuResult(asRecord(asRecord(data).data ?? data));
    }catch(e){setEcuError(e instanceof Error?e.message:"Vehicle lookup failed");}
    finally{setEcuBusy(false);}
  }
  const [directoryMakes,setDirectoryMakes]=useState<string[]>([]);
  const [directoryModels,setDirectoryModels]=useState<string[]>([]);
  const [directoryMake,setDirectoryMake]=useState("");
  const [directoryYear,setDirectoryYear]=useState(String(new Date().getFullYear()));
  const [directoryModel,setDirectoryModel]=useState("");
  const [directoryBusy,setDirectoryBusy]=useState(false);
  const [directoryError,setDirectoryError]=useState("");
  async function directoryFetch(step:"makes"|"models", make=directoryMake, year=directoryYear) {
    setDirectoryBusy(true);setDirectoryError("");
    try {
      const response=await fetch("/api/vehicle-directory?"+new URLSearchParams({step,make,year}));
      const data=await response.json();
      if(!response.ok)throw new Error(data.error||"Directory unavailable");
      const items=Array.isArray(data.items)?data.items.filter((x:unknown):x is string=>typeof x==="string"):[];
      if(step==="makes")setDirectoryMakes(items);else setDirectoryModels(items);
    }catch(e){setDirectoryError(e instanceof Error?e.message:"Directory unavailable");}
    finally{setDirectoryBusy(false);}
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
      if(data.quota)setQuota(data.quota);
      if(!response.ok)throw new Error(data.error||"Search failed");
      setJcsResults(Array.isArray(data.matches)?data.matches:[]);
      if(!data.matches?.length)setJcsError("No ECU reference record found yet. Please provide an ECU ID or contact JCS.");
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
      if(data.quota)setQuota(data.quota);
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
      if(data.quota)setQuota(data.quota);
      if(!response.ok) throw new Error(data.error||"Lookup failed");
      setResult(data);
    } catch(e) {setError(e instanceof Error?e.message:"Vehicle lookup failed");}
    finally {setBusy(false);}
  }
  return <main className="wrap"><nav className="nav"><Link className="brand" href="/">JCS <span>AUTOMOTIVE TUNING</span></Link><Link href="/dashboard">Back to dashboard</Link></nav><section className="card" style={{maxWidth:700,margin:"45px auto"}}><div className="eyebrow">Vehicle information</div><h1>Vehicle &amp; ECU lookup</h1><p>Customers have 5 shared ECU, tool and vehicle checks per day, resetting at midnight UK time. Each ECU result, VIN decode or registration lookup counts once. Admin accounts are exempt. Browsing makes and models is free.</p>{quota&&<p role="status"><strong>{quota.remaining} of {quota.daily_limit} daily checks remaining.</strong></p>}<p>ECU identification and Stage 1 figures require a matched, verified tuning record.</p><h2>JCS ECU database</h2><p>Search by make and model, optionally narrowing by engine code. Results are provisional unless explicitly marked verified.</p><form onSubmit={searchJcs}><div className="field"><label>Make</label><input value={jcsMake} onChange={e=>setJcsMake(e.target.value)} maxLength={60} placeholder="Volkswagen" required/></div><div className="field"><label>Model</label><input value={jcsModel} onChange={e=>setJcsModel(e.target.value)} maxLength={60} placeholder="Golf" required/></div><div className="field"><label>Engine code</label><input value={jcsEngine} onChange={e=>setJcsEngine(e.target.value)} maxLength={60} placeholder="BLS (optional)"/></div><button className="btn" disabled={jcsBusy}>{jcsBusy?"Searching…":"Search JCS ECU database"}</button></form>{jcsError&&<p role="status">{jcsError}</p>}{jcsResults.map((item,i)=><section key={i}><h3>{display(item.ecu_manufacturer)} {display(item.ecu_family)}</h3><p><strong>{item.verified===true?"Verified JCS record":"Provisional reference — ECU identification not verified"}</strong></p><p>{display(item.make)} {display(item.model)} {display(item.engine_code)} ({display(item.model_year_from)}–{display(item.model_year_to)})</p><p>ECU part number: {display(item.ecu_part_number)}</p>{Boolean(item.verification_notes)&&<p>Verification: {display(item.verification_notes)}</p>}<p>Stock: {display(item.stock_bhp)} bhp / {display(item.stock_torque_nm)} Nm</p><p>Stage 1 estimate: {display(item.stage1_bhp)} bhp / {display(item.stage1_torque_nm)} Nm</p><p>EGR: {display(item.egr_fitment)} · DPF: {display(item.dpf_fitment)} · AdBlue: {display(item.adblue_fitment)}</p><p>Tools: {display(item.supported_tools)}</p><small>Confirm actual ECU hardware/software ID and vehicle equipment before ordering.</small></section>)}
  <h2>Browse makes, models and years (free)</h2><p>Explore the NHTSA vehicle directory without a paid API. It is primarily US-market reference data; a listed model does not confirm a UK variant or exact ECU.</p>
  <button type="button" className="btn" disabled={directoryBusy} onClick={()=>directoryFetch("makes")}>{directoryBusy?"Loading…":"Load all makes"}</button>
  {directoryMakes.length>0&&<div className="field"><label htmlFor="directory-make">Make</label><select id="directory-make" value={directoryMake} onChange={e=>{setDirectoryMake(e.target.value);setDirectoryModels([]);setDirectoryModel("");}}><option value="">Select make</option>{directoryMakes.map(make=><option key={make} value={make}>{make}</option>)}</select></div>}
  {directoryMakes.length>0&&<div className="field"><label htmlFor="directory-year">Model year</label><select id="directory-year" value={directoryYear} onChange={e=>{setDirectoryYear(e.target.value);setDirectoryModels([]);setDirectoryModel("");}}>{Array.from({length:new Date().getFullYear()-1981+3},(_,i)=>new Date().getFullYear()+2-i).map(year=><option key={year} value={year}>{year}</option>)}</select></div>}
  {directoryMake&&<button type="button" className="btn" disabled={directoryBusy} onClick={()=>directoryFetch("models")}>{directoryBusy?"Loading…":"Find models for year"}</button>}
  {directoryModels.length>0&&<div className="field"><label htmlFor="directory-model">Model</label><select id="directory-model" value={directoryModel} onChange={e=>setDirectoryModel(e.target.value)}><option value="">Select model</option>{directoryModels.map(model=><option key={model} value={model}>{model}</option>)}</select></div>}
  {directoryModel&&<p>Selected: {directoryMake} {directoryModel} ({directoryYear}). Exact engine and ECU must be identified separately.</p>}
  {directoryError&&<p role="alert">{directoryError}</p>}
  <h2>VIN decoder (1 daily check)</h2><p>Enter a 17-character VIN to retrieve available manufacturer-submitted vehicle specifications from NHTSA vPIC. UK vehicle data may be incomplete.</p><form onSubmit={decodeVin}><div className="field"><label htmlFor="vin">Vehicle identification number (VIN)</label><input id="vin" value={vin} onChange={e=>setVin(e.target.value.toUpperCase())} minLength={17} maxLength={17} pattern="[A-HJ-NPR-Za-hj-npr-z0-9]{17}" placeholder="17-character VIN" autoComplete="off" required/></div><button className="btn" disabled={vinBusy}>{vinBusy?"Decoding…":"Decode VIN (1 check)"}</button></form>
  {vinError&&<p role="alert">{vinError}</p>}
  {vinResult&&<section aria-live="polite"><h2>VIN decode results</h2>{Boolean(vinResult.warning)&&<p role="status">{display(vinResult.warning)}</p>}<dl>{Object.entries(asRecord(vinResult.vehicle)).map(([key,value])=><div key={key} style={{marginBottom:10}}><dt><strong>{key.replace(/([A-Z])/g," $1")}</strong></dt><dd style={{marginLeft:0}}>{display(value)}</dd></div>)}</dl><p>ECU, Stage 1 gains, EGR, DPF and AdBlue are not verified by this VIN decoder.</p></section>}
  <section><h2>UK registration lookup</h2><p>Registration-based vehicle details require an active DVLA Vehicle Enquiry API connection. This service is not configured yet, so registration searches are temporarily unavailable. You can use the free VIN decoder or search the JCS ECU database above.</p></section></section></main>;
}

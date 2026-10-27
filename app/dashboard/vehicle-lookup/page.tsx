"use client";
import { FormEvent, useState } from "react";
import Link from "next/link";

type Vehicle = { registrationNumber?:string; make?:string; yearOfManufacture?:number; engineCapacity?:number; fuelType?:string; euroStatus?:string; colour?:string };
type Lookup = { vehicle:Vehicle; tuning:{ note:string } };
export default function VehicleLookup() {
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
  return <main className="wrap"><nav className="nav"><Link className="brand" href="/">JCS <span>AUTOMOTIVE TUNING</span></Link><Link href="/dashboard">Back to dashboard</Link></nav><section className="card" style={{maxWidth:700,margin:"45px auto"}}><div className="eyebrow">Vehicle information</div><h1>Registration lookup</h1><p>Look up verified UK vehicle details. ECU identification and Stage 1 figures require a matched tuning record.</p><form onSubmit={search}><div className="field"><label htmlFor="registration">UK registration</label><input id="registration" name="registration" value={registration} onChange={e=>setRegistration(e.target.value.toUpperCase())} maxLength={10} placeholder="AB12 CDE" required/></div><button className="btn" disabled={busy}>{busy?"Searching…":"Search vehicle"}</button></form>{error&&<p role="alert">{error}</p>}{result&&<section aria-live="polite"><h2>Vehicle details</h2><dl>{Object.entries({"Registration":result.vehicle.registrationNumber,"Make":result.vehicle.make,"Year":result.vehicle.yearOfManufacture,"Engine capacity (cc)":result.vehicle.engineCapacity,"Fuel":result.vehicle.fuelType,"Euro classification":result.vehicle.euroStatus,"Colour":result.vehicle.colour}).map(([label,value])=><div key={label} style={{marginBottom:10}}><dt><strong>{label}</strong></dt><dd style={{marginLeft:0}}>{value??"Not available"}</dd></div>)}</dl><h2>ECU &amp; tuning information</h2><p>ECU: Not verified</p><p>Stage 1 power / torque: Not verified</p><p>EGR / DPF / AdBlue: Not verified</p><p>{result.tuning.note}</p></section>}</section></main>;
}

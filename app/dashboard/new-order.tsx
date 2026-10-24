"use client";

import { FormEvent, useState } from "react";
import { ADDONS, ADDON_LABELS, type AddonGroup } from "@/lib/tuning-addons";

const SERVICE_OPTIONS = [
  ["ecu_stage1", "ECU Stage 1 file service - GBP 45"],
  ["dsg_tcu", "DSG / TCU calibration review - GBP 60"],
  ["log_review", "Diagnostic log / file review - GBP 15"],
  ["emissions_diagnostics", "DPF / EGR diagnostics and lawful repair assessment - GBP 25"],
  ["custom_ecu", "Custom ECU tuning - from GBP 180"],
  ["custom_tcu", "Custom DSG / TCU tuning - from GBP 180"],
  ["ecu_tcu_package", "Custom ECU + DSG / TCU package - quote required"],
] as const;

const EXTENSIONS = ["bin","ori","hex","frf","odx","txt","csv","log","zip"];
const MAX_FILE_BYTES = 16 * 1024 * 1024;

export default function NewOrder() {
  const [message,setMessage] = useState("");
  const [busy,setBusy] = useState(false);
  const [file,setFile] = useState<File|null>(null);
  const [service,setService] = useState<string>("ecu_stage1");
  const [fuel,setFuel] = useState<"petrol"|"diesel">("petrol");
  const [addons,setAddons] = useState<string[]>([]);
  const [notes,setNotes] = useState("");

  const tcuService = service === "dsg_tcu" || service === "custom_tcu";
  const reviewOnly = service === "log_review" || service === "emissions_diagnostics";
  const showEcu = !tcuService && !reviewOnly;
  const showTcu = tcuService || service === "ecu_tcu_package";
  const visibleGroups: AddonGroup[] = [
    ...(showEcu ? [fuel] : []),
    ...(showTcu ? ["tcu" as const] : []),
  ];
  const visibleAddons = addons.filter(a => visibleGroups.some(g => a.startsWith(`${g}:`)));
  const quoteRequired = service === "ecu_tcu_package" || visibleAddons.length > 0 ||
    service === "custom_ecu" || service === "custom_tcu";
  const toggle = (key:string, checked:boolean) => setAddons(current =>
    checked ? [...new Set([...current,key])] : current.filter(item=>item!==key)
  );

  async function submit(e:FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (busy) return;
    setMessage("");
    if (file) {
      const ext=file.name.split(".").pop()?.toLowerCase();
      if (!ext || !EXTENSIONS.includes(ext)) { setMessage("Unsupported file type."); return; }
      if (file.size > MAX_FILE_BYTES) { setMessage("Maximum file size is 16 MB."); return; }
    }
    setBusy(true);
    let orderId="";
    try {
      const fd = new FormData(e.currentTarget);
      const payload = Object.fromEntries(fd.entries());
      delete payload.file;
      const res=await fetch("/api/orders",{
        method:"POST",headers:{"Content-Type":"application/json"},
        body:JSON.stringify({...payload,serviceCode:service,notes,addons:visibleAddons,fuelType:showEcu?fuel:null}),
      });
      const data=await res.json();
      if(!res.ok) throw new Error(data.error||"Could not create order.");
      orderId=data.order.id;
      if(file) {
        setMessage("Order created. Preparing secure upload...");
        const up=await fetch("/api/uploads/sign",{
          method:"POST",headers:{"Content-Type":"application/json"},
          body:JSON.stringify({orderId,fileName:file.name,fileSize:file.size,contentType:file.type||"application/octet-stream"})
        });
        const signed=await up.json();
        if(!up.ok) throw new Error(signed.error||"Could not prepare upload.");
        setMessage("Uploading your file...");
        const upload=await fetch(signed.signedUrl,{
          method:"PUT",headers:{"Content-Type":file.type||"application/octet-stream","x-upsert":"false"},body:file
        });
        if(!upload.ok) throw new Error("File transfer failed.");
        const complete=await fetch("/api/uploads/complete",{
          method:"POST",headers:{"Content-Type":"application/json"},
          body:JSON.stringify({orderId,path:signed.path,fileName:file.name,fileSize:file.size})
        });
        const completion=await complete.json();
        if(!complete.ok) throw new Error(completion.error||"Could not attach uploaded file.");
      }
      setMessage(data.quoteRequired
        ? `Request ${orderId} submitted. JCS will review compatibility and confirm your quote.`
        : `Order ${orderId} submitted for review.`);
      e.currentTarget.reset();
      setFile(null);setAddons([]);setNotes("");
    } catch(error) {
      const reason=error instanceof Error?error.message:"Unexpected error.";
      setMessage(orderId
        ? `Order ${orderId} was created, but setup/upload was incomplete: ${reason}. Contact support with this ID.`
        : reason);
    } finally {setBusy(false);}
  }

  return <form onSubmit={submit} style={{display:"grid",gap:20}}>
    <section className="notice">
      <strong>1. Choose your tuning service</strong>
      <div className="field">
        <label htmlFor="serviceCode">Service</label>
        <select id="serviceCode" name="serviceCode" value={service} onChange={e=>setService(e.target.value)} required>
          {SERVICE_OPTIONS.map(([code,label])=><option value={code} key={code}>{label}</option>)}
        </select>
      </div>
    </section>
    <section>
      <h3>2. Vehicle and controller details</h3>
      <div className="field"><label htmlFor="vehicleMake">Vehicle make</label><input id="vehicleMake" name="vehicleMake" placeholder="Volkswagen" maxLength={60} required /></div>
      <div className="field"><label htmlFor="vehicleModel">Model</label><input id="vehicleModel" name="vehicleModel" placeholder="Golf Mk5" maxLength={80} required /></div>
      <div className="field"><label htmlFor="engineCode">Engine code / gearbox</label><input id="engineCode" name="engineCode" placeholder="BKD / DQ250 02E" maxLength={80}/></div>
      <div className="field"><label htmlFor="softwareId">ECU/TCU hardware and software IDs</label><input id="softwareId" name="softwareId" placeholder="Part number / SW version" maxLength={120}/></div>
    </section>
    {(showEcu || showTcu) && <section>
      <h3>3. Requested add-ons</h3>
      {showEcu && <div className="field">
        <label htmlFor="fuelType">Engine fuel type</label>
        <select id="fuelType" value={fuel} onChange={e=>setFuel(e.target.value as "petrol"|"diesel")}>
          <option value="petrol">Petrol</option><option value="diesel">Diesel</option>
        </select>
      </div>}
      {visibleGroups.map(group=><fieldset key={group} style={{border:"1px solid #64748b55",borderRadius:12,padding:16,marginTop:12}}>
        <legend style={{fontWeight:700,padding:"0 8px"}}>{group==="tcu"?"TCU / Gearbox":group==="petrol"?"Petrol ECU":"Diesel ECU"} add-ons</legend>
        <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(220px,1fr))",gap:12}}>
          {ADDONS[group].map(([id,label])=>{
            const key=`${group}:${id}`;
            return <label key={key} style={{display:"flex",gap:10,alignItems:"flex-start",cursor:"pointer"}}>
              <input type="checkbox" checked={addons.includes(key)} onChange={e=>toggle(key,e.target.checked)} disabled={busy}/>
              <span>{label}</span>
            </label>;
          })}
        </div>
      </fieldset>)}
      <p style={{fontSize:13,opacity:.8}}>Add-ons are requests, not guaranteed features. Availability, safety and legal road-use compliance are reviewed before work begins.</p>
    </section>}
    <section>
      <h3>4. Job notes and original file</h3>
      <div className="field">
        <label htmlFor="notes">Job notes</label>
        <textarea id="notes" name="notes" rows={4} value={notes} onChange={e=>setNotes(e.target.value)} placeholder="Symptoms, hardware changes, read tool, goals..." maxLength={2500}/>
      </div>
      <div className="field">
        <label htmlFor="order-file">Original read file (optional)</label>
        <input id="order-file" name="file" type="file" accept=".bin,.ori,.hex,.frf,.odx,.txt,.csv,.log,.zip" disabled={busy}
          onChange={e=>setFile(e.target.files?.[0]||null)}/>
        <small className="file-help">BIN, ORI, HEX, FRF, ODX, TXT, CSV, LOG, ZIP - max 16 MB</small>
        {file && <small className="file-selected">Selected: {file.name} ({(file.size/1024/1024).toFixed(2)} MB)</small>}
      </div>
    </section>
    <section className="notice" aria-live="polite">
      <strong>Order summary</strong>
      <p>{SERVICE_OPTIONS.find(([code])=>code===service)?.[1]}</p>
      {visibleAddons.length>0
        ? <ul>{visibleAddons.map(key=><li key={key}>{ADDON_LABELS[key]}</li>)}</ul>
        : <p>No optional add-ons selected.</p>}
      <strong>{quoteRequired?"Quote required - no automatic add-on charges":"Standard service price - subject to review"}</strong>
      <p style={{fontSize:13}}>Do not upload files containing personal information you lack permission to share. Emissions-related options are diagnostic and lawful-repair services only.</p>
    </section>
    <button className="btn" type="submit" disabled={busy}>{busy?"Submitting...":"Submit tuning request"}</button>
    {message && <p role="status" aria-live="polite">{message}</p>}
  </form>;
}

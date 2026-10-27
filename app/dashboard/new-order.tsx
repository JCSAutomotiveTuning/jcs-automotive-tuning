"use client";

import { FormEvent, useState } from "react";
import { ADDONS, ADDON_LABELS, addonPrice, parseDtcCodes, DTC_REVIEW_PRICE_PENCE, type AddonGroup } from "@/lib/tuning-addons";

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
  const [retryOrderId,setRetryOrderId] = useState<string|null>(null);
  const [retryQuoteRequired,setRetryQuoteRequired] = useState(false);
  const [service,setService] = useState<string>("ecu_stage1");
  const [fuel,setFuel] = useState<"petrol"|"diesel">("petrol");
  const [addons,setAddons] = useState<string[]>([]);
  const [notes,setNotes] = useState("");
  const [dtcReview,setDtcReview] = useState(false);
  const [dtcInput,setDtcInput] = useState("");

  const tcuService = service === "dsg_tcu" || service === "custom_tcu";
  const reviewOnly = service === "log_review" || service === "emissions_diagnostics";
  const showEcu = !tcuService && !reviewOnly;
  const showTcu = tcuService || service === "ecu_tcu_package";
  const visibleGroups: AddonGroup[] = [
    ...(showEcu ? [fuel] : []),
    ...(showTcu ? ["tcu" as const] : []),
  ];
  const visibleAddons = addons.filter(a => visibleGroups.some(g => a.startsWith(`${g}:`)));
  const basePrices: Record<string,number> = {
    ecu_stage1:4500,dsg_tcu:6000,log_review:1500,
    emissions_diagnostics:2500,custom_ecu:18000,custom_tcu:18000,ecu_tcu_package:0,
  };
  const dtcCodes = dtcReview ? parseDtcCodes(dtcInput) : [];
  const dtcTotal = dtcReview && dtcCodes ? DTC_REVIEW_PRICE_PENCE : 0;
  const addonTotal = visibleAddons.reduce((sum,key)=>sum+(addonPrice(key)??0),0) + dtcTotal;
  const quoteRequired = ["ecu_tcu_package","custom_ecu","custom_tcu"].includes(service) ||
    visibleAddons.some(key=>addonPrice(key)===null);
  const pounds=(pence:number)=>new Intl.NumberFormat("en-GB",{style:"currency",currency:"GBP"}).format(pence/100);
  const toggle = (key:string, checked:boolean) => setAddons(current =>
    checked ? [...new Set([...current,key])] : current.filter(item=>item!==key)
  );

  async function submit(e:FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (busy) return;
    setMessage("");

    if (!retryOrderId && dtcReview && !dtcCodes) {
      setMessage("Enter 1-10 valid P or U fault codes.");
      return;
    }

    if (file) {
      const ext = file.name.split(".").pop()?.toLowerCase();
      if (!ext || !EXTENSIONS.includes(ext)) {
        setMessage("Unsupported file type.");
        return;
      }
      if (file.size <= 0 || file.size > MAX_FILE_BYTES) {
        setMessage("File must be between 1 byte and 16 MB.");
        return;
      }
    }

    if (retryOrderId && !file) {
      setMessage("Choose a file to retry the existing order.");
      return;
    }

    setBusy(true);
    let orderId = retryOrderId || "";
    let requiresQuote = retryQuoteRequired;
    const form = e.currentTarget;

    try {
      if (!orderId) {
        const fd = new FormData(form);
        const payload = Object.fromEntries(fd.entries());
        delete payload.file;

        const res = await fetch("/api/orders", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ...payload,
            serviceCode: service,
            notes,
            addons: visibleAddons,
            fuelType: showEcu ? fuel : null,
            dtcReview,
            dtcCodes: dtcReview ? dtcInput : ""
          })
        });

        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Could not create order.");

        orderId = data.order.id;
        requiresQuote = Boolean(data.quoteRequired);
        setRetryOrderId(orderId);
        setRetryQuoteRequired(requiresQuote);
      }

      if (file) {
        setMessage(`Preparing secure upload for order ${orderId}...`);

        const up = await fetch("/api/uploads/sign", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            orderId,
            fileName: file.name,
            fileSize: file.size,
            contentType: file.type || "application/octet-stream"
          })
        });

        const signed = await up.json();
        if (!up.ok) throw new Error(signed.error || "Could not prepare upload.");

        setMessage("Uploading your file...");

        const upload = await fetch(signed.signedUrl, {
          method: "PUT",
          headers: {
            "Content-Type": file.type || "application/octet-stream",
            "x-upsert": "false"
          },
          body: file
        });

        if (!upload.ok) throw new Error("File transfer failed.");

        const complete = await fetch("/api/uploads/complete", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            orderId,
            path: signed.path,
            fileName: file.name,
            fileSize: file.size
          })
        });

        const completion = await complete.json();
        if (!complete.ok) {
          throw new Error(completion.error || "Could not attach uploaded file.");
        }
      }

      setMessage(requiresQuote
        ? `Request ${orderId} created. JCS will review and confirm the quote.`
        : `Order ${orderId} submitted successfully.`);

      setRetryOrderId(null);
      setRetryQuoteRequired(false);
      form.reset();
      setFile(null);
      setAddons([]);
      setNotes("");
      setDtcReview(false);
      setDtcInput("");

    } catch (error) {
      const reason = error instanceof Error ? error.message : "Unexpected error.";

      setMessage(orderId
        ? `Order ${orderId} is saved. ${reason} You can retry the upload without creating another order.`
        : reason);

    } finally {
      setBusy(false);
    }
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
              <span>{label} <strong>({addonPrice(key)===null?"Price to be confirmed":pounds(addonPrice(key)!)})</strong></span>
            </label>;
          })}
        </div>
      </fieldset>)}
      <fieldset style={{border:"1px solid #64748b55",borderRadius:12,padding:16,marginTop:12}}>
        <legend style={{fontWeight:700,padding:"0 8px"}}>DTC code review</legend>
        <label style={{display:"flex",gap:10,alignItems:"center"}}>
          <input type="checkbox" checked={dtcReview} onChange={e=>setDtcReview(e.target.checked)} disabled={busy}/>
          Request DTC investigation / calibration review ({pounds(DTC_REVIEW_PRICE_PENCE)} fixed per request)
        </label>
        {dtcReview && <div className="field" style={{marginTop:12}}>
          <label htmlFor="dtcCodes">P / U fault codes (1-10, separated by commas or spaces)</label>
          <textarea id="dtcCodes" value={dtcInput} onChange={e=>setDtcInput(e.target.value)}
            placeholder="P0401, P2008, U0100" rows={2} maxLength={100} required disabled={busy}/>
          <small>{dtcCodes ? `${dtcCodes.length} unique code(s) - ${pounds(dtcTotal)} total` : "Enter valid five-character P or U codes."} Review does not guarantee removal; safety and legal compliance apply.</small>
        </div>}
      </fieldset>
      <p style={{fontSize:13,opacity:.8}}>Original (ORI/stock) file sourcing is £25 per requested controller, subject to an exact compatible hardware/software match and availability. JCS will confirm suitability before supply. Add-ons are requests, not guaranteed features. Availability, safety and legal road-use compliance are reviewed before work begins.</p>
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
      <p>Base service: {pounds(basePrices[service]??0)}</p>
      <p>Priced add-ons including DTC review: {pounds(addonTotal)}</p>
      {dtcReview && <p>DTC codes: {dtcCodes?.join(", ") || "Invalid / missing codes"}</p>}
      <strong>{quoteRequired
        ? `Indicative subtotal: ${pounds((basePrices[service]??0)+addonTotal)} + custom quote items (final price to be confirmed)`
        : `Calculated total: ${pounds((basePrices[service]??0)+addonTotal)} (subject to review)`}</strong>
      <p style={{fontSize:13}}>Do not upload files containing personal information you lack permission to share. Emissions-related options are diagnostic and lawful-repair services only.</p>
    </section>
    <button className="btn" type="submit" disabled={busy}>{busy?"Processing...":retryOrderId?"Retry Upload":"Submit tuning request"}</button>
    {message && <p role="status" aria-live="polite">{message}</p>}
  </form>;
}

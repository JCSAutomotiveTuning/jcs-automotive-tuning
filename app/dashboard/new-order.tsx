"use client";

import { FormEvent, useEffect, useState } from "react";
import { ADDONS, ADDON_LABELS, addonPrice, parseDtcCodes, DTC_REVIEW_PRICE_PENCE, type AddonGroup } from "@/lib/tuning-addons";

const SERVICE_OPTIONS = [
  ["addons_only", "Add-ons only — pay for selected features"],
  ["ecu_stage1", "ECU Stage 1 file service - GBP 55"],
  ["dsg_tcu", "DSG / TCU calibration review - GBP 70"],
  ["log_review", "ECU / TCU file check & review - GBP 20"],
  ["datalog_analysis", "Datalog analysis (VCDS / OBD / ECU / TCU logs) - GBP 20"],
  ["emissions_diagnostics", "DPF / EGR diagnostics and lawful repair assessment - GBP 30"],
  ["custom_ecu", "Custom ECU tuning - from GBP 195"],
  ["custom_tcu", "Custom DSG / TCU tuning - from GBP 195"],
  ["ecu_tcu_package", "Custom ECU + DSG / TCU package - quote required"],
] as const;

const EXTENSIONS = ["bin","ori","hex","frf","odx","txt","csv","log","zip"];
const MAX_FILE_BYTES = 16 * 1024 * 1024;

export default function NewOrder() {
  const [message,setMessage] = useState("");
  const [busy,setBusy] = useState(false);
  const [file,setFile] = useState<File|null>(null);
  const [logFile,setLogFile] = useState<File|null>(null);
  const [retryOrderId,setRetryOrderId] = useState<string|null>(null);
  const [retryQuoteRequired,setRetryQuoteRequired] = useState(false);
  const [service,setService] = useState<string>("ecu_stage1");
  const [fuel,setFuel] = useState<"petrol"|"diesel">("petrol");
  const [addons,setAddons] = useState<string[]>([]);
  const [notes,setNotes] = useState("");
  const [dtcReview,setDtcReview] = useState(false);
  const [dtcInput,setDtcInput] = useState("");

  useEffect(() => {
    const requested = new URLSearchParams(window.location.search).get("service");
    if (requested && SERVICE_OPTIONS.some(([code]) => code === requested)) setService(requested);
  }, []);

  const tcuService = service === "dsg_tcu" || service === "custom_tcu";
  const reviewOnly = service === "log_review" || service === "datalog_analysis" || service === "emissions_diagnostics";
  const showEcu = !tcuService && !reviewOnly;
  const showTcu = tcuService || service === "ecu_tcu_package" || service === "addons_only";
  const visibleGroups: AddonGroup[] = [
    ...(!reviewOnly ? ["diagnostics" as const] : []),
    ...(showEcu ? [fuel] : []),
    ...(showTcu ? ["tcu" as const] : []),
  ];
  const visibleAddons = addons.filter(a => visibleGroups.some(g => a.startsWith(`${g}:`)));
  const basePrices: Record<string,number> = {
    addons_only:0,ecu_stage1:5500,dsg_tcu:7000,log_review:2000,datalog_analysis:2000,
    emissions_diagnostics:3000,custom_ecu:19500,custom_tcu:19500,ecu_tcu_package:0,
  };
  const dtcCodes = dtcReview ? parseDtcCodes(dtcInput) : [];
  const dtcTotal = dtcReview && dtcCodes ? DTC_REVIEW_PRICE_PENCE : 0;
  const addonTotal = visibleAddons.reduce((sum,key)=>sum+(addonPrice(key)??0),0) + dtcTotal;
  const quoteRequired = ["ecu_tcu_package","custom_ecu","custom_tcu","addons_only"].includes(service) ||
    visibleAddons.some(key=>addonPrice(key)===null);
  const pounds=(pence:number)=>new Intl.NumberFormat("en-GB",{style:"currency",currency:"GBP"}).format(pence/100);
  const toggle = (key:string, checked:boolean) => setAddons(current =>
    checked ? [...new Set([...current,key])] : current.filter(item=>item!==key)
  );

  async function submit(e:FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (busy) return;
    setMessage("");

    if (!retryOrderId && service === "addons_only" && visibleAddons.length === 0 && !dtcReview) {
      setMessage("Select at least one add-on or DTC review for an add-ons-only order.");
      return;
    }

    if (!retryOrderId && dtcReview && !dtcCodes) {
      setMessage("Enter 1-10 valid P or U fault codes.");
      return;
    }

    if (!retryOrderId && service === "datalog_analysis" && !file) {
      setMessage("Please attach a CSV, LOG or TXT datalog for this analysis request.");
      return;
    }
    if (!retryOrderId && visibleAddons.includes("diagnostics:datalog_analysis") && !logFile) {
      setMessage("Please attach a separate CSV, LOG or TXT datalog for the analysis add-on.");
      return;
    }

    for (const uploadFile of [file, logFile].filter((item): item is File => Boolean(item))) {
      const ext = uploadFile.name.split(".").pop()?.toLowerCase();
      if (!ext || !EXTENSIONS.includes(ext)) {
        setMessage("Unsupported file type.");
        return;
      }
      if ((uploadFile === logFile || (service === "datalog_analysis" && uploadFile === file)) && !["csv", "log", "txt"].includes(ext)) {
        setMessage("Datalogs must be CSV, LOG or TXT files.");
        return;
      }
      if (uploadFile.size <= 0 || uploadFile.size > MAX_FILE_BYTES) {
        setMessage("Each file must be between 1 byte and 16 MB.");
        return;
      }
    }

    if (retryOrderId && !file && !logFile) {
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

      for (const uploadFile of [file, logFile].filter((item): item is File => Boolean(item))) {
        setMessage(`Preparing secure upload for order ${orderId}...`);

        const up = await fetch("/api/uploads/sign", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            orderId,
            fileName: uploadFile.name,
            fileSize: uploadFile.size,
            contentType: uploadFile.type || "application/octet-stream"
          })
        });

        const signed = await up.json();
        if (!up.ok) throw new Error(signed.error || "Could not prepare upload.");

        setMessage("Uploading your file...");

        const upload = await fetch(signed.signedUrl, {
          method: "PUT",
          headers: {
            "Content-Type": uploadFile.type || "application/octet-stream",
            "x-upsert": "false"
          },
          body: uploadFile
        });

        if (!upload.ok) throw new Error("File transfer failed.");

        const complete = await fetch("/api/uploads/complete", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            orderId,
            path: signed.path,
            fileName: uploadFile.name,
            fileSize: uploadFile.size
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
      setLogFile(null);
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
      {service === "addons_only" && <p className="notice">Select only the ECU and/or TCU features you need. No Stage 1 or other base tuning service is charged. Final suitability and pricing are reviewed before work begins.</p>}
      {showEcu && <div className="field">
        <label htmlFor="fuelType">Engine fuel type</label>
        <select id="fuelType" value={fuel} onChange={e=>setFuel(e.target.value as "petrol"|"diesel")}>
          <option value="petrol">Petrol</option><option value="diesel">Diesel</option>
        </select>
      </div>}
      {visibleGroups.map(group=><fieldset key={group} style={{border:"1px solid #64748b55",borderRadius:12,padding:16,marginTop:12}}>
        <legend style={{fontWeight:700,padding:"0 8px"}}>{group==="diagnostics"?"Diagnostic":group==="tcu"?"TCU / Gearbox":group==="petrol"?"Petrol ECU":"Diesel ECU"} add-ons</legend>
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
      <p style={{fontSize:13,opacity:.8}}>Original (ORI/stock) file sourcing is £30 per requested controller, subject to an exact compatible hardware/software match and availability. JCS will confirm suitability before supply. Add-ons are requests, not guaranteed features. Availability, safety and legal road-use compliance are reviewed before work begins.</p>
    </section>}
    <section>
      <h3>4. Job notes and original file</h3>
      <div className="field">
        <label htmlFor="notes">{service === "datalog_analysis" ? "Datalog readings, symptoms and test conditions" : service === "log_review" ? "File review details / concerns" : "Job notes"}</label>
        <textarea id="notes" name="notes" rows={4} value={notes} onChange={e=>setNotes(e.target.value)} placeholder={service === "datalog_analysis" ? "Vehicle/ECU type, logger used, units and channels, gear and RPM range, boost/fuelling/shift symptoms..." : service === "log_review" ? "ECU/TCU type, original or modified file, suspected problems, DTCs, and what you want checked..." : "Symptoms, hardware changes, read tool, goals..."} maxLength={2500}/>
      </div>
      {service === "datalog_analysis" && <div className="notice">
        <strong>£20 Datalog Analysis</strong>
        <p>Upload a real CSV, LOG or TXT recording from VCDS, OBD or your ECU/TCU logger. A technician will review the recorded channels and provide findings. This is not an automatic analyser or dyno power measurement.</p>
      </div>}
      {service === "log_review" && <div className="notice">
        <strong>£20 ECU / TCU file review</strong>
        <p>Describe the ECU/TCU file and what you want checked in the notes box above. Attach the original file where available. Datalog analysis is presented separately in the Datalog Review area.</p>
      </div>}
      <div className="field">
        <label htmlFor="order-file">{service === "datalog_analysis" ? "Datalog file (required)" : "Original ECU / TCU read file (optional)"}</label>
        <input id="order-file" name="file" type="file" accept={service === "datalog_analysis" ? ".csv,.log,.txt" : ".bin,.ori,.hex,.frf,.odx,.txt,.csv,.log,.zip"} disabled={busy}
          onChange={e=>setFile(e.target.files?.[0]||null)}/>
        <small className="file-help">BIN, ORI, HEX, FRF, ODX, TXT, CSV, LOG, ZIP - max 16 MB</small>
        {file && <small className="file-selected">Selected: {file.name} ({(file.size/1024/1024).toFixed(2)} MB)</small>}
      </div>
      {visibleAddons.includes("diagnostics:datalog_analysis") && <div className="field">
        <label htmlFor="datalog-file">Datalog Analysis add-on file (required)</label>
        <input id="datalog-file" type="file" accept=".csv,.log,.txt" disabled={busy}
          onChange={e=>setLogFile(e.target.files?.[0] || null)}/>
        <small className="file-help">Attach the separate log recording (CSV, LOG, TXT, max 16 MB). It is uploaded securely alongside the ECU / TCU file.</small>
        {logFile && <small className="file-selected">Selected: {logFile.name} ({(logFile.size/1024/1024).toFixed(2)} MB)</small>}
      </div>}
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
      <p><strong>File submission included:</strong> No separate £20 upload fee or wallet top-up is required. You pay the confirmed service price once through order checkout.</p>
      <p style={{fontSize:13}}>Do not upload files containing personal information you lack permission to share. Emissions-related options are diagnostic and lawful-repair services only.</p>
    </section>
    <button className="btn" type="submit" disabled={busy}>{busy?"Processing...":retryOrderId?"Retry Upload":"Submit tuning request"}</button>
    {message && <p role="status" aria-live="polite">{message}</p>}
  </form>;
}

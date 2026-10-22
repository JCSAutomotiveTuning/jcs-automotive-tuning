"use client";
import { FormEvent, useState } from "react";

export default function NewOrder() {
  const [message,setMessage]=useState("");
  const [busy,setBusy]=useState(false);
  const [selectedFile,setSelectedFile]=useState("");
  async function submit(e:FormEvent<HTMLFormElement>) {
    e.preventDefault(); setMessage("");
    const fd=new FormData(e.currentTarget);
    const file=fd.get("file") as File;
    const allowedExtensions=["bin","ori","hex","frf","odx","txt","csv","log","zip"];
    if(file.size>0) {
      const extension=file.name.split(".").pop()?.toLowerCase();
      if(!extension||!allowedExtensions.includes(extension)) { setMessage("Choose a BIN, ORI, HEX, FRF, ODX, TXT, CSV, LOG or ZIP file."); return; }
      if(file.size>16*1024*1024) { setMessage("The selected file is larger than the 16 MB limit."); return; }
    }
    setBusy(true);
    let orderId="";
    try {
      const res=await fetch("/api/orders",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(Object.fromEntries(fd.entries()))});
      const data=await res.json();
      if(!res.ok) throw new Error(data.error||"Could not create order.");
      orderId=data.order.id;
      if(file.size>0) {
        setMessage("Order created. Preparing a secure upload…");
        const up=await fetch("/api/uploads/sign",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({orderId,fileName:file.name,fileSize:file.size,contentType:file.type||"application/octet-stream"})});
        const signed=await up.json(); if(!up.ok) throw new Error(signed.error||"Could not prepare secure upload.");
        setMessage("Uploading your file…");
        const upload=await fetch(signed.signedUrl,{method:"PUT",headers:{"Content-Type":file.type||"application/octet-stream", "x-upsert":"false"},body:file});
        if(!upload.ok) throw new Error("The file transfer failed.");
        setMessage("File uploaded. Saving its order record…");
        const complete=await fetch("/api/uploads/complete",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({orderId,path:signed.path,fileName:file.name,fileSize:file.size})});
        const completion=await complete.json();
        if(!complete.ok) throw new Error(completion.error||"The file could not be attached to the order.");
      }
      setMessage("Order created: "+orderId+". It is awaiting review. Payment checkout will be enabled after payment providers are configured.");
      (e.target as HTMLFormElement).reset();
      setSelectedFile("");
    } catch(err) {
      const reason=err instanceof Error?err.message:"Unexpected error.";
      setMessage(orderId?`Order ${orderId} was created, but the file upload did not finish: ${reason} Contact support with this order ID.`:reason);
    }
    finally {setBusy(false);}
  }
  return <form onSubmit={submit}><div className="field"><label>Service</label><select name="serviceCode" required><option value="ecu_stage1">ECU Stage 1 — £45</option><option value="dsg_tcu">DSG / TCU review — £60</option><option value="log_review">Diagnostic log / file review — £15</option><option value="emissions_diagnostics">DPF / EGR diagnostics — £25</option></select></div><div className="field"><label>Vehicle make</label><input name="vehicleMake" placeholder="Volkswagen" required maxLength={60}/></div><div className="field"><label>Model</label><input name="vehicleModel" placeholder="Golf Mk5" required maxLength={80}/></div><div className="field"><label>Engine code / gearbox</label><input name="engineCode" placeholder="BKD / DQ250 02E" maxLength={80}/></div><div className="field"><label>ECU/TCU hardware and software IDs</label><input name="softwareId" placeholder="Part number / SW version" maxLength={120}/></div><div className="field"><label>Job notes</label><textarea name="notes" rows={3} placeholder="Symptoms, modifications, tool used to read file…" maxLength={3000}/></div><div className="field"><label htmlFor="order-file">Original read file (optional)</label><input id="order-file" name="file" type="file" accept=".bin,.ori,.hex,.frf,.odx,.txt,.csv,.log,.zip" disabled={busy} onChange={event=>setSelectedFile(event.currentTarget.files?.[0]?.name||"")}/><small className="file-help">BIN, ORI, HEX, FRF, ODX, TXT, CSV, LOG or ZIP · maximum 16 MB</small>{selectedFile&&<small className="file-selected">Selected: {selectedFile}</small>}</div><div className="notice">Uploads are intended for manual review at this stage. Do not upload files containing personal information you do not have permission to share.</div><p><button className="btn" disabled={busy}>{busy?"Submitting…":"Create order"}</button></p>{message&&<p role="status" aria-live="polite">{message}</p>}</form>;
}

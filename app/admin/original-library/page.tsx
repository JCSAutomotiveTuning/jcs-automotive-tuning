"use client";

import { useEffect, useMemo, useState } from "react";
type FileRow = { fileId: string; orderId: string; filename: string; sizeBytes: number; scanStatus: string;
  createdAt: string; hwId: string|null; swId: string|null; category: "identified"|"undefined" };
export default function OriginalLibrary() {
  const [files,setFiles] = useState<FileRow[]>([]);
  const [error,setError] = useState("");
  const [busy,setBusy] = useState("");
  const [query,setQuery] = useState("");
  const [filter,setFilter] = useState("all");
  const [edit,setEdit] = useState<Record<string,{hw:string;sw:string}>>({});
  async function load() {
    const response = await fetch("/api/admin/original-library",{cache:"no-store"});
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "Could not load catalogue");
    setFiles(data.items);
    setEdit(Object.fromEntries(data.items.map((x:FileRow)=>[x.fileId,{hw:x.hwId||"",sw:x.swId||""}])));
  }
  useEffect(()=>{
    const controller = new AbortController();
    void fetch("/api/admin/original-library", { cache:"no-store", signal:controller.signal })
      .then(async response => {
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "Could not load catalogue");
        return data;
      })
      .then(data => {
        if (controller.signal.aborted) return;
        setFiles(data.items);
        setEdit(Object.fromEntries(data.items.map((x:FileRow)=>[x.fileId,{hw:x.hwId||"",sw:x.swId||""}])));
      })
      .catch(e => { if (!controller.signal.aborted) setError(String(e.message||e)); });
    return () => controller.abort();
  },[]);
  const visible = useMemo(()=>files.filter(f=>{
    const matches = filter==="all" || f.category===filter;
    return matches && [f.filename,f.hwId||"",f.swId||"",f.orderId].join(" ").toLowerCase().includes(query.toLowerCase());
  }),[files,filter,query]);
  async function save(fileId:string,clear=false) {
    setBusy(fileId);setError("");
    try {
      const v=edit[fileId]||{hw:"",sw:""};
      const response=await fetch("/api/admin/original-library",{
        method:"PATCH",headers:{"Content-Type":"application/json"},
        body:JSON.stringify({fileId,...(clear?{}:{hwId:v.hw.trim()||undefined,swId:v.sw.trim()||undefined})})
      });
      const data=await response.json();
      if(!response.ok)throw new Error(data.error||"Save failed");
      await load();
    } catch(e){setError(e instanceof Error?e.message:"Could not save")} finally {setBusy("")}
  }
  return <main style={{maxWidth:1100,margin:"0 auto",padding:"36px 18px",color:"#eef6ff"}}>
    <a href="/admin">← Admin dashboard</a>
    <h1 style={{fontSize:30,fontWeight:800,marginTop:16}}>Original ECU/TCU file library</h1>
    <p style={{margin:"12px 0 24px",color:"#a6bacc"}}>Private, admin-only index of customer originals. HW and SW identifiers must be verified before categorisation. Files remain with the original customer order.</p>
    <div style={{display:"flex",gap:12,flexWrap:"wrap",marginBottom:20}}>
      <input aria-label="Search files" placeholder="Search file, HW, SW or order" value={query} onChange={e=>setQuery(e.target.value)}
        style={{padding:12,borderRadius:8,flex:"1 1 240px",color:"#111"}}/>
      <select aria-label="Category" value={filter} onChange={e=>setFilter(e.target.value)} style={{padding:12,borderRadius:8,color:"#111"}}>
        <option value="all">All files</option><option value="identified">Identified HW/SW</option><option value="undefined">Undefined</option>
      </select>
    </div>
    {error && <p role="alert" style={{color:"#ffb7b7",marginBottom:12}}>{error}</p>}
    <p style={{marginBottom:15}}>{visible.length} files · {files.filter(f=>f.category==="undefined").length} undefined</p>
    <div style={{display:"grid",gap:14}}>
      {visible.map(f=><article key={f.fileId} style={{background:"#172736",border:"1px solid #38516a",borderRadius:12,padding:18}}>
        <div style={{display:"flex",justifyContent:"space-between",gap:10,flexWrap:"wrap"}}>
          <strong style={{overflowWrap:"anywhere"}}>{f.filename}</strong>
          <span>{f.category==="identified"?"Identified":"Undefined"} · Scan: {f.scanStatus}</span>
        </div>
        <small style={{color:"#abc0d0"}}>Order {f.orderId.slice(0,8)} · {Math.round(f.sizeBytes/1024)} KB · {new Date(f.createdAt).toLocaleDateString("en-GB")}</small>
        <div style={{display:"flex",gap:12,flexWrap:"wrap",marginTop:15}}>
          <label>HW ID <input aria-label={`HW ID for ${f.filename}`} value={edit[f.fileId]?.hw||""} onChange={e=>setEdit(p=>({...p,[f.fileId]:{...(p[f.fileId]||{hw:"",sw:""}),hw:e.target.value}}))} style={{display:"block",color:"#111",padding:10,borderRadius:6}}/></label>
          <label>SW ID <input aria-label={`SW ID for ${f.filename}`} value={edit[f.fileId]?.sw||""} onChange={e=>setEdit(p=>({...p,[f.fileId]:{...(p[f.fileId]||{hw:"",sw:""}),sw:e.target.value}}))} style={{display:"block",color:"#111",padding:10,borderRadius:6}}/></label>
        </div>
        <div style={{display:"flex",gap:12,marginTop:14,flexWrap:"wrap"}}>
          <button disabled={busy===f.fileId || f.scanStatus!=="clean"} onClick={()=>save(f.fileId)} style={{padding:"9px 15px",background:"#8ed9ff",color:"#102231",borderRadius:7,fontWeight:700}}>Save identifiers</button>
          <button disabled={busy===f.fileId || f.scanStatus!=="clean"} onClick={()=>save(f.fileId,true)} style={{padding:"9px 15px",border:"1px solid #6a8193",borderRadius:7}}>Move to Undefined</button>
          {f.scanStatus==="clean" && <a href={`/api/admin/files/${f.fileId}/download`} onClick={async e=>{e.preventDefault();try{const r=await fetch(`/api/admin/files/${f.fileId}/download`);if(!r.ok)throw Error("Download unavailable");const d=await r.json();window.open(d.url,"_blank","noopener,noreferrer");}catch{setError("Could not open original file")}}} style={{padding:"9px 15px",textDecoration:"underline"}}>Secure download</a>}
        </div>
      </article>)}
    </div>
  </main>;
}

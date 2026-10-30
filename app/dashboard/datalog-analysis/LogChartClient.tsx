"use client";
import { useMemo, useState } from "react";

type LogData={headers:string[];rows:number[][];fileName:string;dropped:number};
const limit=8*1024*1024;
function parseLog(input:string,name:string):LogData {
 const lines=input.replace(/^\uFEFF/,"").split(/\r?\n/).filter(x=>x.trim());
 const split=(s:string)=>{const out:string[]=[];let value="",quote=false;for(let i=0;i<s.length;i++){const c=s[i];if(c==='"'){if(quote&&s[i+1]==='"'){value+='"';i++;}else quote=!quote;}else if(c===','&&!quote){out.push(value.trim());value="";}else value+=c;}out.push(value.trim());return out;};
 const table=lines.slice(0,12000).map(split);
 // VCDS can precede the measurement rows with metadata; locate the first consistently numeric section.
 let start=-1;for(let i=0;i<table.length-2;i++){const numeric=(r:string[])=>r.filter(v=>v!==""&&Number.isFinite(Number(v.replace(/\s/g,"")))).length; if(numeric(table[i])>=3&&numeric(table[i+1])>=3&&numeric(table[i+2])>=3){start=i;break;}}
 if(start<0)throw Error("No numeric CSV data found. Export a CSV file with logged measurement channels.");
 const width=Math.min(60,Math.max(...table.slice(start,start+5).map(r=>r.length)));
 const headerRow=table[start-1]||[];
 const headers=Array.from({length:width},(_,i)=>headerRow[i]&&!Number.isFinite(Number(headerRow[i]))?headerRow[i]:`Channel ${i+1}`);
 const rows:number[][]=[];let dropped=0;
 for(const raw of table.slice(start)){const row=Array.from({length:width},(_,i)=>{const v=(raw[i]||"").replace(/\s/g,"");return v===""?NaN:Number(v);});if(row.filter(Number.isFinite).length<2){dropped++;continue;}rows.push(row);}
 if(rows.length<3)throw Error("At least three valid measurement rows are required.");
 return {headers,rows,fileName:name,dropped};
}
export default function LogChartClient(){
 const [data,setData]=useState<LogData|null>(null),[error,setError]=useState(""),[x,setX]=useState(0),[y,setY]=useState(1),[target,setTarget]=useState(-1);
 const plot=useMemo(()=>{if(!data)return null;const points=data.rows.map(r=>({x:r[x],y:r[y],t:target<0?NaN:r[target]})).filter(p=>Number.isFinite(p.x)&&Number.isFinite(p.y));if(points.length<3)return null;const minX=Math.min(...points.map(p=>p.x)),maxX=Math.max(...points.map(p=>p.x));const ys=points.flatMap(p=>Number.isFinite(p.t)?[p.y,p.t]:[p.y]);const minY=Math.min(...ys),maxY=Math.max(...ys);const sx=(v:number)=>50+(v-minX)/(maxX-minX||1)*690, sy=(v:number)=>245-(v-minY)/(maxY-minY||1)*215;
 const line=(values:{x:number;y:number}[])=>values.map((p,i)=>`${i?"L":"M"}${sx(p.x).toFixed(1)} ${sy(p.y).toFixed(1)}`).join(" ");
 const delta=points.filter(p=>Number.isFinite(p.t)).map(p=>Math.abs(p.y-p.t));
 return {actual:line(points),requested:delta.length?line(points.filter(p=>Number.isFinite(p.t)).map(p=>({x:p.x,y:p.t}))):"",minimum:minY,maximum:maxY,xMin:minX,xMax:maxX,meanError:delta.length?delta.reduce((a,b)=>a+b,0)/delta.length:null,points:points.length};
 },[data,x,y,target]);
 function exportSummary(){if(!data||!plot)return;const report=[ "JCS Automotive Tuning - Local Datalog Summary",`File: ${data.fileName}`,`Samples analysed: ${plot.points}`,`Skipped rows: ${data.dropped}`,`X channel: ${data.headers[x]}`,`Actual channel: ${data.headers[y]}`,`Requested channel: ${target<0?"Not selected":data.headers[target]}`,`Observed minimum: ${plot.minimum.toFixed(3)}`,`Observed maximum: ${plot.maximum.toFixed(3)}`,`Mean absolute difference: ${plot.meanError===null?"Not computed":plot.meanError.toFixed(3)}`,"Interpretation: Descriptive statistics only; no automatic tuning or safety approval. Confirm units, sensor scaling and logging conditions."].join("\n");const blob=new Blob([report],{type:"text/plain;charset=utf-8"});const url=URL.createObjectURL(blob);const a=document.createElement("a");a.href=url;a.download="JCS-datalog-summary.txt";a.click();URL.revokeObjectURL(url);}
 async function read(file?:File){setData(null);setError("");if(!file)return;try{if(file.size===0)throw Error("The log file is empty.");if(file.size>limit)throw Error("Maximum CSV size is 8 MB.");if(!/\.(csv|log|txt)$/i.test(file.name))throw Error("Choose a CSV, LOG or TXT file.");const parsed=parseLog(await file.text(),file.name);setData(parsed);setX(0);setY(Math.min(1,parsed.headers.length-1));setTarget(-1);}catch(e){setError(e instanceof Error?e.message:"Cannot read this log.");}}
 return <section className="card" style={{marginBottom:20}}>
  <h2>Datalog graph analyser</h2><p>Visualise channels from a VCDS or other logger export. Analysis runs locally in your browser; no file is uploaded.</p>
  <div className="field"><label htmlFor="local-datalog">Log file · CSV, LOG or TXT (up to 8 MB)</label><input id="local-datalog" type="file" accept=".csv,.log,.txt" onChange={e=>void read(e.target.files?.[0])}/></div>
  {error&&<p role="alert">{error}</p>}
  {data&&<><p><strong>{data.fileName}</strong> — {data.rows.length} samples · {data.dropped} skipped rows</p>
   <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(180px,1fr))",gap:12,marginTop:16}}>
    <label className="field">X axis <select value={x} onChange={e=>setX(Number(e.target.value))}>{data.headers.map((h,i)=><option key={i} value={i}>{h}</option>)}</select></label>
    <label className="field">Actual channel <select value={y} onChange={e=>setY(Number(e.target.value))}>{data.headers.map((h,i)=><option key={i} value={i}>{h}</option>)}</select></label>
    <label className="field">Requested channel <select value={target} onChange={e=>setTarget(Number(e.target.value))}><option value={-1}>None</option>{data.headers.map((h,i)=><option key={i} value={i}>{h}</option>)}</select></label>
   </div>
   {plot?<><svg viewBox="0 0 780 290" role="img" aria-label={`Graph of ${data.headers[y]} against ${data.headers[x]}`} style={{width:"100%",height:"auto",background:"#101c2a",borderRadius:12,marginTop:12}}>
    <path d="M50 30 V245 H740" stroke="#94a3b8" fill="none"/><path d={plot.actual} fill="none" stroke="#38bdf8" strokeWidth="2"/>{plot.requested&&<path d={plot.requested} fill="none" stroke="#f59e0b" strokeWidth="2"/>}
    <g fill="#e2e8f0" fontSize="13"><text x="8" y="28">{plot.maximum.toFixed(1)}</text><text x="8" y="245">{plot.minimum.toFixed(1)}</text><text x="50" y="267">{plot.xMin.toFixed(1)}</text><text x="685" y="267">{plot.xMax.toFixed(1)}</text><text x="270" y="286">{data.headers[x]}</text></g>
   </svg><p>Blue: actual {data.headers[y]}. {target>=0&&`Amber: requested ${data.headers[target]}.`} {plot.meanError!==null&&`Mean absolute difference: ${plot.meanError.toFixed(2)} (logger units).`}</p></>:<p>Selected channels have insufficient numeric samples.</p>}
   {plot&&<button type="button" className="btn secondary" onClick={exportSummary}>Export analysis summary (TXT)</button>}
   <p>Always verify whether channels use the same units and time base before comparing them. For a technician assessment, submit a datalog review order.</p>
  </>}
 </section>;
}

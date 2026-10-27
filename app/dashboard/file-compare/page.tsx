"use client";
import Link from "next/link";
import { useState } from "react";
type Summary={name:string;size:number;sha256:string};
async function digest(file:File):Promise<Summary>{const b=await file.arrayBuffer();const hash=await crypto.subtle.digest("SHA-256",b);return {name:file.name,size:b.byteLength,sha256:Array.from(new Uint8Array(hash)).map(x=>x.toString(16).padStart(2,"0")).join("")};}
export default function FileCompare(){
 const [left,setLeft]=useState<File|null>(null),[right,setRight]=useState<File|null>(null);
 const [result,setResult]=useState<{a:Summary;b:Summary;changed:number;compared:number;first:number[]}|null>(null);
 const [error,setError]=useState(""),[busy,setBusy]=useState(false);
 async function compare(){if(!left||!right)return;setBusy(true);setError("");setResult(null);
 try{if(left.size>16*1024*1024||right.size>16*1024*1024)throw Error("Maximum file size is 16 MB each.");
 const [a,b,ab,bb]=await Promise.all([digest(left),digest(right),left.arrayBuffer(),right.arrayBuffer()]);
 const x=new Uint8Array(ab),y=new Uint8Array(bb);let changed=0;const first:number[]=[];
 for(let i=0;i<Math.max(x.length,y.length);i++){if(x[i]!==y[i]){changed++;if(first.length<20)first.push(i);}}
 setResult({a,b,changed,compared:Math.max(x.length,y.length),first});}
 catch(e){setError(e instanceof Error?e.message:"Unable to compare files");}finally{setBusy(false);}}
 return <main className="wrap"><nav className="nav"><Link className="brand" href="/dashboard">JCS <span>PORTAL</span></Link><Link className="btn secondary" href="/dashboard">Dashboard</Link></nav><section className="hero"><div className="eyebrow">Calibration tools</div><h1>File <em>comparison.</em></h1><p>Compare original and modified ECU/TCU files locally in your browser. Files are not uploaded by this tool. Byte differences are not a calibration or checksum validation.</p></section><section className="card"><div className="grid"><div><label>Original file</label><input type="file" accept=".bin,.ori,.hex,.frf,.odx" onChange={e=>{setLeft(e.target.files?.[0]||null);setResult(null);}}/></div><div><label>Modified file</label><input type="file" accept=".bin,.ori,.hex,.frf,.odx" onChange={e=>{setRight(e.target.files?.[0]||null);setResult(null);}}/></div></div><button className="btn" type="button" disabled={!left||!right||busy} onClick={compare}>{busy?"Comparing…":"Compare files"}</button>{error&&<p role="alert">{error}</p>}{result&&<div><h2>Comparison results</h2><p>Original: {result.a.name} ({result.a.size.toLocaleString()} bytes)</p><p>Modified: {result.b.name} ({result.b.size.toLocaleString()} bytes)</p><p><strong>{result.changed.toLocaleString()} differing byte positions</strong> across {result.compared.toLocaleString()} positions.</p><p>File sizes {result.a.size===result.b.size?"match":"differ"}.</p><p>Original SHA-256: <code style={{overflowWrap:"anywhere"}}>{result.a.sha256}</code></p><p>Modified SHA-256: <code style={{overflowWrap:"anywhere"}}>{result.b.sha256}</code></p><p>First changed offsets (decimal): {result.first.length?result.first.join(", "):"None"}</p></div>}</section></main>;
}
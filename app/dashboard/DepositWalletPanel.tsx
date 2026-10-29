"use client";
import { useState } from "react";

export default function DepositWalletPanel({ balancePence }: { balancePence: number }) {
 const [busy,setBusy]=useState(false);
 const [error,setError]=useState("");
 async function topUp(amountPence:number) {
   if(busy) return;
   setBusy(true);setError("");
   try {
     const res=await fetch("/api/wallet/checkout",{
       method:"POST",credentials:"same-origin",headers:{"Content-Type":"application/json"},
       body:JSON.stringify({amountPence})
     });
     const data=await res.json();
     if(!res.ok || !data.url || typeof data.url!=="string") throw new Error(data.error || "Could not start wallet top-up");
     window.location.assign(data.url);
   } catch(e) { setError(e instanceof Error?e.message:"Could not start wallet top-up");setBusy(false); }
 }
 return <section className="card">
   <h2>JCS submission wallet</h2>
   <p>Available verified credit: <strong>£{(balancePence/100).toFixed(2)}</strong></p>
   <p>A £20 deposit is required for each new order. It is deducted once and credited against your final tuning invoice — not charged again. Retries do not use more credit.</p>
   <div style={{display:"flex",gap:10,flexWrap:"wrap"}}>
    {[2000,4000,10000].map(amount=><button type="button" className="btn secondary" key={amount} disabled={busy} onClick={()=>void topUp(amount)}>Add £{amount/100}</button>)}
   </div>
   {balancePence<2000&&<p>Top up at least £{((2000-balancePence)/100).toFixed(2)} before creating a tuning request.</p>}
   <p>Legacy test-mode wallet balances do not count as available deposit credit. Contact support to discuss a cancelled order or unused credit.</p>
   {error&&<p role="alert" className="error-message">{error}</p>}
 </section>;
}

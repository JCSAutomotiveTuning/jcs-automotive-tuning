"use client";
import { useState } from "react";

type DepositEvent={id:string;amount_pence:number;transaction_type:string;description:string|null;created_at:string;order_id:string|null};
export default function DepositWalletPanel({ balancePence, events=[] }: { balancePence: number; events?: DepositEvent[] }) {
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
   <p>£20 verified credit is required for every new job. £20 is reserved and credited to the final price. If the final price is below £20, unused credit returns to this wallet after JCS confirms the job. Retries do not reserve more credit.</p>
   <div style={{display:"flex",gap:10,flexWrap:"wrap"}}>
    {[2000,4000,10000].map(amount=><button type="button" className="btn secondary" key={amount} disabled={busy} onClick={()=>void topUp(amount)}>Add £{amount/100}</button>)}
   </div>
   <details style={{marginTop:14}}><summary style={{cursor:"pointer",fontWeight:700}}>Recent wallet activity ({events.length})</summary>
    {events.length===0?<p>No deposit wallet transactions to display.</p>:<div style={{display:"grid",gap:8,marginTop:12}}>{events.map(e=><div key={e.id} style={{display:"flex",justifyContent:"space-between",gap:12,borderBottom:"1px solid #293341",paddingBottom:8}}>
      <div><strong>{e.transaction_type==="top_up"?"Wallet top-up":e.transaction_type==="order_deposit"?"Order deposit":e.transaction_type==="deposit_release"?"Deposit returned":e.transaction_type==="deposit_remainder"?"Unused deposit returned":"Wallet adjustment"}</strong><div style={{fontSize:12,opacity:.75}}>{new Date(e.created_at).toLocaleString("en-GB")}{e.description?" · "+e.description:""}</div></div>
      <strong style={{whiteSpace:"nowrap"}}>{e.amount_pence>=0?"+":"−"}£{(Math.abs(e.amount_pence)/100).toFixed(2)}</strong>
    </div>)}</div>}
   </details>
   {balancePence<2000&&<p>Top up at least £{((2000-balancePence)/100).toFixed(2)} before creating a tuning request.</p>}
   <p>Legacy test-mode wallet balances do not count as available deposit credit. Contact support to discuss a cancelled order or unused credit.</p>
   {error&&<p role="alert" className="error-message">{error}</p>}
 </section>;
}

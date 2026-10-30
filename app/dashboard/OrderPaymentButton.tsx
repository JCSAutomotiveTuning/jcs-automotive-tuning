
"use client";

import { useState } from "react";

export default function OrderPaymentButton({
  orderId, bankEnabled=false,
}: {
  orderId: string;
  bankEnabled?: boolean;
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [bank, setBank] = useState<{accountName:string;sortCode:string;accountNumber:string;reference:string;amountPence:number;notice:string}|null>(null);

  async function bankInstructions() {
    setLoading(true);setError("");
    try {const response=await fetch("/api/orders/bank-transfer",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({orderId})});const result=await response.json();if(!response.ok)throw Error(result.error||"Bank transfer unavailable");setBank(result);}catch(e){setError(e instanceof Error?e.message:"Bank transfer unavailable");}finally{setLoading(false);}
  }

  async function startPayment() {
    setLoading(true);
    setError("");

    try {
      const response = await fetch("/api/orders/checkout", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ orderId }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Could not start payment.");
      }

      if (typeof result.url !== "string") {
        throw new Error("Stripe did not return a checkout link.");
      }

      window.location.assign(result.url);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Something went wrong. Please try again."
      );
      setLoading(false);
    }
  }

  return (
    <div className="mt-3">
      <button
        type="button"
        onClick={startPayment}
        disabled={loading}
        className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {loading ? "Connecting to Stripe..." : "Pay Now"}
      </button>

      {bankEnabled&&<button type="button" onClick={()=>void bankInstructions()} disabled={loading} className="ml-2 rounded-lg border border-blue-500 px-4 py-2 text-sm font-semibold text-blue-300 disabled:opacity-60">Pay by bank transfer</button>}
      {bank&&<div className="mt-4 rounded-lg border border-blue-700 p-4 text-sm"><h3 className="font-bold">Bank transfer instructions</h3><p>Amount due: <strong>£{(bank.amountPence/100).toFixed(2)}</strong></p><p>Account name: <strong>{bank.accountName}</strong></p><p>Sort code: <strong>{bank.sortCode}</strong></p><p>Account number: <strong>{bank.accountNumber}</strong></p><p>Payment reference: <strong>{bank.reference}</strong></p><p className="mt-2">{bank.notice}</p></div>}
      {error && (
        <p role="alert" className="mt-2 text-sm text-red-600">
          {error}
        </p>
      )}
    </div>
  );
}

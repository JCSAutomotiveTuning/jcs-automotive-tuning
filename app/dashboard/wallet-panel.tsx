"use client";

import { MaskedAmount } from "@/components/PriceVisibility";

const formatGBP = (pence: number) =>
  new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP" }).format(pence / 100);

export default function WalletPanel({ balancePence }: { balancePence: number }) {
  return (
    <section className="card">
      <h2>Legacy wallet credit</h2>
      <p>Existing balance: <strong><MaskedAmount>{formatGBP(balancePence)}</MaskedAmount></strong></p>
      <p>File uploads are included in your service price. No separate £20 upload charge or wallet top-up is required. New top-ups are disabled while historical credits are reconciled.</p>
      {balancePence > 0 && <p>Existing wallet credit is preserved. Please contact support about how to apply or refund it; no automatic deduction will be made.</p>}
    </section>
  );
}

"use client";

import Link from "next/link";
import { MaskedAmount } from "@/components/PriceVisibility";

const formatGBP = (pence: number) =>
  new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP" }).format(pence / 100);

export default function WalletPanel({ balancePence }: { balancePence: number }) {
  // Wallet is a retired payment method. Do not invite new customers to top up.
  if (balancePence <= 0) return null;
  return (
    <section className="card" aria-label="Historical wallet credit">
      <h2>Historical account credit</h2>
      <p><strong><MaskedAmount>{formatGBP(balancePence)}</MaskedAmount></strong> remains on this account from the previous wallet system.</p>
      <p>ECU/TCU file uploads are included in the quoted service price. You do not need to buy upload credits, and new wallet top-ups are disabled.</p>
      <p>This historical credit has not been deducted or removed. For help with an eligible credit or refund, <Link href="/dashboard/support">contact JCS Support</Link>.</p>
    </section>
  );
}

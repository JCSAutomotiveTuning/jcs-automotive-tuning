"use client";

import { MaskedAmount } from "@/components/PriceVisibility";
import { useState } from "react";

type WalletPanelProps = {
  balancePence: number;
};

const formatGBP = (pence: number) =>
  new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
  }).format(pence / 100);

export default function WalletPanel({ balancePence }: WalletPanelProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function topUp() {
    setLoading(true);
    setError("");

    try {
      const response = await fetch("/api/wallet/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });

      const result = await response.json();

      if (!response.ok || !result.url) {
        setError(result.error || "Could not start your wallet top-up.");
        setLoading(false);
        return;
      }

      window.location.assign(result.url);
    } catch {
      setError("Connection error. Please try again.");
      setLoading(false);
    }
  }

  return (
    <section className="card">
      <h2>Your wallet</h2>

      <p>
        Available credit:{" "}
        <strong>
          <MaskedAmount>{formatGBP(balancePence)}</MaskedAmount>
        </strong>
      </p>

      <p>
        Add {formatGBP(2000)} securely through Stripe.
        File submissions are charged at the price shown on each order.
      </p>

      <button
        className="btn blue"
        type="button"
        onClick={topUp}
        disabled={loading}
      >
        {loading
          ? "Connecting to Stripe..."
          : `Top up ${formatGBP(2000)}`}
      </button>

      {error && <p role="alert">{error}</p>}
    </section>
  );
}

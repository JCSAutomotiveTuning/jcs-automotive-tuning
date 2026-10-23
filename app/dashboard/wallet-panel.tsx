
"use client";

import { useState } from "react";

type WalletPanelProps = {
  balancePence: number;
};

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
        <strong>£{(balancePence / 100).toFixed(2)}</strong>
      </p>
      <p>
        Add £20 securely through Stripe. Each new file submission costs £20.
      </p>
      <button
        className="btn blue"
        type="button"
        onClick={topUp}
        disabled={loading}
      >
        {loading ? "Connecting to Stripe..." : "Top up £20"}
      </button>
      {error && <p role="alert">{error}</p>}
    </section>
  );
}

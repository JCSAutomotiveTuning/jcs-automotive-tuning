"use client";
import { useState } from "react";
export default function FinishedFileDownload({ fileId, filename }: { fileId: string; filename: string }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function download() {
    if (busy) return;
    setBusy(true); setError("");
    try {
      const response = await fetch(`/api/orders/files/${encodeURIComponent(fileId)}/download`, { cache: "no-store" });
      const body = await response.json().catch(() => null);
      if (!response.ok || typeof body?.url !== "string") throw new Error(body?.error || "Download unavailable.");
      window.location.assign(body.url);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Download unavailable.");
      setBusy(false);
    }
  }
  return <div className="order-detail">
    <button type="button" className="btn blue" disabled={busy} onClick={() => void download()}>
      {busy ? "Preparing secure download…" : `Download finished file: ${filename}`}
    </button>
    {error && <p role="alert">{error}</p>}
  </div>;
}

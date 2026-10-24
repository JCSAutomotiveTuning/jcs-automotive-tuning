"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { AdminArea, Panel, Feedback, apiJson, dateTime, money } from "../_components/AdminArea";

type Customer = {
  id: string;
  email: string | null;
  created_at: string;
  wallet: { user_id: string; balance_pence: number; updated_at: string | null };
};

function poundsToPence(value: string): number | null {
  const clean = value.trim();
  if (!/^\d+(\.\d{1,2})?$/.test(clean)) return null;
  const [whole, decimal = ""] = clean.split(".");
  const pence = Number(whole) * 100 + Number(decimal.padEnd(2, "0"));
  return Number.isSafeInteger(pence) && pence > 0 && pence <= 1000000 ? pence : null;
}

export default function WalletManager() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [query, setQuery] = useState("");
  const [amount, setAmount] = useState("");
  const [direction, setDirection] = useState<"credit" | "debit">("credit");
  const [reason, setReason] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const reload = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const result = await apiJson<{ customers: Customer[] }>("/api/admin/wallet");
      setCustomers(result.customers);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load wallets.");
    } finally {
      setLoading(false);
    }
  }, []);
  // Fetch on mount; the promise callbacks update state asynchronously.
  // Keep reload() for the explicit Refresh button and post-adjustment refresh.
  useEffect(() => {
    let active = true;
    void apiJson<{ customers: Customer[] }>("/api/admin/wallet")
      .then((result) => {
        if (active) setCustomers(result.customers);
      })
      .catch((err: unknown) => {
        if (active) setError(err instanceof Error ? err.message : "Unable to load wallets.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => { active = false; };
  }, []);

  const filtered = useMemo(() => customers.filter((c) => (c.email ?? c.id).toLowerCase().includes(query.trim().toLowerCase())), [customers, query]);
  const selected = customers.find((c) => c.id === selectedId);
  const parsedAmount = poundsToPence(amount);
  const signedAmount = parsedAmount === null ? null : parsedAmount * (direction === "credit" ? 1 : -1);
  const balance = customers.reduce((sum, c) => sum + Number(c.wallet.balance_pence || 0), 0);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(""); setSuccess("");
    if (!selected || signedAmount === null || !reason.trim()) {
      setError("Select a customer, enter £0.01–£10,000.00 and provide a reason.");
      return;
    }
    const message = `${direction === "credit" ? "ADD" : "DEDUCT"} ${money(parsedAmount!)} ${direction === "credit" ? "to" : "from"} ${selected.email ?? selected.id}?\nReason: ${reason.trim()}`;
    if (!window.confirm(message)) return;
    setSaving(true);
    try {
      await apiJson<{ balancePence: number }>("/api/admin/wallet", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: selected.id, amountPence: signedAmount, reason: reason.trim() }),
      });
      setSuccess("Wallet adjustment saved. Refreshing customer balances…");
      setAmount(""); setReason("");
      await reload();
      setSuccess("Wallet adjustment completed. Balances refreshed.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to adjust wallet.");
    } finally { setSaving(false); }
  }

  return (
    <AdminArea active="wallet" title="Wallet & credits" description="View customer credit balances and make audited manual adjustments. Payments and Stripe top-ups should be handled through their own checkout flows.">
      <div className="mb-6 grid gap-4 sm:grid-cols-2">
        <Panel><p className="text-sm text-slate-400">Total customer credits</p><p className="mt-2 text-3xl font-black text-white">{money(balance)}</p><p className="mt-2 text-xs text-slate-500">Customers currently returned by the wallet API</p></Panel>
        <Panel><p className="text-sm text-slate-400">Customer accounts loaded</p><p className="mt-2 text-3xl font-black text-white">{customers.length}</p><p className="mt-2 text-xs text-slate-500">The API currently limits profiles to 500</p></Panel>
      </div>
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.35fr)_minmax(330px,0.8fr)]">
        <Panel>
          <div className="mb-5 flex flex-wrap items-center justify-between gap-3"><h2 className="text-lg font-bold">Customer balances</h2><button onClick={() => void reload()} disabled={loading || saving} className="rounded-xl bg-sky-400 px-4 py-2 text-sm font-bold text-slate-950 disabled:opacity-50">Refresh</button></div>
          <input aria-label="Search customers" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search customer email" className="mb-4 w-full rounded-xl border border-white/10 bg-[#090d14] px-4 py-3 text-sm text-white focus:border-sky-400 focus:outline-none" />
          {loading ? <p role="status" className="py-8 text-slate-400">Loading wallets…</p> : (
            <div className="max-h-[630px] space-y-2 overflow-y-auto pr-1">
              {filtered.map((c) => <button key={c.id} onClick={() => { setSelectedId(c.id); setError(""); setSuccess(""); }} className={`flex w-full items-center justify-between gap-3 rounded-xl border p-4 text-left transition ${selectedId === c.id ? "border-sky-400/40 bg-sky-400/10" : "border-white/[0.07] bg-white/[0.02] hover:bg-white/[0.05]"}`}>
                <span className="min-w-0"><span className="block break-all text-sm font-semibold text-white">{c.email ?? c.id}</span><span className="mt-1 block text-xs text-slate-500">Updated: {dateTime(c.wallet.updated_at)}</span></span>
                <span className="shrink-0 text-sm font-bold tabular-nums text-sky-300">{money(Number(c.wallet.balance_pence || 0))}</span>
              </button>)}
              {filtered.length === 0 && <p className="py-8 text-center text-sm text-slate-400">No matching customers.</p>}
            </div>
          )}
        </Panel>
        <Panel>
          <h2 className="text-lg font-bold">Manual credit adjustment</h2>
          <p className="mt-2 text-xs leading-5 text-slate-400">Select a customer on the left. Every adjustment requires a reason and confirmation.</p>
          <form onSubmit={(e) => void submit(e)} className="mt-6 space-y-4">
            <div><label className="mb-1.5 block text-xs font-bold text-slate-400">Selected customer</label><p className="min-h-11 break-all rounded-xl border border-white/10 bg-[#090d14] px-3 py-3 text-sm">{selected?.email ?? "Select a customer"}</p></div>
            {selected && <p className="text-sm text-slate-400">Current balance: <strong className="text-white">{money(Number(selected.wallet.balance_pence || 0))}</strong></p>}
            <div><label htmlFor="jcs-direction" className="mb-1.5 block text-xs font-bold text-slate-400">Adjustment</label><select id="jcs-direction" value={direction} onChange={(e) => setDirection(e.target.value as "credit" | "debit")} className="w-full rounded-xl border border-white/10 bg-[#090d14] px-3 py-3 text-sm"><option value="credit">Add credit (+)</option><option value="debit">Deduct credit (−)</option></select></div>
            <div><label htmlFor="jcs-amount" className="mb-1.5 block text-xs font-bold text-slate-400">Amount (£)</label><input id="jcs-amount" value={amount} onChange={(e) => setAmount(e.target.value)} inputMode="decimal" placeholder="20.00" required className="w-full rounded-xl border border-white/10 bg-[#090d14] px-3 py-3 text-sm focus:border-sky-400 focus:outline-none" /></div>
            <div><label htmlFor="jcs-reason" className="mb-1.5 block text-xs font-bold text-slate-400">Reason (audit trail)</label><textarea id="jcs-reason" value={reason} onChange={(e) => setReason(e.target.value)} maxLength={500} required rows={3} placeholder="e.g. Credit correction following customer support request" className="w-full resize-y rounded-xl border border-white/10 bg-[#090d14] px-3 py-3 text-sm focus:border-sky-400 focus:outline-none" /></div>
            <button type="submit" disabled={saving || loading || !selected || signedAmount === null || !reason.trim()} className="w-full rounded-xl bg-sky-400 px-4 py-3 text-sm font-extrabold text-slate-950 transition hover:bg-sky-300 disabled:cursor-not-allowed disabled:opacity-50">{saving ? "Saving…" : "Confirm adjustment"}</button>
          </form>
          {error && <div className="mt-4"><Feedback message={error} error /></div>}
          {success && <div className="mt-4"><Feedback message={success} /></div>}
        </Panel>
      </div>
    </AdminArea>
  );
}

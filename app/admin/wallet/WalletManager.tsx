"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { AdminArea, Panel, Feedback, apiJson, dateTime, money } from "../_components/AdminArea";

type Account = {
  id: string;
  email: string | null;
  role?: string | null;
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
  const [accounts, setAccounts] = useState<Account[]>([]);
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
      const result = await apiJson<{ customers: Account[] }>("/api/admin/wallet");
      setAccounts(result.customers);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load wallets.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let active = true;
    void apiJson<{ customers: Account[] }>("/api/admin/wallet")
      .then((result) => {
        if (active) setAccounts(result.customers);
      })
      .catch((err: unknown) => {
        if (active) setError(err instanceof Error ? err.message : "Unable to load wallets.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => { active = false; };
  }, []);

  const filtered = useMemo(() => {
    const term = query.trim().toLowerCase();
    return accounts.filter((account) =>
      [account.email ?? "", account.id, account.role ?? ""].some((value) => value.toLowerCase().includes(term))
    );
  }, [accounts, query]);
  const selected = accounts.find((account) => account.id === selectedId);
  const parsedAmount = poundsToPence(amount);
  const signedAmount = parsedAmount === null ? null : parsedAmount * (direction === "credit" ? 1 : -1);
  const balance = accounts.reduce((sum, account) => sum + Number(account.wallet.balance_pence || 0), 0);
  const insufficientFunds = direction === "debit" && selected && parsedAmount !== null && parsedAmount > Number(selected.wallet.balance_pence || 0);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setSuccess("");
    if (!selected || signedAmount === null || !reason.trim()) {
      setError("Select an account, enter £0.01â€“£10,000.00 and provide a reason.");
      return;
    }
    if (insufficientFunds) {
      setError("The deduction exceeds the selected account&apos;s current balance.");
      return;
    }
    const message = `${direction === "credit" ? "ADD" : "DEDUCT"} ${money(parsedAmount!)} ${direction === "credit" ? "to" : "from"} ${selected.email ?? selected.id}?\nReason: ${reason.trim()}`;
    if (!window.confirm(message)) return;
    setSaving(true);
    try {
      await apiJson<{ balancePence: number }>("/api/admin/wallet", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: selected.id, amountPence: signedAmount, reason: reason.trim() }),
      });
      setSuccess("Wallet adjustment saved. Refreshing account balances…");
      setAmount("");
      setReason("");
      await reload();
      setSuccess("Wallet adjustment completed. Balances refreshed.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to adjust wallet.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <AdminArea active="wallet" title="Wallet & credits" description="View account credit balances and make audited manual adjustments. Payments and Stripe top-ups should be handled through their own checkout flows.">
      <div className="mb-6 grid gap-4 sm:grid-cols-2">
        <Panel><p className="text-sm text-slate-400">Total account credits</p><p className="mt-2 text-3xl font-black text-white">{money(balance)}</p><p className="mt-2 text-xs text-slate-500">Accounts currently returned by the wallet API</p></Panel>
        <Panel><p className="text-sm text-slate-400">Accounts loaded</p><p className="mt-2 text-3xl font-black text-white">{accounts.length}</p><p className="mt-2 text-xs text-slate-500">The API currently limits profiles to 500</p></Panel>
      </div>
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.35fr)_minmax(330px,0.8fr)]">
        <Panel>
          <div className="mb-5 flex flex-wrap items-center justify-between gap-3"><h2 className="text-lg font-bold">Account balances</h2><button type="button" onClick={() => void reload()} disabled={loading || saving} className="rounded-xl bg-sky-400 px-4 py-2 text-sm font-bold text-slate-950 disabled:opacity-50">Refresh</button></div>
          <input aria-label="Search accounts" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search email, account ID or role" className="mb-4 w-full rounded-xl border border-white/10 bg-[#090d14] px-4 py-3 text-sm text-white focus:border-sky-400 focus:outline-none" />
          {loading ? <p role="status" className="py-8 text-slate-400">Loading wallets…</p> : (
            <div className="max-h-[630px] space-y-2 overflow-y-auto pr-1">
              {filtered.map((account) => <button type="button" key={account.id} onClick={() => { setSelectedId(account.id); setError(""); setSuccess(""); }} aria-pressed={selectedId === account.id} className={`flex w-full items-center justify-between gap-3 rounded-xl border p-4 text-left transition ${selectedId === account.id ? "border-sky-400/40 bg-sky-400/10" : "border-white/[0.07] bg-white/[0.02] hover:bg-white/[0.05]"}`}>
                <span className="min-w-0"><span className="block break-all text-sm font-semibold text-white">{account.email ?? account.id}</span><span className="mt-1 block text-xs capitalize text-sky-300">{account.role ?? "Account"}</span><span className="mt-1 block text-xs text-slate-500">Updated: {dateTime(account.wallet.updated_at)}</span></span>
                <span className="shrink-0 text-sm font-bold tabular-nums text-sky-300">{money(Number(account.wallet.balance_pence || 0))}</span>
              </button>)}
              {filtered.length === 0 && <p className="py-8 text-center text-sm text-slate-400">No matching accounts.</p>}
            </div>
          )}
        </Panel>
        <Panel>
          <h2 className="text-lg font-bold">Manual credit adjustment</h2>
          <p className="mt-2 text-xs leading-5 text-slate-400">Choose an account below or click one on the left. Only administrators can apply adjustments.</p>
          <form onSubmit={(e) => void submit(e)} className="mt-6 space-y-4">
            <div><label htmlFor="jcs-account" className="mb-1.5 block text-xs font-bold text-slate-400">Select account</label><select id="jcs-account" value={selectedId} onChange={(e) => { setSelectedId(e.target.value); setError(""); setSuccess(""); }} disabled={loading || saving} required className="w-full rounded-xl border border-white/10 bg-[#090d14] px-3 py-3 text-sm text-white focus:border-sky-400 focus:outline-none disabled:opacity-50"><option value="">Choose an account…</option>{accounts.map((account) => <option key={account.id} value={account.id}>{account.email ?? account.id} ({account.role ?? "account"}) — {money(Number(account.wallet.balance_pence || 0))}</option>)}</select></div>
            {selected && <p className="text-sm text-slate-400">Current balance: <strong className="text-white">{money(Number(selected.wallet.balance_pence || 0))}</strong></p>}
            <div><label htmlFor="jcs-direction" className="mb-1.5 block text-xs font-bold text-slate-400">Adjustment</label><select id="jcs-direction" value={direction} onChange={(e) => setDirection(e.target.value as "credit" | "debit")} className="w-full rounded-xl border border-white/10 bg-[#090d14] px-3 py-3 text-sm text-white"><option value="credit">Add credit (+)</option><option value="debit">Deduct credit (−)</option></select></div>
            <div><label htmlFor="jcs-amount" className="mb-1.5 block text-xs font-bold text-slate-400">Amount (£)</label><input id="jcs-amount" value={amount} onChange={(e) => setAmount(e.target.value)} inputMode="decimal" placeholder="20.00" required className="w-full rounded-xl border border-white/10 bg-[#090d14] px-3 py-3 text-sm text-white focus:border-sky-400 focus:outline-none" /></div>
            <div><label htmlFor="jcs-reason" className="mb-1.5 block text-xs font-bold text-slate-400">Reason (audit trail)</label><textarea id="jcs-reason" value={reason} onChange={(e) => setReason(e.target.value)} maxLength={500} required rows={3} placeholder="e.g. Credit correction following customer support request" className="w-full resize-y rounded-xl border border-white/10 bg-[#090d14] px-3 py-3 text-sm text-white focus:border-sky-400 focus:outline-none" /></div>
            {insufficientFunds && <p role="alert" className="text-sm text-rose-300">This deduction exceeds the account&apos;s current balance.</p>}
            <button type="submit" disabled={saving || loading || !selected || signedAmount === null || !reason.trim() || Boolean(insufficientFunds)} className="w-full rounded-xl bg-sky-400 px-4 py-3 text-sm font-extrabold text-slate-950 transition hover:bg-sky-300 disabled:cursor-not-allowed disabled:opacity-50">{saving ? "Saving…" : "Confirm adjustment"}</button>
          </form>
          {error && <div className="mt-4"><Feedback message={error} error /></div>}
          {success && <div className="mt-4"><Feedback message={success} /></div>}
        </Panel>
      </div>
    </AdminArea>
  );
}

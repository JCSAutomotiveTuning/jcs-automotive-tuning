"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { AdminArea, Panel, Feedback, apiJson, dateTime, money } from "../_components/AdminArea";

type Transaction = {
  id: string;
  user_id: string;
  amount_pence: number;
  transaction_type: string;
  stripe_session_id: string | null;
  description: string | null;
  created_at: string;
  order_id: string | null;
  customer_email: string;
};

export default function TransactionsManager() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [type, setType] = useState("all");

  const reload = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const result = await apiJson<{ transactions: Transaction[] }>("/api/admin/transactions");
      setTransactions(result.transactions);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load transactions.");
    } finally { setLoading(false); }
  }, []);
  // Fetch on mount; the promise callbacks update state asynchronously.
  // Keep reload() for the explicit Refresh button and post-adjustment refresh.
  useEffect(() => {
    let active = true;
    void apiJson<{ transactions: Transaction[] }>("/api/admin/transactions")
      .then((result) => {
        if (active) setTransactions(result.transactions);
      })
      .catch((err: unknown) => {
        if (active) setError(err instanceof Error ? err.message : "Unable to load transactions.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => { active = false; };
  }, []);

  const types = useMemo(() => Array.from(new Set(transactions.map((t) => t.transaction_type))).sort(), [transactions]);
  const filtered = useMemo(() => transactions.filter((t) => {
    if (type !== "all" && t.transaction_type !== type) return false;
    const needle = query.trim().toLowerCase();
    return !needle || [t.customer_email, t.description ?? "", t.transaction_type, t.order_id ?? "", t.stripe_session_id ?? ""].some((value) => value.toLowerCase().includes(needle));
  }), [transactions, type, query]);

  return (
    <AdminArea active="transactions" title="Transactions" description="Read-only ledger of recorded wallet credits, debits and Stripe-related activity. Figures reflect your database, not a Stripe payout reconciliation.">
      <Panel>
        <div className="mb-5 flex flex-wrap items-center justify-between gap-4">
          <div><h2 className="text-lg font-bold">Transaction history</h2><p className="mt-1 text-xs text-slate-400">Most recent 500 entries; values in GBP</p></div>
          <button onClick={() => void reload()} disabled={loading} className="rounded-xl bg-sky-400 px-4 py-2 text-sm font-bold text-slate-950 disabled:opacity-50">Refresh</button>
        </div>
        <div className="mb-5 flex flex-col gap-3 sm:flex-row">
          <input value={query} onChange={(e) => setQuery(e.target.value)} aria-label="Search transactions" placeholder="Search customer, order or reference" className="min-w-0 flex-1 rounded-xl border border-white/10 bg-[#090d14] px-4 py-3 text-sm focus:border-sky-400 focus:outline-none" />
          <select value={type} onChange={(e) => setType(e.target.value)} aria-label="Transaction type" className="rounded-xl border border-white/10 bg-[#090d14] px-4 py-3 text-sm"><option value="all">All transaction types</option>{types.map((item) => <option value={item} key={item}>{item.replaceAll("_", " ")}</option>)}</select>
        </div>
        {error && <Feedback message={error} error />}
        {loading ? <p role="status" className="py-10 text-center text-slate-400">Loading transactions…</p> : (
          <>
            <p className="mb-3 text-xs text-slate-400">Showing {filtered.length} of {transactions.length} transactions</p>
            <div className="overflow-x-auto"><table className="w-full min-w-[950px] text-left text-sm">
              <thead className="border-b border-white/10 text-xs uppercase tracking-wider text-slate-500"><tr><th className="py-3 pr-4">When</th><th className="py-3 pr-4">Customer</th><th className="py-3 pr-4">Type</th><th className="py-3 pr-4">Description</th><th className="py-3 pr-4">Reference</th><th className="py-3 text-right">Amount</th></tr></thead>
              <tbody className="divide-y divide-white/[0.06]">{filtered.map((item) => <tr key={item.id} className="align-top text-slate-300">
                <td className="py-4 pr-4 whitespace-nowrap">{dateTime(item.created_at)}</td><td className="py-4 pr-4 break-all">{item.customer_email}</td><td className="py-4 pr-4">{item.transaction_type.replaceAll("_", " ")}</td><td className="py-4 pr-4">{item.description || "—"}</td>
                <td className="py-4 pr-4 text-xs"><span className="block max-w-[240px] break-all">{item.order_id ? `Order: ${item.order_id}` : "—"}</span>{item.stripe_session_id && <span className="mt-1 block max-w-[240px] break-all text-slate-500">Stripe: {item.stripe_session_id}</span>}</td>
                <td className={`py-4 text-right font-bold tabular-nums ${item.amount_pence >= 0 ? "text-emerald-300" : "text-rose-300"}`}>{item.amount_pence > 0 ? "+" : ""}{money(item.amount_pence)}</td>
              </tr>)}</tbody></table>{filtered.length === 0 && <p className="py-10 text-center text-sm text-slate-400">No matching transactions.</p>}</div>
          </>
        )}
      </Panel>
    </AdminArea>
  );
}

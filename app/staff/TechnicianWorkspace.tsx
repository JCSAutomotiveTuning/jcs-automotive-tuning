"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";

type FileInfo = { id: string; original_filename: string; kind: string; scan_status: string; size_bytes: number };
type Job = {
  id: string; service_name: string; vehicle_make: string; vehicle_model: string;
  engine_code: string | null; software_id: string | null; status: string;
  payment_confirmed: boolean; customer_notes: string | null; created_at: string; files: FileInfo[];
};
const statusNames: Record<string, string> = { awaiting_review: "Awaiting review", awaiting_payment: "Awaiting payment", paid: "Paid", in_progress: "In progress", needs_customer_info: "Needs customer info", qa_review: "QA review", completed: "Completed" };
const statuses = [{ value: "in_progress", label: "Start / resume tuning" }, { value: "needs_customer_info", label: "Request customer information" }, { value: "qa_review", label: "Send to QA review" }];

export default function TechnicianWorkspace() {
  const [orders, setOrders] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [search, setSearch] = useState("");
  const [draftStatuses, setDraftStatuses] = useState<Record<string, string>>({});

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/staff/orders", { cache: "no-store" });
      const json = await response.json();
      if (!response.ok) throw new Error(json.error ?? "Unable to load assigned jobs.");
      setOrders(json.orders as Job[]);
      setError("");
    } catch (err) { setError(err instanceof Error ? err.message : "Unable to load jobs."); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => {
    let active = true;
    void fetch("/api/staff/orders", { cache: "no-store" }).then(async (response) => {
      const body = await response.json();
      if (!response.ok) throw new Error(body.error ?? "Unable to load assigned jobs.");
      if (active) setOrders(body.orders as Job[]);
    }).catch((err: unknown) => { if (active) setError(err instanceof Error ? err.message : "Unable to load jobs."); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  async function update(order: Job) {
    setBusy(order.id); setSuccess(""); setError("");
    try {
      const response = await fetch("/api/staff/orders", { method: "PATCH", credentials: "same-origin", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ orderId: order.id, status: draftStatuses[order.id] ?? "" }) });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error ?? "Unable to update job.");
      setSuccess("Job status updated.");
      await reload();
    } catch (err) { setError(err instanceof Error ? err.message : "Unable to save job."); }
    finally { setBusy(""); }
  }
  const visible = useMemo(() => orders.filter((order) => `${order.vehicle_make} ${order.vehicle_model} ${order.service_name} ${order.engine_code ?? ""}`.toLowerCase().includes(search.trim().toLowerCase())), [orders, search]);
  const active = orders.filter((o) => !["completed", "cancelled", "failed"].includes(o.status)).length;

  return <main className="min-h-screen bg-[#090d14] px-4 py-8 text-slate-100 sm:px-8 lg:px-12">
    <div className="mx-auto max-w-6xl">
      <header className="mb-8 flex flex-wrap items-center justify-between gap-4">
        <div><p className="text-xs font-bold uppercase tracking-[0.2em] text-sky-400">JCS Automotive Tuning / Technician</p><h1 className="mt-3 text-3xl font-black sm:text-4xl">My tuning jobs</h1><p className="mt-2 text-sm text-slate-400">Your assigned ECU and TCU calibration work queue.</p></div>
        <form action="/auth/signout" method="post"><button className="rounded-xl border border-white/10 px-4 py-2.5 text-sm hover:bg-white/10" type="submit">Sign out</button></form>
      </header>
      <div className="mb-6 grid gap-3 sm:grid-cols-3">
        <div className="rounded-2xl border border-white/10 bg-[#101620] p-5"><p className="text-sm text-slate-400">Assigned jobs</p><p className="mt-2 text-3xl font-black">{orders.length}</p></div>
        <div className="rounded-2xl border border-white/10 bg-[#101620] p-5"><p className="text-sm text-slate-400">Open jobs</p><p className="mt-2 text-3xl font-black text-sky-300">{active}</p></div>
        <div className="rounded-2xl border border-white/10 bg-[#101620] p-5"><p className="text-sm text-slate-400">Awaiting QA</p><p className="mt-2 text-3xl font-black text-amber-300">{orders.filter((o) => o.status === "qa_review").length}</p></div>
      </div>
      <div className="mb-6 rounded-xl border border-amber-400/20 bg-amber-400/[0.06] p-4 text-xs leading-6 text-amber-100">File names and scan states are view-only in this release. Direct downloads and modified-file uploads are disabled until your actual Supabase Storage bucket and malware-scanning workflow are verified. Only admins can approve completion and billing.</div>
      <div className="mb-6 flex flex-wrap gap-3"><input className="min-w-0 flex-1 rounded-xl border border-white/10 bg-[#101620] px-4 py-3 text-sm outline-none focus:border-sky-400" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Find a vehicle, engine or job" aria-label="Search assigned jobs"/><button type="button" disabled={loading || !!busy} onClick={() => void reload()} className="rounded-xl bg-sky-400 px-5 py-3 text-sm font-bold text-slate-950 disabled:opacity-50">Refresh</button></div>
      {error && <p role="alert" className="mb-4 rounded-xl border border-red-400/20 bg-red-400/10 p-4 text-sm text-red-200">{error}</p>}
      {success && <p role="status" className="mb-4 rounded-xl border border-sky-400/20 bg-sky-400/10 p-4 text-sm text-sky-200">{success}</p>}
      {loading && <p className="py-8 text-slate-400">Loading assigned jobs…</p>}
      {!loading && visible.length === 0 && <div className="rounded-2xl border border-white/10 bg-[#101620] p-10 text-center text-slate-400">No assigned jobs found. Ask an administrator to assign a tuning order to your account.</div>}
      <div className="grid gap-4 md:grid-cols-2">{!loading && visible.map((order) => <section key={order.id} className="rounded-2xl border border-white/10 bg-[#101620] p-5 sm:p-6">
        <div className="mb-4 flex flex-wrap items-start justify-between gap-3"><div><p className="text-xl font-bold">{order.vehicle_make} {order.vehicle_model}</p><p className="mt-2 text-sm text-slate-400">{order.service_name}</p></div><span className="rounded-full border border-sky-400/20 bg-sky-400/10 px-3 py-1 text-xs text-sky-200">{statusNames[order.status] ?? order.status.replaceAll("_", " ")}</span></div>
        <p className="mb-4 break-all font-mono text-[11px] text-slate-500">{order.id}</p>
        <dl className="mb-4 grid grid-cols-2 gap-3 text-sm"><div><dt className="text-xs text-slate-500">Engine</dt><dd>{order.engine_code ?? "—"}</dd></div><div><dt className="text-xs text-slate-500">Software ID</dt><dd>{order.software_id ?? "—"}</dd></div><div><dt className="text-xs text-slate-500">Payment verified</dt><dd className={order.payment_confirmed ? "text-emerald-300" : "text-amber-300"}>{order.payment_confirmed ? "Yes" : "No"}</dd></div><div><dt className="text-xs text-slate-500">Files</dt><dd>{order.files.length}</dd></div></dl>
        {order.customer_notes && <div className="mb-4 rounded-xl border border-white/10 bg-black/20 p-3 text-sm"><p className="mb-1 text-xs font-semibold text-slate-500">Customer instructions</p><p className="whitespace-pre-wrap break-words">{order.customer_notes}</p></div>}
        {order.files.length > 0 && <div className="mb-5 space-y-2"><h2 className="text-xs font-bold uppercase tracking-wider text-slate-500">File register</h2>{order.files.map((file) => <div key={file.id} className="flex items-start justify-between gap-2 rounded-lg border border-white/10 bg-white/[0.02] p-3 text-xs"><span className="break-all text-slate-200">{file.original_filename}</span><span className="shrink-0 text-slate-500">{file.kind} · {file.scan_status}</span></div>)}</div>}
        {!(["completed", "cancelled", "failed"].includes(order.status)) && <div className="flex flex-wrap gap-2 border-t border-white/10 pt-4"><select className="min-w-0 flex-1 rounded-xl border border-white/10 bg-[#090d14] px-3 py-2.5 text-sm" aria-label={`Change job status for ${order.vehicle_make} ${order.vehicle_model}`} value={draftStatuses[order.id] ?? ""} onChange={(e) => setDraftStatuses((prev) => ({...prev, [order.id]: e.target.value }))}><option value="">Choose status</option>{statuses.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}</select><button type="button" disabled={!draftStatuses[order.id] || !!busy} onClick={() => void update(order)} className="rounded-xl bg-sky-400 px-4 py-2.5 text-sm font-bold text-slate-950 disabled:opacity-50">Save</button></div>}
      </section>)}</div>
      <footer className="mt-8 text-center text-xs text-slate-500">JCS Automotive Tuning · Technician workspace · <Link href="/" className="text-sky-300">Home</Link></footer>
    </div>
  </main>;
}

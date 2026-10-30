"use client";

import { useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import { AdminArea, Feedback, dateTime, money } from "../_components/AdminArea";

type Order = {
  id: string;
  user_id: string;
  service_code?: string | null;
  service_name: string;
  amount_pence: number;
  deposit_pence?: number;
  currency: string;
  status: string;
  payment_status: string;
  checkout_session_id?: string | null;
  vehicle_make: string;
  vehicle_model: string;
  engine_code: string | null;
  software_id: string | null;
  customer_notes: string | null;
  admin_notes: string | null;
  created_at: string;
  updated_at?: string | null;
  customer_email: string;
  order_files?: { id: string; kind: string; scan_status: string; delivery_status: string | null }[];
};

type UpdateResponse = {
  order: Partial<Order> & { id: string };
};

type Filter = "all" | "active" | "awaiting_review" | "awaiting_payment" | "paid" | "in_progress" | "needs_customer_info" | "qa_review" | "completed" | "cancelled" | "failed";

const statusOptions = [
  { value: "awaiting_review", label: "Awaiting review" },
  { value: "awaiting_payment", label: "Awaiting payment" },
  { value: "in_progress", label: "In progress" },
  { value: "needs_customer_info", label: "Needs customer info" },
  { value: "qa_review", label: "QA review" },
  { value: "completed", label: "Completed" },
  { value: "cancelled", label: "Cancelled" },
  { value: "failed", label: "Failed" },
];

const closed = new Set(["completed", "cancelled", "failed"]);
const quoteServices = new Set(["custom_ecu", "custom_tcu", "ecu_tcu_package", "addons_only"]);
const requiresPayment = new Set(["in_progress", "qa_review", "completed"]);

function label(value: string): string {
  return value.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function tone(status: string): string {
  if (status === "completed" || status === "paid") return "border-emerald-400/20 bg-emerald-400/10 text-emerald-300";
  if (status === "failed" || status === "cancelled") return "border-rose-400/20 bg-rose-400/10 text-rose-300";
  if (status === "awaiting_payment" || status === "awaiting_review" || status === "unpaid") return "border-amber-400/20 bg-amber-400/10 text-amber-300";
  if (status === "needs_customer_info") return "border-purple-400/20 bg-purple-400/10 text-purple-300";
  return "border-sky-400/20 bg-sky-400/10 text-sky-300";
}

function StatusPill({ value, dot = true }: { value: string; dot?: boolean }) {
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-bold tracking-wide ${tone(value)}`}>
      {dot && <span className="h-1.5 w-1.5 rounded-full bg-current" />}
      {label(value)}
    </span>
  );
}

function Field({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="mb-1.5 text-[10px] font-bold uppercase tracking-[0.15em] text-slate-500">{title}</dt>
      <dd className="break-words text-sm font-medium text-slate-200">{children || "—"}</dd>
    </div>
  );
}

const inputStyle = "w-full rounded-xl border border-white/10 bg-[#090d14] px-3.5 py-3 text-sm text-white outline-none transition placeholder:text-slate-600 focus:border-sky-400/60 focus:ring-2 focus:ring-sky-400/10 disabled:cursor-not-allowed disabled:opacity-50";
const secondaryButton = "inline-flex items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/[0.03] px-4 py-2.5 text-xs font-bold text-slate-200 transition hover:border-sky-400/25 hover:bg-white/[0.07] disabled:cursor-not-allowed disabled:opacity-50";
const primaryButton = "inline-flex items-center justify-center gap-2 rounded-xl bg-sky-400 px-4 py-2.5 text-xs font-extrabold text-slate-950 transition hover:bg-sky-300 disabled:cursor-not-allowed disabled:opacity-50";

export default function OrdersManager({ initialOrders }: { initialOrders: Order[] }) {
  const [orders, setOrders] = useState<Order[]>(initialOrders);
  const [selectedId, setSelectedId] = useState<string | null>(initialOrders[0]?.id ?? null);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [paymentFilter, setPaymentFilter] = useState("all");
  const [sort, setSort] = useState("newest");
  const [draftStatus, setDraftStatus] = useState(initialOrders[0]?.status ?? "awaiting_review");
  const [draftNotes, setDraftNotes] = useState(initialOrders[0]?.admin_notes ?? "");
  const [quotePounds, setQuotePounds] = useState(initialOrders[0]?.amount_pence ? (initialOrders[0].amount_pence / 100).toFixed(2) : "");
  const [busy, setBusy] = useState<"save" | "quote" | "payment" | null>(null);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  const [refunding, setRefunding] = useState(false);
  const [releasingDeposit, setReleasingDeposit] = useState(false);
  const [refundHistory, setRefundHistory] = useState<{ refunds: { id: string; amountPence: number; status: string; created: number }[]; refundablePence: number; verifiedPayment: boolean } | null>(null);
  const [refundHistoryError, setRefundHistoryError] = useState("");
  const [finishedFile, setFinishedFile] = useState<File | null>(null);
  const [uploadingFinished, setUploadingFinished] = useState(false);
  const [uploadMessage, setUploadMessage] = useState("");

  const selected = orders.find((order) => order.id === selectedId) ?? null;
  const finishedOutputs = selected?.order_files?.filter(file => file.kind === "completed_output") ?? [];
  const clearedOutputs = finishedOutputs.filter(file => file.scan_status === "clean");
  const approvedOutputs = clearedOutputs.filter(file => file.delivery_status === "approved");
  const stats = useMemo(() => ({
    total: orders.length,
    active: orders.filter((order) => !closed.has(order.status)).length,
    review: orders.filter((order) => order.status === "awaiting_review").length,
    payment: orders.filter((order) => order.status === "awaiting_payment").length,
    completed: orders.filter((order) => order.status === "completed").length,
  }), [orders]);

  const filtered = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return orders.filter((order) => {
      const matchesSearch = !needle || [order.id, order.customer_email, order.service_name, order.service_code, order.vehicle_make, order.vehicle_model, order.engine_code, order.software_id]
        .some((part) => String(part ?? "").toLowerCase().includes(needle));
      const matchesStatus = filter === "all" || (filter === "active" ? !closed.has(order.status) : order.status === filter);
      return matchesSearch && matchesStatus && (paymentFilter === "all" || order.payment_status === paymentFilter);
    }).sort((a, b) => {
      if (sort === "highest") return b.amount_pence - a.amount_pence;
      if (sort === "oldest") return Date.parse(a.created_at) - Date.parse(b.created_at);
      return Date.parse(b.created_at) - Date.parse(a.created_at);
    });
  }, [orders, search, filter, paymentFilter, sort]);

  function exportFilteredOrders() {
    // Export the rows already visible to this authenticated administrator only.
    const safe=(value:unknown)=>{
      let s=String(value??"").replace(/[\r\n]+/g," ");
      if(/^[=+@\-\t]/.test(s))s="'"+s; // Avoid spreadsheet formula execution.
      return '"'+s.replace(/"/g,'""')+'"';
    };
    const fields=["Order ID","Created","Customer","Service","Vehicle","Engine","ECU software","Status","Payment","Price GBP"];
    const rows=filtered.map(o=>[o.id,o.created_at,o.customer_email,o.service_name,`${o.vehicle_make} ${o.vehicle_model}`,o.engine_code,o.software_id,o.status,o.payment_status,(o.amount_pence/100).toFixed(2)]);
    const csv=[fields,...rows].map(row=>row.map(safe).join(",")).join("\\r\\n");
    const url=URL.createObjectURL(new Blob([csv],{type:"text/csv;charset=utf-8"}));
    const link=document.createElement("a");link.href=url;link.download="jcs-orders-filtered.csv";link.click();URL.revokeObjectURL(url);
  }

  function choose(order: Order) {
    setSelectedId(order.id);
    setFinishedFile(null);
    setUploadMessage("");
    setRefundHistory(null);
    setRefundHistoryError("");
    setDraftStatus(order.status);
    setDraftNotes(order.admin_notes ?? "");
    setQuotePounds(order.amount_pence > 0 ? (order.amount_pence / 100).toFixed(2) : "");
    setError("");
    setSuccess("");
  }

  async function patch(payload: Record<string, unknown>, kind: "save" | "quote" | "payment") {
    if (!selected || busy) return;
    const currentId = selected.id;
    setBusy(kind);
    setError("");
    setSuccess("");
    try {
      const response = await fetch("/api/admin/orders", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ orderId: currentId, ...payload }),
      });
      const body: unknown = await response.json().catch(() => null);
      if (!response.ok) {
        const message = body && typeof body === "object" && "error" in body && typeof body.error === "string"
          ? body.error : `Unable to update order (HTTP ${response.status}).`;
        throw new Error(message);
      }
      if (!body || typeof body !== "object" || !("order" in body) || !body.order || typeof body.order !== "object") {
        throw new Error("The server did not return an updated order.");
      }
      const updated = (body as UpdateResponse).order;
      setOrders((previous) => previous.map((order) => order.id === currentId ? { ...order, ...updated } : order));
      if (updated.status) setDraftStatus(updated.status);
      if (updated.admin_notes !== undefined) setDraftNotes(updated.admin_notes ?? "");
      if (updated.amount_pence !== undefined) setQuotePounds((updated.amount_pence / 100).toFixed(2));
      setSuccess(kind === "quote" ? "Customer quote saved." : kind === "payment" ? "Order moved to awaiting payment." : "Order changes saved.");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to save the order.");
    } finally {
      setBusy(null);
    }
  }

  async function loadRefundHistory(orderId: string) {
    setRefundHistory(null);
    setRefundHistoryError("");
    try {
      const response = await fetch(`/api/admin/orders/refund-history?orderId=${encodeURIComponent(orderId)}`, { credentials: "same-origin", cache: "no-store" });
      const data = await response.json().catch(() => null);
      if (!response.ok || !data || !Array.isArray(data.refunds)) {
        throw new Error(data?.error ?? "Unable to load refund history.");
      }
      setRefundHistory(data);
    } catch (error) {
      setRefundHistoryError(error instanceof Error ? error.message : "Unable to load refund history.");
    }
  }

  async function refundSelected() {
    if (!selected || refunding || busy || selected.payment_status !== "paid" || !selected.checkout_session_id) return;
    const orderId = selected.id;
    if (!window.confirm(`Refund the full ${money(selected.amount_pence)} to the original payment method for order ${orderId.slice(0, 8)}? This cannot be undone.`)) return;
    setRefunding(true);
    setError("");
    setSuccess("");
    try {
      const response = await fetch("/api/admin/orders/refund", {
        method: "POST", headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ orderId, confirmation: "REFUND" }),
      });
      const result = await response.json().catch(() => null);
      if (!response.ok || !result?.ok) {
        throw new Error(result?.error ?? "Refund was not confirmed. Check Stripe before retrying.");
      }
      setOrders((previous) => previous.map((order) => order.id === orderId
        ? { ...order, payment_status: "refunded" } : order));
      setSuccess(`Full refund submitted successfully. Stripe reference: ${result.refundId}`);
      void loadRefundHistory(orderId);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Refund failed.");
    } finally {
      setRefunding(false);
    }
  }

  async function releaseDeposit() {
    if (!selected || releasingDeposit || !["cancelled","failed"].includes(selected.status) ||
      selected.payment_status !== "unpaid" || selected.deposit_pence !== 2000) return;
    const id = selected.id;
    if (!window.confirm("Return £20 to this customer's verified deposit wallet for this cancelled job?")) return;
    setReleasingDeposit(true); setError("");setSuccess("");
    try {
      const res = await fetch("/api/admin/orders/deposit-release",{
        method:"POST",headers:{"Content-Type":"application/json"},credentials:"same-origin",
        body:JSON.stringify({orderId:id,confirmation:"RELEASE_DEPOSIT"})
      });
      const data=await res.json();
      if(!res.ok || !data.ok) throw new Error(data.error || "Could not release deposit");
      setSuccess("£20 deposit returned to customer wallet. Repeated requests will not issue another credit.");
    } catch(e) {setError(e instanceof Error?e.message:"Could not release deposit");}
    finally {setReleasingDeposit(false);}
  }

  async function uploadCompletedFile() {
    if (!selected || !finishedFile || uploadingFinished) return;

    const orderId = selected.id;

    setUploadingFinished(true);
    setUploadMessage("");
    setError("");
    setSuccess("");

    try {
      const form = new FormData();
      form.append("orderId", orderId);
      form.append("file", finishedFile);

      const response = await fetch("/api/admin/completed-files", {
        method: "POST",
        credentials: "same-origin",
        body: form,
      });

      const result = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(
          result?.error ?? `Upload failed (HTTP ${response.status}).`
        );
      }

      setFinishedFile(null);
      setUploadMessage(
        "Finished file uploaded successfully. Status: pending review."
      );
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Could not upload the finished file."
      );
    } finally {
      setUploadingFinished(false);
    }
  }
  const allowQuote = selected !== null && (quoteServices.has(selected.service_code ?? "") || selected.amount_pence === 0)
    && selected.status === "awaiting_review" && selected.payment_status === "unpaid";
  const allowRequestPayment = selected !== null && selected.status === "awaiting_review"
    && selected.payment_status === "unpaid" && selected.amount_pence > 0;
  const parsedQuote = /^\d+(\.\d{1,2})?$/.test(quotePounds.trim())
    ? Math.round(Number(quotePounds.trim()) * 100) : NaN;
  const validQuote = Number.isSafeInteger(parsedQuote) && parsedQuote >= 1 && parsedQuote <= 100000000;
  const saveDisabled = !selected || busy !== null || (draftStatus === selected.status && draftNotes === (selected.admin_notes ?? ""));

  return (
    <AdminArea active="orders" title="Order management" description="Your tuning workshop queue. Review jobs, manage custom quotes and keep customers' ECU and TCU orders progressing.">
      <div className="mb-4 flex justify-end"><button type="button" onClick={exportFilteredOrders} className={secondaryButton} disabled={filtered.length===0}>Export filtered orders (CSV)</button></div>
      <section className="relative mb-6 overflow-hidden rounded-3xl border border-sky-400/15 bg-gradient-to-br from-[#172439] via-[#111c2b] to-[#0e1520] px-5 py-6 sm:px-7 sm:py-8">
        <div aria-hidden="true" className="pointer-events-none absolute -right-14 -top-24 h-64 w-64 rounded-full bg-sky-400/10 blur-3xl" />
        <div className="relative flex flex-wrap items-center justify-between gap-5">
          <div>
            <p className="mb-2 text-[10px] font-black uppercase tracking-[0.23em] text-sky-400">Workshop operations</p>
            <h2 className="text-2xl font-black tracking-tight text-white sm:text-3xl">Tuning job control centre<span className="text-sky-400">.</span></h2>
            <p className="mt-2 max-w-xl text-sm leading-6 text-slate-400">Manage customer requests from review and quotation through payment, calibration and delivery.</p>
          </div>
          <button type="button" onClick={() => window.location.reload()} className={secondaryButton}>↻ <span>Reload orders</span></button>
        </div>
      </section>

      <div className="mb-7 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        {[
          { name: "All orders", value: stats.total, key: "all" as Filter, color: "text-white", line: "border-t-sky-400" },
          { name: "Open jobs", value: stats.active, key: "active" as Filter, color: "text-sky-300", line: "border-t-sky-400" },
          { name: "Awaiting review", value: stats.review, key: "awaiting_review" as Filter, color: "text-amber-300", line: "border-t-amber-400" },
          { name: "Awaiting payment", value: stats.payment, key: "awaiting_payment" as Filter, color: "text-amber-300", line: "border-t-amber-400" },
          { name: "Completed", value: stats.completed, key: "completed" as Filter, color: "text-emerald-300", line: "border-t-emerald-400" },
        ].map((stat) => (
          <button key={stat.name} type="button" onClick={() => setFilter(stat.key)} aria-pressed={filter === stat.key}
            className={`group rounded-2xl border border-white/[0.08] border-t-2 ${stat.line} bg-[#111722] p-4 text-left transition hover:-translate-y-0.5 hover:border-sky-400/30 ${filter === stat.key ? "ring-1 ring-sky-400/35" : ""}`}>
            <p className="text-xs font-semibold text-slate-400">{stat.name}</p>
            <p className={`mt-3 text-3xl font-black tabular-nums ${stat.color}`}>{stat.value}</p>
          </button>
        ))}
      </div>

      <div className="grid gap-6 2xl:grid-cols-[minmax(0,1.2fr)_minmax(400px,0.9fr)]">
        <section className="min-w-0 overflow-hidden rounded-2xl border border-white/10 bg-[#101620]">
          <div className="border-b border-white/[0.07] p-5 sm:p-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-sky-400">Incoming work</p>
                <h2 className="mt-1.5 text-lg font-bold text-white">Order queue</h2>
                <p className="mt-1 text-xs text-slate-500">Showing {filtered.length} of {orders.length} loaded orders</p>
              </div>
              <button type="button" className={secondaryButton} onClick={() => setShowFilters((value) => !value)} aria-expanded={showFilters}>
                ⚑ Filters {showFilters ? "−" : "+"}
              </button>
            </div>
            <div className="relative mt-5">
              <span aria-hidden="true" className="pointer-events-none absolute left-4 top-3 text-slate-500">⌕</span>
              <input aria-label="Search orders" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search customer, vehicle, service, order ID..." className={`${inputStyle} pl-10`} />
            </div>
            {showFilters && (
              <div className="mt-3 grid gap-3 sm:grid-cols-3">
                <div><label htmlFor="jcs-order-status-filter" className="mb-1 block text-xs text-slate-500">Order status</label>
                  <select id="jcs-order-status-filter" className={inputStyle} value={filter} onChange={(event) => setFilter(event.target.value as Filter)}>
                    <option value="all">All statuses</option><option value="active">Open jobs</option>
                    <option value="awaiting_review">Awaiting review</option><option value="awaiting_payment">Awaiting payment</option>
                    <option value="paid">Paid</option><option value="in_progress">In progress</option><option value="needs_customer_info">Needs customer info</option><option value="qa_review">QA review</option><option value="completed">Completed</option><option value="cancelled">Cancelled</option><option value="failed">Failed</option>
                  </select>
                </div>
                <div><label htmlFor="jcs-payment-filter" className="mb-1 block text-xs text-slate-500">Payment</label>
                  <select id="jcs-payment-filter" className={inputStyle} value={paymentFilter} onChange={(event) => setPaymentFilter(event.target.value)}>
                    <option value="all">All payments</option><option value="paid">Paid</option><option value="unpaid">Unpaid</option>
                  </select>
                </div>
                <div><label htmlFor="jcs-order-sort" className="mb-1 block text-xs text-slate-500">Sort by</label>
                  <select id="jcs-order-sort" className={inputStyle} value={sort} onChange={(event) => setSort(event.target.value)}>
                    <option value="newest">Newest first</option><option value="oldest">Oldest first</option><option value="highest">Highest value</option>
                  </select>
                </div>
              </div>
            )}
          </div>

          <div className="max-h-[900px] space-y-2 overflow-y-auto p-3 sm:p-4">
            {filtered.length === 0 ? (
              <div className="px-5 py-16 text-center"><div className="mb-3 text-4xl text-slate-600">▤</div><h3 className="text-base font-bold text-slate-200">No matching orders</h3><p className="mt-2 text-sm text-slate-500">Try a different search or clear the filters.</p>
                <button type="button" className={`${secondaryButton} mt-5`} onClick={() => { setSearch(""); setFilter("all"); setPaymentFilter("all"); }}>Clear filters</button>
              </div>
            ) : filtered.map((order) => (
              <button type="button" key={order.id} onClick={() => choose(order)} aria-pressed={selectedId === order.id}
                className={`group w-full rounded-xl border p-4 text-left transition sm:p-5 ${selectedId === order.id ? "border-sky-400/35 bg-sky-400/[0.075] shadow-[inset_3px_0_0_#38bdf8]" : "border-white/[0.06] bg-white/[0.02] hover:border-white/[0.15] hover:bg-white/[0.045]"}`}>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <span className="min-w-0"><span className="block text-sm font-extrabold text-white sm:text-base">{order.vehicle_make} {order.vehicle_model}</span>
                    <span className="mt-1.5 block text-xs text-slate-400">{order.service_name}</span></span>
                  <span className="text-right"><span className="block text-base font-black tabular-nums text-white">{money(order.amount_pence)}</span>
                    <span className="mt-1 block text-[11px] text-slate-500">{new Date(order.created_at).toLocaleDateString("en-GB")}</span></span>
                </div>
                <div className="mt-3 flex flex-wrap items-center gap-2"><StatusPill value={order.status} /><StatusPill value={order.payment_status} dot={false} /></div>
                <div className="mt-4 flex items-center justify-between gap-2 border-t border-white/[0.07] pt-3">
                  <span className="min-w-0 truncate text-xs text-slate-400">{order.customer_email || "Unknown customer"}</span>
                  <span className="shrink-0 text-xs font-bold text-sky-300">View job →</span>
                </div>
              </button>
            ))}
          </div>
        </section>

        <section className="min-w-0 self-start overflow-hidden rounded-2xl border border-white/10 bg-[#101620] 2xl:sticky 2xl:top-5">
          {!selected ? (
            <div className="px-6 py-20 text-center"><p className="text-4xl text-slate-600">▤</p><p className="mt-3 text-sm font-bold text-white">Select an order</p><p className="mt-2 text-xs text-slate-400">Choose a tuning job to review the details and manage progress.</p></div>
          ) : (
            <>
              <div className="relative overflow-hidden border-b border-white/[0.07] bg-gradient-to-br from-[#18263a] to-[#101620] p-5 sm:p-6">
                <div className="pointer-events-none absolute -right-10 -top-10 h-32 w-32 rounded-full bg-sky-400/10 blur-3xl" />
                <p className="relative text-[10px] font-bold uppercase tracking-[0.2em] text-sky-400">Selected tuning job</p>
                <h2 className="relative mt-2 break-words text-xl font-black text-white">{selected.vehicle_make} {selected.vehicle_model}</h2>
                <p className="relative mt-1 text-sm text-slate-400">{selected.service_name}</p>
                <div className="relative mt-4 flex flex-wrap gap-2"><StatusPill value={selected.status} /><StatusPill value={selected.payment_status} /></div>
              </div>

              <div className="space-y-6 p-5 sm:p-6">
                <div className="grid grid-cols-2 gap-x-4 gap-y-5">
                  <Field title="Customer">{selected.customer_email}</Field>
                  <Field title="Order value">{money(selected.amount_pence)}</Field>
                  <Field title="Engine code">{selected.engine_code || "—"}</Field>
                  <Field title="Software ID">{selected.software_id || "—"}</Field>
                  <Field title="Created">{dateTime(selected.created_at)}</Field>
                  <Field title="Order reference">
                    <div className="flex items-center gap-1"><span className="truncate font-mono text-xs" title={selected.id}>{selected.id.slice(0, 8)}…</span>
                      <button type="button" aria-label="Copy order ID" title="Copy full order ID" className="rounded px-2 py-1 text-sky-300 hover:bg-sky-400/10" onClick={() => { void navigator.clipboard.writeText(selected.id).then(() => setSuccess("Order ID copied.")).catch(() => setError("Unable to copy the order ID.")); }}>§</button></div>
                  </Field>
                </div>

                <div className="rounded-xl border border-white/[0.07] bg-[#0b111a] p-4">
                  <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-500">Customer instructions</p>
                  <p className="mt-3 whitespace-pre-wrap break-words text-sm leading-6 text-slate-300">{selected.customer_notes?.trim() || "No additional instructions supplied."}</p>
                </div>

                <div className="border-t border-white/[0.08] pt-5">
                  <div className="mb-4"><h3 className="text-base font-extrabold text-white">Manage order</h3><p className="mt-1 text-xs text-slate-500">Update the workshop stage and your private notes.</p></div>
                  <div className="space-y-4">
                    <div><label htmlFor="jcs-order-stage" className="mb-1.5 block text-xs font-bold text-slate-400">Order stage</label>
                      <select id="jcs-order-stage" value={draftStatus} onChange={(event) => setDraftStatus(event.target.value)} disabled={busy !== null} className={inputStyle}>
                        {draftStatus === "paid" && <option value="paid">Paid (system confirmed)</option>}
                        {statusOptions.map((stage) => <option key={stage.value} value={stage.value}>{stage.label}</option>)}
                      </select>
                      {draftStatus !== selected.status && requiresPayment.has(draftStatus) && selected.payment_status !== "paid" && <p className="mt-2 text-xs text-amber-300">Payment must be confirmed before this stage is allowed.</p>}
                    </div>
                    <div><label htmlFor="jcs-order-notes" className="mb-1.5 block text-xs font-bold text-slate-400">Internal workshop notes</label>
                      <textarea id="jcs-order-notes" value={draftNotes} onChange={(event) => setDraftNotes(event.target.value)} disabled={busy !== null} rows={4} maxLength={3000} placeholder="Calibration requirements, test results, file delivery notes..." className={`${inputStyle} resize-y`} />
                    </div>
                    <button type="button" disabled={saveDisabled} className={`${primaryButton} w-full`} onClick={() => void patch({ action: "update", ...(draftStatus !== selected.status ? { status: draftStatus } : {}), adminNotes: draftNotes }, "save")}>
                      {busy === "save" ? "Saving order…" : "Save order changes →"}
                    </button>
                  </div>
                </div>

                {selected.payment_status === "paid" &&
                  ["in_progress", "qa_review"].includes(selected.status) && (
                  <div className="border-t border-white/[0.08] pt-5">
                    <h3 className="text-base font-bold text-white">
                      Finished tuning file
                    </h3>

                    <p className="mt-2 text-xs leading-5 text-slate-400">
                      Upload the completed ECU or TCU calibration for this
                      customer. The file stays private and pending review.
                    </p>

                    <input
                      key={selected.id}
                      type="file"
                      accept=".bin,.ori,.hex,.frf,.odx,.txt,.csv,.log,.zip"
                      disabled={uploadingFinished}
                      onChange={(event) => {
                        setFinishedFile(event.target.files?.[0] ?? null);
                        setUploadMessage("");
                      }}
                      className={`${inputStyle} mt-4`}
                    />

                    <button
                      type="button"
                      className={`${primaryButton} mt-3 w-full`}
                      disabled={!finishedFile || uploadingFinished || busy !== null}
                      onClick={() => void uploadCompletedFile()}
                    >
                      {uploadingFinished
                        ? "Uploading finished file..."
                        : "Upload finished file"}
                    </button>

                    {uploadMessage && (
                      <p className="mt-3 text-xs text-emerald-300">
                        {uploadMessage}
                      </p>
                    )}
                  </div>
                )}
                {selected && selected.payment_status === "paid" && (
                  <div className="rounded-xl border border-sky-400/20 bg-sky-400/[0.04] p-4">
                    <h3 className="text-sm font-bold text-white">Finished file delivery</h3>
                    <p className="mt-2 text-xs leading-5 text-slate-300">
                      {finishedOutputs.length === 0
                        ? "No finished files uploaded. Upload the completed BIN/ORI file during workshop or QA."
                        : approvedOutputs.length > 0
                          ? `${approvedOutputs.length} finished file(s) approved for delivery.`
                          : clearedOutputs.length > 0
                            ? `${clearedOutputs.length} file(s) passed antivirus. Staff delivery approval is still required.`
                            : `${finishedOutputs.length} finished file(s) awaiting antivirus clearance.`}
                    </p>
                    <p className="mt-2 text-xs text-amber-200">Verify ECU identification, checksum and calibration before releasing any file. Antivirus clearance alone is not tuning QA.</p>
                    <Link href="/admin/files" className={`${secondaryButton} mt-3`}>Review scans and approve delivery</Link>
                  </div>
                )}
                {selected && selected.deposit_pence === 2000 && (
                  <div className="rounded-xl border border-white/10 p-4">
                    <h3 className="text-sm font-bold text-white">£20 wallet deposit</h3>
                    <p className="mt-2 text-xs text-slate-400">Already reserved against this order. The final Stripe checkout excludes this £20.</p>
                    {["cancelled","failed"].includes(selected.status) && selected.payment_status === "unpaid" && (
                      <button type="button" className={`${secondaryButton} mt-3`} disabled={releasingDeposit || busy !== null}
                        onClick={()=>void releaseDeposit()}>{releasingDeposit?"Returning credit...":"Return £20 to wallet"}</button>
                    )}
                  </div>
                )}
                {allowQuote && <div className="border-t border-white/[0.08] pt-5">
                  <h3 className="text-base font-bold text-white">Custom tuning quotation</h3>
                  <p className="mt-1 text-xs leading-5 text-slate-400">Set the agreed price before requesting payment.</p>
                  <div className="mt-3 flex gap-2"><div className="relative min-w-0 flex-1"><span className="absolute left-3 top-3 text-sm font-bold text-slate-400">£</span>
                    <input aria-label="Quoted amount in pounds" inputMode="decimal" className={`${inputStyle} pl-7`} value={quotePounds} onChange={(event) => setQuotePounds(event.target.value)} placeholder="150.00" disabled={busy !== null} /></div>
                    <button type="button" className={secondaryButton} disabled={busy !== null || !validQuote} onClick={() => void patch({ action: "save_quote", quoteAmountPence: parsedQuote }, "quote")}>{busy === "quote" ? "Saving…" : "Save quote"}</button></div>
                </div>}

                {allowRequestPayment && <div className="border-t border-white/[0.08] pt-5">
                  <div className="rounded-xl border border-amber-400/15 bg-amber-400/[0.055] p-4">
                    <h3 className="text-sm font-bold text-white">Ready to request payment?</h3>
                    <p className="mt-1.5 text-xs leading-5 text-slate-400">The customer can pay {money(selected.amount_pence)} after the order is moved to awaiting payment.</p>
                    <button type="button" className={`${primaryButton} mt-4 w-full`} disabled={busy !== null} onClick={() => {
                      if (window.confirm(`Request payment of ${money(selected.amount_pence)} for ${selected.customer_email}?`)) void patch({ action: "request_payment" }, "payment");
                    }}>{busy === "payment" ? "Requesting…" : "Request customer payment →"}</button>
                  </div>
                </div>}

                <div className="border-t border-white/[0.08] pt-5">
                  <h3 className="text-base font-extrabold text-white">Refund payment</h3>
                  <p className="mt-1 text-xs leading-5 text-slate-400">Refund the full order value to the original Stripe payment method. Only verified, paid orders can be refunded. Each refund is recorded against its order.</p>
                  <button type="button" className={`${secondaryButton} mt-3`} onClick={() => void loadRefundHistory(selected.id)} disabled={refunding}>
                    Check Stripe refund history
                  </button>
                  {refundHistoryError && <p className="mt-2 text-xs text-rose-300">{refundHistoryError}</p>}
                  {refundHistory && (
                    <div className="mt-3 space-y-2 text-xs text-slate-300">
                      <p>{refundHistory.verifiedPayment ? `Remaining refundable: ${money(refundHistory.refundablePence)}` : "No verified Stripe order payment linked."}</p>
                      {refundHistory.refunds.map((refund) => (
                        <div key={refund.id} className="rounded-lg border border-white/10 p-2">
                          {money(refund.amountPence)} · {refund.status} · {new Date(refund.created * 1000).toLocaleDateString("en-GB")}
                          <div className="break-all font-mono text-[10px] text-slate-500">{refund.id}</div>
                        </div>
                      ))}
                      {refundHistory.refunds.length === 0 && <p>No Stripe refunds for this order.</p>}
                    </div>
                  )}
                  {selected.payment_status === "refunded" ? (
                    <p className="mt-3 text-sm font-semibold text-emerald-300">This payment has been refunded.</p>
                  ) : selected.payment_status === "paid" && selected.checkout_session_id ? (
                    <button type="button" className="mt-3 w-full rounded-xl border border-rose-400/40 bg-rose-400/10 px-4 py-3 text-sm font-bold text-rose-200 hover:bg-rose-400/20 disabled:opacity-50" disabled={refunding || busy !== null} onClick={() => void refundSelected()}>
                      {refunding ? "Processing refund..." : `Refund ${money(selected.amount_pence)} to customer`}
                    </button>
                  ) : (
                    <p className="mt-3 text-xs text-amber-300">Refund unavailable: no verified paid Stripe checkout is linked to this order.</p>
                  )}
                </div>

                {error && <Feedback message={error} error />}
                {success && <Feedback message={success} />}
                <p className="text-[11px] leading-5 text-slate-600">Payment confirmation is controlled by the Stripe webhook. Changing the order stage does not mark a payment as paid.</p>
              </div>
            </>
          )}
        </section>
      </div>
    </AdminArea>
  );
}

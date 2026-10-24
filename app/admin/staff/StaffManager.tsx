"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { AdminArea, Panel, Feedback, apiJson, dateTime } from "../_components/AdminArea";

type Role = "admin" | "technician" | "customer";
type Profile = { id: string; email: string | null; role: Role; created_at: string };
type Order = { id: string; service_name: string; vehicle_make: string; vehicle_model: string; status: string; payment_status: string; created_at: string };
type Assignment = { order_id: string; technician_id: string; updated_at: string };
type StaffData = { profiles: Profile[]; orders: Order[]; assignments: Assignment[]; currentUserId: string };

const roles: Role[] = ["customer", "technician", "admin"];
const fieldClass = "w-full min-w-0 rounded-xl border border-white/10 bg-[#090d14] px-3 py-2.5 text-sm text-slate-100 outline-none focus:border-sky-400";
const btn = "rounded-xl border border-sky-400/30 bg-sky-400/10 px-4 py-2.5 text-sm font-bold text-sky-200 transition hover:bg-sky-400/20 disabled:opacity-50";

export default function StaffManager() {
  const [data, setData] = useState<StaffData | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [search, setSearch] = useState("");

  const reload = useCallback(async () => {
    setLoading(true);
    try { setData(await apiJson<StaffData>("/api/admin/staff")); setError(""); }
    catch (err) { setError(err instanceof Error ? err.message : "Unable to load team."); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => {
    let active = true;
    void apiJson<StaffData>("/api/admin/staff").then((result) => {
      if (active) setData(result);
    }).catch((err: unknown) => {
      if (active) setError(err instanceof Error ? err.message : "Unable to load team.");
    }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  async function mutate(payload: Record<string, unknown>, key: string) {
    setBusy(key); setError(""); setSuccess("");
    try {
      await apiJson<{ok: boolean}>("/api/admin/staff", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload),
      });
      await reload();
      setSuccess("Changes saved successfully.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to save changes.");
    } finally { setBusy(""); }
  }

  const technicians = useMemo(() => data?.profiles.filter((p) => p.role === "technician") ?? [], [data]);
  const staffCount = data?.profiles.filter((p) => p.role !== "customer").length ?? 0;
  const assignments = useMemo(() => new Map((data?.assignments ?? []).map((a) => [a.order_id, a.technician_id])), [data]);
  const visibleProfiles = useMemo(() => {
    const q = search.toLowerCase().trim();
    return (data?.profiles ?? []).filter((p) => !q || (p.email ?? "").toLowerCase().includes(q) || p.role.includes(q));
  }, [data, search]);
  const assignableOrders = data?.orders.filter((o) => !["completed", "cancelled", "failed"].includes(o.status) || assignments.has(o.id)) ?? [];

  return <AdminArea active="staff" title="Team & assignments" description="Manage trusted staff accounts and assign ECU/TCU jobs. New staff must first register a normal customer account.">
    <div className="mb-6 grid gap-3 sm:grid-cols-3">
      <Panel><p className="text-xs uppercase tracking-wider text-slate-400">Team members</p><p className="mt-2 text-3xl font-black text-white">{staffCount}</p></Panel>
      <Panel><p className="text-xs uppercase tracking-wider text-slate-400">Technicians</p><p className="mt-2 text-3xl font-black text-sky-300">{technicians.length}</p></Panel>
      <Panel><p className="text-xs uppercase tracking-wider text-slate-400">Assigned jobs</p><p className="mt-2 text-3xl font-black text-amber-300">{data?.assignments.length ?? 0}</p></Panel>
    </div>
    <div className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-sky-400/20 bg-sky-400/[0.06] p-4 text-sm text-slate-300">
      <p>To add staff: ask them to <Link href="/register" className="font-bold text-sky-300 underline">register</Link>, find their email below, then change their role. Only promote people you trust.</p>
      <button className={btn} disabled={loading || !!busy} onClick={() => void reload()}>Refresh</button>
    </div>
    {error && <div className="mb-4"><Feedback message={error} error /></div>}
    {success && <div className="mb-4"><Feedback message={success} /></div>}
    {loading && <p role="status" className="py-8 text-sm text-slate-400">Loading team records…</p>}
    {!loading && data && <div className="grid gap-6 xl:grid-cols-[1.05fr_1fr]">
      <Panel>
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <div><h2 className="text-xl font-bold">Portal accounts</h2><p className="mt-1 text-xs text-slate-400">Role changes take effect on the next authenticated request.</p></div>
          <input className={`${fieldClass} sm:max-w-[250px]`} value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search email or role" aria-label="Search accounts" />
        </div>
        <div className="max-h-[660px] space-y-3 overflow-y-auto">
          {visibleProfiles.map((profile) => <div key={profile.id} className="rounded-xl border border-white/10 bg-white/[0.025] p-4">
            <div className="mb-3 flex items-center justify-between gap-2"><div className="min-w-0"><p className="break-all text-sm font-bold text-white">{profile.email ?? profile.id}</p><p className="mt-1 text-xs text-slate-500">Joined {dateTime(profile.created_at)}</p></div><span className="rounded-full border border-sky-400/20 bg-sky-400/10 px-2 py-1 text-[11px] font-semibold text-sky-200">{profile.role}</span></div>
            {profile.id === data.currentUserId ? <p className="text-xs text-slate-400">Your administrator account · role is locked here</p> : <div className="flex items-center gap-2">
              <select aria-label={`Change role for ${profile.email ?? profile.id}`} className={fieldClass} value={profile.role} disabled={!!busy} onChange={(e) => {
                const role = e.target.value as Role;
                const confirmed = role !== "customer" ? window.confirm(`Give ${profile.email ?? profile.id} ${role.toUpperCase()} permissions?`) : window.confirm(`Remove staff permissions from ${profile.email ?? profile.id}?`);
                if (confirmed) void mutate({ action: "set_role", userId: profile.id, role }, `role:${profile.id}`);
              }}>{roles.map((role) => <option key={role} value={role}>{role === "admin" ? "Administrator" : role === "technician" ? "Technician" : "Customer"}</option>)}</select>
            </div>}
          </div>)}
          {!visibleProfiles.length && <p className="py-6 text-sm text-slate-400">No accounts match that search.</p>}
        </div>
      </Panel>
      <Panel>
        <h2 className="text-xl font-bold">Assign tuning jobs</h2>
        <p className="mb-5 mt-2 text-sm text-slate-400">Technicians see only jobs assigned to them. They cannot view your wallet, transactions or staff page.</p>
        <div className="max-h-[740px] space-y-3 overflow-y-auto">
          {assignableOrders.map((order) => <div key={order.id} className="rounded-xl border border-white/10 bg-white/[0.025] p-4">
            <div className="mb-3 flex items-start justify-between gap-2"><div><p className="font-semibold text-white">{order.vehicle_make} {order.vehicle_model}</p><p className="mt-1 text-xs text-slate-400">{order.service_name}</p></div><span className="text-right text-[11px] text-amber-200">{order.status.replaceAll("_", " ")}</span></div>
            <p className="mb-3 break-all font-mono text-[10px] text-slate-500">{order.id}</p>
            <select aria-label={`Assign technician for ${order.vehicle_make} ${order.vehicle_model}`} className={fieldClass} value={assignments.get(order.id) ?? ""} disabled={!!busy} onChange={(e) => void mutate({ action: "assign", orderId: order.id, technicianId: e.target.value || null }, `assign:${order.id}`)}>
              <option value="">Unassigned</option>{technicians.filter((p) => !["completed", "cancelled", "failed"].includes(order.status) || assignments.get(order.id) === p.id).map((p) => <option key={p.id} value={p.id}>{p.email ?? p.id}</option>)}
            </select>
          </div>)}
          {!assignableOrders.length && <p className="py-6 text-sm text-slate-400">No open orders available to assign.</p>}
        </div>
      </Panel>
    </div>}
  </AdminArea>;
}

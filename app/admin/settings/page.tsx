import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { AdminArea, Panel } from "../_components/AdminArea";

export const dynamic = "force-dynamic";

export default async function AdminSettingsPage() {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) redirect("/login");
  const { data: profile, error } = await supabase.from("profiles")
    .select("role,email").eq("id", user.id).maybeSingle();
  if (error || profile?.role !== "admin") redirect("/dashboard");

  return (
    <AdminArea active="settings" title="Settings" description="Administrator account and portal configuration overview.">
      <div className="grid gap-5 lg:grid-cols-2">
        <Panel>
          <h2 className="text-lg font-bold text-white">Administrator account</h2>
          <p className="mt-2 text-sm text-slate-400">Signed in as</p>
          <p className="mt-1 break-all font-semibold text-sky-300">{profile.email || user.email || "Administrator"}</p>
          <p className="mt-4 text-xs text-slate-500">Access level: Administrator</p>
          <Link href="/admin/forgot-password" className="mt-5 inline-block rounded-xl border border-white/15 px-4 py-2 text-sm font-semibold text-white hover:bg-white/10">Password recovery</Link>
        </Panel>
        <Panel>
          <h2 className="text-lg font-bold text-white">Portal configuration</h2>
          <p className="mt-3 text-sm leading-6 text-slate-400">Customer records, orders, tuning files, wallets and transaction history are managed from their dedicated admin sections. Payment credentials and service-role keys are intentionally not displayed here.</p>
          <div className="mt-5 flex flex-wrap gap-3">
            <Link href="/admin/wallet" className="rounded-xl bg-sky-400 px-4 py-2 text-sm font-bold text-slate-950">Manage wallets</Link>
            <Link href="/admin/transactions" className="rounded-xl border border-white/15 px-4 py-2 text-sm font-semibold text-white">View transactions</Link>
          </div>
        </Panel>
      </div>
      <div className="mt-5 grid gap-5 lg:grid-cols-2">
        <Panel>
          <h2 className="text-lg font-bold text-white">Team and permissions</h2>
          <p className="mt-2 text-sm leading-6 text-slate-400">Set registered users as customers, administrators or technicians. Assign tuning jobs to technicians and review staff access.</p>
          <Link href="/admin/staff" className="mt-4 inline-block rounded-xl bg-sky-400 px-4 py-2 text-sm font-bold text-slate-950">Manage staff roles</Link>
        </Panel>
        <Panel>
          <h2 className="text-lg font-bold text-white">Original-file library</h2>
          <p className="mt-2 text-sm leading-6 text-slate-400">Review incoming originals, verify HW/SW identifiers and identify files still in the Undefined queue.</p>
          <Link href="/admin/original-library" className="mt-4 inline-block rounded-xl border border-white/15 px-4 py-2 text-sm font-semibold text-white">Open private library</Link>
        </Panel>
        <Panel>
          <h2 className="text-lg font-bold text-white">Launch and security checks</h2>
          <p className="mt-2 text-sm leading-6 text-slate-400">Review order-payment discrepancies and file scan results. This audit does not change payments or customer files.</p>
          <Link href="/api/admin/launch-audit" className="mt-4 inline-block rounded-xl border border-white/15 px-4 py-2 text-sm font-semibold text-white">View read-only launch audit</Link>
        </Panel>
        <Panel>
          <h2 className="text-lg font-bold text-white">Account recovery</h2>
          <p className="mt-2 text-sm leading-6 text-slate-400">Test the customer-facing password recovery screen and review the sign-in experience. Recovery messages use Supabase Auth, separate from paused order notifications.</p>
          <div className="mt-4 flex flex-wrap gap-3">
            <Link href="/forgot-password" className="inline-block rounded-xl border border-white/15 px-4 py-2 text-sm font-semibold text-white">Customer reset page</Link>
            <Link href="/login" className="inline-block rounded-xl border border-white/15 px-4 py-2 text-sm font-semibold text-white">Sign-in page</Link>
          </div>
        </Panel>
      </div>
      <p className="mt-5 text-xs text-slate-500">Changing Stripe, Supabase or notification configuration requires a separately authenticated, audited settings workflow. No production secrets can be edited from this page.</p>
    </AdminArea>
  );
}

import Image from "next/image";
import { PriceVisibilityToggle, MaskedAmount } from "@/components/PriceVisibility";
import PriceVisibilityStyles from "@/components/PriceVisibilityStyles";

import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import LiveClock from "@/components/LiveClock";

export const dynamic = "force-dynamic";

const money = (pence: number) =>
  new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
  }).format(pence / 100);

const navigation = [
  { label: "Technical Requests", description: "VAG parts and wiring tickets", href: "/admin/technical-requests", icon: "âŒ" },
  {
    label: "Customers",
    description: "Manage customer accounts",
    href: "/admin/customers",
    icon: "â™™",
  },
  {
    label: "Orders",
    description: "Process tuning jobs",
    href: "/admin/orders",
    icon: "â–¤",
  },
  {
    label: "Tuning Files",
    description: "Uploads and completed files",
    href: "/admin/files",
    icon: "â‡§",
  },
  {
    label: "Wallet & Credits",
    description: "Customer balances",
    href: "/admin/wallet",
    icon: "£",
  },
  {
    label: "Transactions",
    description: "Payments and credit history",
    href: "/admin/transactions",
    icon: "â‡„",
  },
  {
    label: "Team & Assignments",
    description: "Staff roles and tuning job assignments",
    href: "/admin/staff",
    icon: "âš’",
  },
  {
    label: "DTC Lookup",
    description: "Bosch/VAG fault-code reference",
    href: "/admin/dtc",
    icon: "DTC",
  },
  {
    label: "Loyalty Points",
    description: "Customer reward balances",
    href: "/admin/loyalty",
    icon: "â˜…",
  },
  {
    label: "Settings",
    description: "Administrator settings",
    href: "/admin/settings",
    icon: "âš™",
  },
];

export default async function AdminDashboard() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();

  if (profileError || profile?.role !== "admin") {
    redirect("/dashboard");
  }

  const admin = createAdminClient();

  const [customers, openOrders, completedOrders, wallets] =
    await Promise.all([
      admin
        .from("profiles")
        .select("id", { count: "exact", head: true })
        .eq("role", "customer"),
      admin
        .from("orders")
        .select("id", { count: "exact", head: true })
        .not("status", "in", '("completed","cancelled","failed")'),
      admin
        .from("orders")
        .select("id", { count: "exact", head: true })
        .eq("status", "completed"),
      admin.from("customer_wallets").select("balance_pence"),
    ]);

  const statsError =
    customers.error ||
    openOrders.error ||
    completedOrders.error ||
    wallets.error;

  if (statsError) {
    throw new Error("Unable to load admin dashboard statistics.");
  }

  const totalCredits = (wallets.data ?? []).reduce(
    (total, wallet) => total + Number(wallet.balance_pence || 0),
    0
  );

  const cards = [
    {
      label: "Total customers",
      value: String(customers.count ?? 0),
      detail: "Registered customer accounts",
      icon: "â™™",
      accent: "border-t-sky-400",
      iconStyle: "bg-sky-400/10 text-sky-300",
    },
    {
      label: "Open orders",
      value: String(openOrders.count ?? 0),
      detail: "Jobs not yet closed",
      icon: "â–¤",
      accent: "border-t-amber-400",
      iconStyle: "bg-amber-400/10 text-amber-300",
    },
    {
      label: "Completed jobs",
      value: String(completedOrders.count ?? 0),
      detail: "Successfully completed",
      icon: "âœ“",
      accent: "border-t-emerald-400",
      iconStyle: "bg-emerald-400/10 text-emerald-300",
    },
    {
      label: "Wallet credits",
      value: money(totalCredits),
      detail: "Combined customer balances",
      icon: "£",
      accent: "border-t-sky-400",
      iconStyle: "bg-sky-400/10 text-sky-300",
    },
  ];

  return (
    <>
    <PriceVisibilityStyles />
    <main className="jcs-admin-dashboard min-h-screen bg-[#090d14] text-slate-100">
<a
  href="/admin/remote-support"
  style={{
    display: "inline-flex",
    alignItems: "center",
    gap: "10px",
    padding: "14px 20px",
    background: "#0ea5e9",
    color: "#ffffff",
    borderRadius: "12px",
    textDecoration: "none",
    fontWeight: 700,
    margin: "12px 0"
  }}
>
  Remote Support
</a>

      <div className="min-h-screen md:flex">

        {/* Sidebar */}
        <aside className="border-b border-white/[0.08] bg-[#0d121b] md:sticky md:top-0 md:flex md:h-screen md:w-[260px] md:shrink-0 md:flex-col md:border-b-0 md:border-r">
          <div className="flex items-center gap-3 border-b border-white/[0.08] px-5 py-5 md:px-6 md:py-7">
            <Link href="/" aria-label="JCS Automotive Tuning homepage">
  <Image src="/jcs-automotive-logo.webp" alt="JCS Automotive Tuning logo" width={64} height={64} className="h-16 w-16 shrink-0 rounded-xl object-contain" />
</Link>
            <div>
              <p className="text-sm font-extrabold tracking-wide text-white">
                JCS AUTOMOTIVE
              </p>
              <p className="mt-1 text-[10px] font-bold tracking-[0.2em] text-sky-400">
                TUNING PORTAL
              </p>
            </div>
          </div>

          <div className="px-4 py-5 md:px-4 md:py-7">
            <p className="mb-3 px-3 text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500">
              Workshop
            </p>

            <nav className="grid grid-cols-2 gap-2 md:grid-cols-1">
              <Link
                href="/admin"
                aria-current="page"
                className="flex items-center gap-3 rounded-xl border border-sky-400/20 bg-sky-400/10 px-3 py-3 text-sm font-semibold text-sky-300 shadow-sm shadow-sky-950/20 transition hover:bg-sky-400/15"
              >
                <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-sky-400/10 text-lg">
                  â—«
                </span>
                <span>Overview</span>
              </Link>

              {navigation.map((item) => {
                const content = (
                  <>
                    <span
                      className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-lg ${
                        item.href
                          ? "bg-white/[0.04] text-slate-400 group-hover:text-sky-300"
                          : "bg-white/[0.02] text-slate-600"
                      }`}
                    >
                      {item.icon}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate">{item.label}</span>
                      {!item.href && (
                        <span className="mt-0.5 block text-[10px] font-medium text-slate-600">
                          Coming soon
                        </span>
                      )}
                    </span>
                    {item.href && (
                      <span className="text-slate-600 transition group-hover:translate-x-0.5 group-hover:text-sky-300">
                        â†’
                      </span>
                    )}
                  </>
                );

                return item.href ? (
                  <Link
                    key={item.label}
                    href={item.href}
                    title={item.description}
                    className="group flex items-center gap-3 rounded-xl border border-transparent px-3 py-2.5 text-sm text-slate-400 transition hover:border-white/[0.06] hover:bg-white/[0.04] hover:text-white"
                  >
                    {content}
                  </Link>
                ) : (
                  <div
                    key={item.label}
                    title={item.description}
                    aria-disabled="true"
                    className="flex cursor-not-allowed items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-slate-500"
                  >
                    {content}
                  </div>
                );
              })}
            </nav>
          </div>

          <div className="hidden flex-1 md:block" />

          <div className="hidden p-4 md:block">
            <div className="rounded-xl border border-white/[0.07] bg-[#111925] p-4">
              <div className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-emerald-400 shadow-[0_0_10px_rgba(52,211,153,0.45)]" />
                <span className="text-xs font-semibold text-slate-300">
                  Admin session active
                </span>
              </div>
              <p className="mt-2 text-xs leading-5 text-slate-500">
                Manage orders and monitor your tuning business from one place.
              </p>
            </div>
            <p className="px-1 pb-2 pt-4 text-[10px] tracking-wide text-slate-600">
              JCS AUTOMOTIVE TUNING
            </p>
          </div>
        </aside>

        {/* Main dashboard */}
        <section className="min-w-0 flex-1">
          <header className="sticky top-0 z-20 border-b border-white/10 bg-[#090d14]/90 px-5 py-4 backdrop-blur-2xl sm:px-8 lg:px-10">
            <div className="flex items-center justify-between gap-4">
              <div className="flex min-w-0 items-center gap-3">
                <Link href="/" aria-label="JCS Automotive Tuning homepage">
  <Image src="/jcs-automotive-logo.webp" alt="JCS Automotive Tuning logo" width={44} height={44} className="h-11 w-11 rounded-xl object-contain" />
</Link>
                <div className="min-w-0">
                  <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-sky-400">
                    JCS Automotive Tuning
                  </p>
                  <p className="mt-1 truncate text-sm font-semibold text-white">
                    Workshop control centre
                  </p>
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-3"><PriceVisibilityToggle />
                <div className="hidden text-right sm:block">
                  <p className="text-xs font-semibold text-white">Administrator</p>
                  <p className="mt-1 text-[10px] text-slate-500">Admin workspace</p>
                </div>
                <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-sky-400/20 bg-gradient-to-br from-sky-400/20 to-blue-600/10 text-sm font-black text-sky-300">
                  JC
                </div>
              </div>
            </div>
          </header>

          <div className="mx-auto max-w-[1600px] p-5 sm:p-8 lg:p-10">
            {/* Dashboard introduction */}
            <div className="relative mb-8 overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-br from-[#151f2d] via-[#101722] to-[#0c111a] p-6 sm:p-8 lg:p-10">
              <div className="pointer-events-none absolute -right-16 -top-20 h-64 w-64 rounded-full bg-sky-500/10 blur-3xl" />
              <div className="pointer-events-none absolute bottom-0 right-0 h-px w-2/3 bg-gradient-to-l from-sky-400/50 to-transparent" />
              <div className="relative flex flex-col justify-between gap-7 xl:flex-row xl:items-end">
                <div className="max-w-2xl">
                  <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-emerald-400/20 bg-emerald-400/[0.07] px-3 py-1.5">
                    <span className="h-2 w-2 rounded-full bg-emerald-400" />
                    <span className="text-[10px] font-bold uppercase tracking-[0.16em] text-emerald-300">
                      Admin workspace
                    </span>
                  </div>
                  <p className="mb-2 text-xs font-bold uppercase tracking-[0.22em] text-sky-400">
                    Business overview
                  </p>
                  <h1 className="text-4xl font-black tracking-tight text-white sm:text-5xl lg:text-6xl">
                    Dashboard<span className="text-sky-400">.</span>
                  </h1>
                  <p className="mt-4 max-w-xl text-sm leading-7 text-slate-400 sm:text-base">
                    Your workshop at a glance. Monitor customers, keep tuning
                    jobs moving and track customer wallet balances from one place.
                  </p>
                </div>

                <div className="relative flex flex-wrap items-center gap-3">
                  <div className="flex min-h-12 items-center gap-3 rounded-xl border border-white/10 bg-black/20 px-4 py-3">
                    <span className="text-lg text-sky-300">â—·</span>
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                        Local time
                      </p>
                      <div className="mt-1 text-sm font-semibold tabular-nums text-white"><LiveClock /></div>
                    </div>
                  </div>
                  <Link
                    href="/admin/orders"
                    className="inline-flex min-h-12 items-center justify-center gap-3 rounded-xl bg-sky-400 px-5 py-3 text-sm font-extrabold text-slate-950 shadow-lg shadow-sky-950/30 transition hover:-translate-y-0.5 hover:bg-sky-300"
                  >
                    Manage orders <span aria-hidden="true">â†’</span>
                  </Link>
                </div>
              </div>
            </div>

            {/* Live business statistics */}
            <div className="mb-10">
              <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
                <div>
                  <h2 className="text-lg font-bold tracking-tight text-white">
                    Business performance
                  </h2>
                  <p className="mt-1 text-xs text-slate-500">
                    Current totals from your database
                  </p>
                </div>
                <span className="inline-flex items-center gap-2 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                  Live data
                </span>
              </div>

              <div className="grid gap-4 sm:grid-cols-2 2xl:grid-cols-4">
                {cards.map((card, index) => (
                  <article
                    key={card.label}
                    className={`group relative overflow-hidden rounded-2xl border border-white/[0.09] bg-[#111722] p-5 transition duration-200 hover:-translate-y-1 hover:border-sky-400/25 hover:bg-[#151e2b] sm:p-6 ${index === 0 ? "border-l-2 border-l-sky-400" : index === 1 ? "border-l-2 border-l-amber-400" : index === 2 ? "border-l-2 border-l-emerald-400" : "border-l-2 border-l-blue-400"}`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <p className="text-sm font-medium text-slate-400">
                        {card.label}
                      </p>
                      <span
                        className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-lg font-bold ${card.iconStyle}`}
                      >
                        {card.icon}
                      </span>
                    </div>
                    <p className="mt-6 break-words text-3xl font-black tracking-tight text-white sm:text-4xl">
                      {card.label === "Wallet credits" ? <MaskedAmount>{card.value}</MaskedAmount> : card.value}
                    </p>
                    <p className="mt-2 text-xs leading-5 text-slate-500">
                      {card.detail}
                    </p>
                    <div className="pointer-events-none absolute -bottom-10 -right-6 h-28 w-28 rounded-full bg-sky-400/[0.035] blur-2xl transition group-hover:bg-sky-400/[0.10]" />
                  </article>
                ))}
              </div>
            </div>

            {/* Main management area */}
            <div className="grid gap-6 xl:grid-cols-[minmax(0,1.5fr)_minmax(300px,0.8fr)]">
              <section className="overflow-hidden rounded-2xl border border-white/10 bg-[#101620]">
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/[0.08] px-5 py-5 sm:px-6">
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-sky-400">
                      Operations
                    </p>
                    <h2 className="mt-2 text-lg font-bold text-white">
                      Workshop management
                    </h2>
                    <p className="mt-1 text-xs text-slate-500">
                      Access your main administration tools
                    </p>
                  </div>
                  <span className="rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 text-[10px] font-semibold text-slate-400">
                    JCS ADMIN
                  </span>
                </div>

                <div className="space-y-3 p-4 sm:p-5">
                  <Link
                    href="/admin/orders"
                    className="group flex items-center gap-4 rounded-xl border border-white/[0.07] bg-white/[0.02] p-4 transition hover:border-sky-400/25 hover:bg-sky-400/[0.04] sm:p-5"
                  >
                    <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-sky-400/20 bg-sky-400/10 text-xl text-sky-300">
                      â–¤
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-bold text-white">
                        Order management
                      </span>
                      <span className="mt-1 block text-xs leading-5 text-slate-500">
                        Review incoming orders and manage customer tuning jobs.
                      </span>
                    </span>
                    <span className="text-lg text-slate-600 transition group-hover:translate-x-1 group-hover:text-sky-300">
                      â†’
                    </span>
                  </Link>

                  <Link
                    href="/admin/customers"
                    className="group flex items-center gap-4 rounded-xl border border-white/[0.07] bg-white/[0.02] p-4 transition hover:border-amber-400/25 hover:bg-amber-400/[0.035] sm:p-5"
                  >
                    <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-amber-400/20 bg-amber-400/10 text-xl text-amber-300">
                      â™™
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-bold text-white">
                        Customer management
                      </span>
                      <span className="mt-1 block text-xs leading-5 text-slate-500">
                        View customer accounts and manage registered users.
                      </span>
                    </span>
                    <span className="text-lg text-slate-600 transition group-hover:translate-x-1 group-hover:text-amber-300">
                      â†’
                    </span>
                  </Link>
                  <Link
                    href="/admin/files"
                    className="group flex items-center gap-4 rounded-xl border border-white/[0.07] bg-white/[0.02] p-4 transition hover:border-sky-400/25 hover:bg-sky-400/[0.04] sm:p-5"
                  >
                    <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-sky-400/20 bg-sky-400/10 text-xl text-sky-300">Ã¢â€¡Â§</span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-semibold text-white">Tuning file management</span>
                      <span className="mt-1 block text-xs leading-5 text-slate-500">Review uploaded ECU and TCU files.</span>
                    </span>
                    <span className="text-lg text-slate-600 transition group-hover:translate-x-1 group-hover:text-sky-300">Ã¢â€ â€™</span>
                  </Link>
                </div>
              </section>

              {/* Account overview */}
              <section className="overflow-hidden rounded-2xl border border-white/10 bg-[#101620]">
                <div className="border-b border-white/[0.08] p-5 sm:p-6">
                  <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-sky-400">
                    Snapshot
                  </p>
                  <h2 className="mt-2 text-lg font-bold text-white">
                    Account overview
                  </h2>
                  <p className="mt-1 text-xs text-slate-500">
                    A quick summary of your workshop
                  </p>
                </div>

                <div className="p-5 sm:p-6">
                  <div className="space-y-5">
                    <div className="flex items-center justify-between gap-4">
                      <div className="flex items-center gap-3">
                        <span className="h-2 w-2 rounded-full bg-sky-400" />
                        <span className="text-sm text-slate-400">Customer accounts</span>
                      </div>
                      <span className="text-sm font-bold tabular-nums text-white">
                        {customers.count ?? 0}
                      </span>
                    </div>
                    <div className="flex items-center justify-between gap-4">
                      <div className="flex items-center gap-3">
                        <span className="h-2 w-2 rounded-full bg-amber-400" />
                        <span className="text-sm text-slate-400">Active orders</span>
                      </div>
                      <span className="text-sm font-bold tabular-nums text-amber-300">
                        {openOrders.count ?? 0}
                      </span>
                    </div>
                    <div className="flex items-center justify-between gap-4">
                      <div className="flex items-center gap-3">
                        <span className="h-2 w-2 rounded-full bg-emerald-400" />
                        <span className="text-sm text-slate-400">Completed orders</span>
                      </div>
                      <span className="text-sm font-bold tabular-nums text-emerald-300">
                        {completedOrders.count ?? 0}
                      </span>
                    </div>
                    <div className="flex items-center justify-between gap-4">
                      <div className="flex items-center gap-3">
                        <span className="h-2 w-2 rounded-full bg-blue-400" />
                        <span className="text-sm text-slate-400">Wallet balance</span>
                      </div>
                      <span className="text-sm font-bold tabular-nums text-white">
                        <MaskedAmount>{money(totalCredits)}</MaskedAmount>
                      </span>
                    </div>
                  </div>

                  <div className="mt-7 rounded-xl border border-sky-400/15 bg-gradient-to-br from-sky-400/[0.08] to-transparent p-4">
                    <div className="flex items-center gap-2">
                      <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-sky-400/10 text-sm text-sky-300">
                        âœ“
                      </span>
                      <p className="text-xs font-bold text-white">
                        Dashboard connected
                      </p>
                    </div>
                    <p className="mt-3 text-xs leading-6 text-slate-400">
                      These totals are loaded from your database. Only currently
                      implemented management pages are linked above.
                    </p>
                  </div>
                </div>
              </section>
            </div>

            <footer className="mt-10 flex flex-col justify-between gap-3 border-t border-white/[0.08] py-6 text-xs text-slate-600 sm:flex-row sm:items-center">
              <p>Â© {new Date().getFullYear()} JCS Automotive Tuning</p>
              <p>Administrator workspace <span className="px-2 text-slate-700">/</span> Built for the workshop</p>
            </footer>
          </div>
        </section>
      </div>
    </main>
    </>
  );
}




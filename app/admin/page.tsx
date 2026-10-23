
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

const money = (pence: number) =>
  new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
  }).format(pence / 100);

export default async function AdminDashboard() {
  const supabase = createClient();

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
      accent: "border-sky-400",
    },
    {
      label: "Open orders",
      value: String(openOrders.count ?? 0),
      accent: "border-yellow-400",
    },
    {
      label: "Completed jobs",
      value: String(completedOrders.count ?? 0),
      accent: "border-sky-400",
    },
    {
      label: "Wallet credits",
      value: money(totalCredits),
      accent: "border-yellow-400",
    },
  ];

  const navigation = [
    {
      label: "Customers",
      description: "Manage customer accounts",
      href: null,
    },
    {
      label: "Orders",
      description: "Review and process tuning jobs",
      href: "/admin/orders",
    },
    {
      label: "Tuning Files",
      description: "Customer uploads and completed files",
      href: null,
    },
    {
      label: "Wallet & Credits",
      description: "Balances and manual adjustments",
      href: null,
    },
    {
      label: "Transactions",
      description: "Payments and credit history",
      href: null,
    },
    {
      label: "Settings",
      description: "Administrator settings",
      href: null,
    },
  ];

  return (
    <main className="min-h-screen bg-[#101216] text-white">
      <div className="flex min-h-screen">
        <aside className="hidden w-64 shrink-0 border-r border-white/10 bg-[#090b0f] p-6 md:block">
          <div className="mb-10">
            <div className="text-3xl font-black tracking-tight">
              <span className="text-sky-400">JC</span>
              <span className="text-yellow-400">S</span>
            </div>
            <p className="mt-1 text-xs font-semibold tracking-[0.18em] text-gray-400">
              AUTOMOTIVE TUNING
            </p>
          </div>

          <p className="mb-3 text-xs uppercase tracking-widest text-gray-500">
            Workshop
          </p>

          <nav className="space-y-2">
            <a
              href="/admin"
              className="block rounded-lg border border-sky-400/30 bg-sky-400/10 px-4 py-3 font-semibold text-sky-300"
            >
              Overview
            </a>

            {navigation.map((item) =>
              item.href ? (
                <a
                  key={item.label}
                  href={item.href}
                  title={item.description}
                  className="block rounded-lg px-4 py-3 text-sm text-gray-300 transition hover:bg-white/5 hover:text-sky-300"
                >
                  {item.label}
                </a>
              ) : (
                <div
                  key={item.label}
                  title={item.description}
                  className="rounded-lg px-4 py-3 text-sm text-gray-300"
                >
                  {item.label}
                  <span className="ml-2 text-xs text-gray-600">Soon</span>
                </div>
              )
            )}
          </nav>
        </aside>

        <section className="min-w-0 flex-1 p-5 sm:p-8 lg:p-10">
          <header className="mb-10 flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="mb-2 text-sm font-semibold text-sky-400">
                JCS WORKSHOP CONTROL CENTRE
              </p>
              <h1 className="text-3xl font-black sm:text-4xl">
                Admin Dashboard
              </h1>
              <p className="mt-2 text-sm text-gray-400">
                Welcome back. Here&apos;s your business at a glance.
              </p>
            </div>

            <div className="rounded-lg border border-yellow-400/30 bg-yellow-400/10 px-4 py-2 text-sm font-semibold text-yellow-300">
              Administrator
            </div>
          </header>

          <div className="mb-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {cards.map((card) => (
              <article
                key={card.label}
                className={`rounded-xl border border-white/10 border-t-2 ${card.accent} bg-[#1a1e25] p-5`}
              >
                <p className="text-sm text-gray-400">{card.label}</p>
                <p className="mt-4 break-words text-3xl font-black">
                  {card.value}
                </p>
              </article>
            ))}
          </div>

          <section className="rounded-xl border border-white/10 bg-[#1a1e25] p-6">
            <h2 className="text-xl font-bold">Workshop management</h2>
            <p className="mt-2 text-sm leading-6 text-gray-400">
              Your dashboard is connected to live database totals. Order
              processing is now available from the sidebar. Customer
              management, file delivery and credit adjustments will be added
              as separate, access-controlled tools.
            </p>
            <div className="mt-5 h-1.5 w-full overflow-hidden rounded-full bg-gray-700">
              <div className="h-full w-1/3 rounded-full bg-sky-400" />
            </div>
            <p className="mt-3 text-xs text-gray-500">
              Dashboard overview ready · Orders management available
            </p>
          </section>

          <footer className="mt-8 border-t border-white/10 pt-5 text-xs text-gray-500">
            JCS Automotive Tuning · Secure administration
          </footer>
        </section>
      </div>
    </main>
  );
}

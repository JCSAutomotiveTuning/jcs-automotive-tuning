"use client";

import Link from "next/link";
import type { ReactNode } from "react";

type Area = "files" | "wallet" | "transactions" | "orders" | "staff" | "settings" | "dtc" | "loyalty";

const links: { href: string; title: string; key: Area | "overview" | "orders" | "customers" }[] = [
  { href: "/admin", title: "Overview", key: "overview" },
  { href: "/admin/orders", title: "Orders", key: "orders" },
  { href: "/admin/customers", title: "Customers", key: "customers" },
  { href: "/admin/staff", title: "Team & assignments", key: "staff" },
  { href: "/admin/files", title: "Tuning files", key: "files" },
  { href: "/admin/wallet", title: "Wallet & credits", key: "wallet" },
  { href: "/admin/transactions", title: "Transactions", key: "transactions" },
  { href: "/admin/dtc", title: "DTC Lookup", key: "dtc" },
  { href: "/admin/loyalty", title: "Loyalty Points", key: "loyalty" },
  { href: "/admin/settings", title: "Settings", key: "settings" },
];

export function AdminArea({
  active,
  title,
  description,
  children,
}: {
  active: Area;
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <main className="min-h-screen bg-[#090d14] px-4 py-8 text-slate-100 sm:px-8 lg:px-12">
      <div className="mx-auto max-w-7xl">
        <header className="mb-8 flex flex-wrap items-center justify-between gap-4">
          <div>
            <Link href="/admin" className="text-xs font-bold uppercase tracking-[0.2em] text-sky-400 hover:text-sky-300">
              JCS Automotive Tuning / Admin
            </Link>
            <h1 className="mt-3 text-3xl font-black tracking-tight sm:text-4xl">{title}</h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-400">{description}</p>
          </div>
          <Link href="/admin" className="rounded-xl border border-white/10 px-4 py-2 text-sm font-semibold text-slate-200 transition hover:bg-white/10">
            ← Dashboard
          </Link>
        </header>
        <nav aria-label="Admin sections" className="mb-6 flex flex-wrap gap-2">
          {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              aria-current={link.key === active ? "page" : undefined}
              className={`rounded-xl border px-3 py-2 text-xs font-semibold transition sm:text-sm ${
                link.key === active
                  ? "border-sky-400/30 bg-sky-400/10 text-sky-300"
                  : "border-white/10 bg-white/[0.03] text-slate-400 hover:bg-white/[0.07] hover:text-white"
              }`}
            >
              {link.title}
            </Link>
          ))}
        </nav>
        {children}
      </div>
    </main>
  );
}

export function Panel({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <section className={`overflow-hidden rounded-2xl border border-white/10 bg-[#101620] p-4 sm:p-6 ${className}`}>{children}</section>;
}

export function Feedback({ message, error = false }: { message: string; error?: boolean }) {
  return (
    <p role={error ? "alert" : "status"} className={`rounded-xl border px-4 py-3 text-sm ${error ? "border-red-400/30 bg-red-400/10 text-red-200" : "border-sky-400/20 bg-sky-400/10 text-sky-200"}`}>
      {message}
    </p>
  );
}

export const money = (pence: number): string =>
  new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP" }).format(pence / 100);

export const dateTime = (value: string | null | undefined): string => {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "—" : date.toLocaleString("en-GB");
};

export async function apiJson<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, { credentials: "same-origin", cache: "no-store", ...init });
  const body: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    const message = body && typeof body === "object" && "error" in body && typeof body.error === "string"
      ? body.error
      : `Request failed (HTTP ${response.status}).`;
    throw new Error(message);
  }
  return body as T;
}

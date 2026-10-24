"use client";
import { useEffect, useState } from "react";
const KEY = "jcs-hide-dashboard-prices";
export function PriceVisibilityToggle() {
  const [hidden, setHidden] = useState(false);
  useEffect(() => {
    try { setHidden(localStorage.getItem(KEY) === "1"); } catch {}
    const sync = (event: Event) => setHidden((event as CustomEvent<boolean>).detail);
    window.addEventListener("jcs-price-visibility", sync);
    return () => window.removeEventListener("jcs-price-visibility", sync);
  }, []);
  useEffect(() => {
    document.documentElement.classList.toggle("jcs-prices-hidden", hidden);
    try { localStorage.setItem(KEY, hidden ? "1" : "0"); } catch {}
    return () => document.documentElement.classList.remove("jcs-prices-hidden");
  }, [hidden]);
  return <button type="button" aria-pressed={hidden} onClick={() => {
    const next = !hidden; setHidden(next);
    window.dispatchEvent(new CustomEvent("jcs-price-visibility", { detail: next }));
  }} className="rounded-xl border border-sky-400/30 bg-sky-400/10 px-3 py-2 text-sm font-semibold text-sky-200 hover:bg-sky-400/20">
    {hidden ? "Show prices" : "Hide prices"}
  </button>;
}
export function MaskedAmount({ children }: { children: React.ReactNode }) {
  return <span className="jcs-money-mask"><span className="jcs-money-real">{children}</span><span className="jcs-money-hidden" aria-label="Amount hidden">••••••</span></span>;
}

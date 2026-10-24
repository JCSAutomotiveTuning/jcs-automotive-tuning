"use client";

import { useEffect, useSyncExternalStore } from "react";

const KEY = "jcs-hide-dashboard-prices";
const EVENT = "jcs-price-visibility";

function subscribe(callback: () => void) {
  window.addEventListener(EVENT, callback);
  window.addEventListener("storage", callback);

  return () => {
    window.removeEventListener(EVENT, callback);
    window.removeEventListener("storage", callback);
  };
}

function getSnapshot() {
  try {
    return localStorage.getItem(KEY) === "1";
  } catch {
    return false;
  }
}

function getServerSnapshot() {
  return false;
}

export function PriceVisibilityToggle() {
  const hidden = useSyncExternalStore(
    subscribe,
    getSnapshot,
    getServerSnapshot
  );

  useEffect(() => {
    document.documentElement.classList.toggle(
      "jcs-prices-hidden",
      hidden
    );

    return () => {
      document.documentElement.classList.remove(
        "jcs-prices-hidden"
      );
    };
  }, [hidden]);

  function toggle() {
    try {
      localStorage.setItem(KEY, hidden ? "0" : "1");
    } catch {
      return;
    }

    window.dispatchEvent(new Event(EVENT));
  }

  return (
    <button
      type="button"
      aria-pressed={hidden}
      onClick={toggle}
      className="rounded-xl border border-sky-400/30 bg-sky-400/10 px-3 py-2 text-sm font-semibold text-sky-200 hover:bg-sky-400/20"
    >
      {hidden ? "Show prices" : "Hide prices"}
    </button>
  );
}

export function MaskedAmount({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <span className="jcs-money-mask">
      <span className="jcs-money-real">{children}</span>
      <span className="jcs-money-hidden" aria-label="Amount hidden">
        {"\u2022".repeat(6)}
      </span>
    </span>
  );
}

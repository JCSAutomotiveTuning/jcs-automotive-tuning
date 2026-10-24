"use client";

import { useEffect, useState } from "react";

type LondonDateTime = {
  date: string;
  time: string;
  zone: string;
};

function getLondonDateTime(): LondonDateTime {
  const now = new Date();

  return {
    date: new Intl.DateTimeFormat("en-GB", {
      timeZone: "Europe/London",
      weekday: "short",
      day: "2-digit",
      month: "short",
      year: "numeric",
    }).format(now),

    time: new Intl.DateTimeFormat("en-GB", {
      timeZone: "Europe/London",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
    }).format(now),

    zone:
      new Intl.DateTimeFormat("en-GB", {
        timeZone: "Europe/London",
        timeZoneName: "short",
      })
        .formatToParts(now)
        .find((part) => part.type === "timeZoneName")?.value ?? "UK TIME",
  };
}

export default function LiveClock() {
  const [dateTime, setDateTime] = useState<LondonDateTime | null>(null);

  useEffect(() => {
    const update = () => setDateTime(getLondonDateTime());

    update();
    const interval = window.setInterval(update, 1000);

    return () => window.clearInterval(interval);
  }, []);

  return (
    <div
      aria-label="Current UK date and time"
      className="flex min-w-[170px] flex-col gap-1.5 rounded-xl border border-sky-400/25 bg-slate-950/80 px-4 py-3 shadow-lg shadow-sky-950/20"
    >
      <div className="flex items-center gap-2 whitespace-nowrap text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">
        <span className="h-1.5 w-1.5 rounded-full bg-sky-400" />
        {dateTime?.date ?? "UK local date"}
      </div>

      <time
        className="whitespace-nowrap font-mono text-xl font-bold leading-tight tracking-tight tabular-nums text-sky-300 sm:text-2xl"
      >
        {dateTime?.time ?? "--:--:--"}
      </time>

      <div className="flex items-center justify-between gap-3 border-t border-white/10 pt-2">
        <span className="inline-flex rounded-md border border-sky-400/20 bg-sky-400/10 px-2 py-1 text-[10px] font-bold tracking-wider text-sky-300">
          {dateTime?.zone ?? "UK TIME"}
        </span>

        <span className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-emerald-400">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
          Live
        </span>
      </div>
    </div>
  );
}

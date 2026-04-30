"use client";

import { useState } from "react";
import type { AdjustmentLogEntry } from "@/lib/fitness/types";

interface Props {
  entries: AdjustmentLogEntry[];
}

export function AdjustmentLog({ entries }: Props) {
  const [open, setOpen] = useState(false);

  if (entries.length === 0) {
    return (
      <div
        className="rounded-xl px-5 py-4 text-center"
        style={{ backgroundColor: "#1A1510", border: "1px solid #241E17" }}
      >
        <p className="text-xs" style={{ color: "#6B5C4A" }}>
          No adjustments yet. Use the Telegram bot or the API to modify your plan.
        </p>
      </div>
    );
  }

  const visible = open ? entries : entries.slice(-3); // show most recent 3 when collapsed

  return (
    <div
      className="rounded-xl overflow-hidden"
      style={{ border: "1px solid #241E17" }}
    >
      {/* Header */}
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between px-5 py-3.5 transition-colors"
        style={{ backgroundColor: "#1A1510" }}
      >
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-semibold tracking-widest uppercase" style={{ color: "#6B5C4A" }}>
            Adjustment Log
          </span>
          <span
            className="text-[10px] font-medium px-1.5 py-0.5 rounded-full tabular-nums"
            style={{ backgroundColor: "#241E17", color: "#A89880" }}
          >
            {entries.length}
          </span>
        </div>
        <svg
          width="12" height="12" viewBox="0 0 12 12" fill="none"
          stroke="#6B5C4A" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"
          style={{ transform: open ? "rotate(180deg)" : "none", transition: "transform 150ms" }}
        >
          <polyline points="2 4 6 8 10 4"/>
        </svg>
      </button>

      {/* Entries */}
      <div
        className="divide-y"
        style={{ borderColor: "#1E1A14", backgroundColor: "#13110E" }}
      >
        {[...visible].reverse().map((entry, i) => (
          <div key={i} className="px-5 py-3 space-y-1">
            <p
              className="text-[10px] font-medium tabular-nums"
              style={{ color: "#6B5C4A" }}
            >
              {formatDateTime(entry.date)}
            </p>
            <p className="text-xs leading-relaxed" style={{ color: "#A89880" }}>
              {entry.summary}
            </p>
          </div>
        ))}
      </div>

      {/* Show all toggle */}
      {entries.length > 3 && (
        <button
          onClick={() => setOpen((v) => !v)}
          className="w-full py-2.5 text-xs font-medium transition-colors"
          style={{ backgroundColor: "#1A1510", borderTop: "1px solid #1E1A14", color: "#6B5C4A" }}
        >
          {open ? "Show less" : `Show all ${entries.length} adjustments`}
        </button>
      )}
    </div>
  );
}

function formatDateTime(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString("en-ZA", {
      day: "numeric", month: "short", year: "numeric",
      hour: "2-digit", minute: "2-digit",
      timeZone: "Africa/Johannesburg",
    });
  } catch {
    return iso;
  }
}

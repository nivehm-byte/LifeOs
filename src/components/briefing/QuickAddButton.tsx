"use client";

import { useState } from "react";
import { QuickAddModal } from "./QuickAddModal";
import type { Database } from "@/types/database";

type DomainRow = Database["public"]["Tables"]["domains"]["Row"];

interface Props {
  domains: DomainRow[];
}

export function QuickAddButton({ domains }: Props) {
  const [open, setOpen] = useState(false);

  return (
    <>
      {/* FAB */}
      <button
        onClick={() => setOpen(true)}
        aria-label="Add task"
        className="fixed bottom-24 right-5 z-50 w-14 h-14 rounded-full flex items-center justify-center shadow-xl transition-transform active:scale-95 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/60"
        style={{ backgroundColor: "#D4A96A" }}
      >
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#0F0C09" strokeWidth="2.5" strokeLinecap="round">
          <line x1="12" y1="5" x2="12" y2="19"/>
          <line x1="5"  y1="12" x2="19" y2="12"/>
        </svg>
      </button>

      {open && (
        <QuickAddModal domains={domains} onClose={() => setOpen(false)} />
      )}
    </>
  );
}

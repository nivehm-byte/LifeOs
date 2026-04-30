"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { createTaskAction } from "@/lib/tasks/actions";
import { DOMAIN_HEX, DOMAIN_LABEL, DOMAIN_ICON, DOMAIN_ORDER } from "@/lib/utils/domain";
import type { Database } from "@/types/database";
import type { Domain } from "@/types/database";

type DomainRow = Database["public"]["Tables"]["domains"]["Row"];

interface Props {
  domains:      DomainRow[];
  onClose:      () => void;
  initialDate?: string; // pre-fills the due-date field (YYYY-MM-DD)
}

const PRIORITIES = [
  { value: "low",    label: "Low" },
  { value: "medium", label: "Med" },
  { value: "high",   label: "High" },
  { value: "urgent", label: "🔴" },
] as const;

export function QuickAddModal({ domains, onClose, initialDate }: Props) {
  const titleRef  = useRef<HTMLInputElement>(null);
  const [title,    setTitle]    = useState("");
  const [domainId, setDomainId] = useState(domains[0]?.id ?? "");
  const [priority, setPriority] = useState<"low" | "medium" | "high" | "urgent">("medium");
  const [dueDate,  setDueDate]  = useState(initialDate ?? "");
  const [error,    setError]    = useState<string | null>(null);
  const [isPending, start]      = useTransition();

  // Focus title on open; close on Escape
  useEffect(() => {
    titleRef.current?.focus();
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  // Lock body scroll while modal is open
  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = ""; };
  }, []);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) { setError("Title is required"); return; }
    if (!domainId)      { setError("Choose a domain"); return; }
    setError(null);

    start(async () => {
      try {
        await createTaskAction({
          title:      title.trim(),
          domain_id:  domainId,
          priority,
          due_date:   dueDate || null,
          created_via: "web",
        });
        onClose();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to create task");
      }
    });
  }

  // Build an ordered domain list from what the server returned
  const orderedDomains = DOMAIN_ORDER
    .map((name) => domains.find((d) => d.name === name))
    .filter(Boolean) as DomainRow[];

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-50 bg-canvas/80 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden
      />

      {/* Sheet — slides up from bottom on mobile */}
      <div
        className="fixed bottom-0 left-0 right-0 z-50 max-w-2xl mx-auto rounded-t-2xl shadow-2xl"
        style={{ backgroundColor: "#1A1510", border: "1px solid #241E17" }}
        role="dialog"
        aria-modal
        aria-label="Quick add task"
      >
        {/* Drag handle */}
        <div className="flex justify-center pt-3 pb-1">
          <div className="w-10 h-1 rounded-full bg-surface-overlay" />
        </div>

        <form onSubmit={handleSubmit} className="px-5 pb-8 pt-3 space-y-5">
          {/* Header */}
          <div className="flex items-center justify-between">
            <h2 className="font-heading text-xl text-text-primary">New Task</h2>
            <button
              type="button"
              onClick={onClose}
              className="w-8 h-8 flex items-center justify-center rounded-lg text-text-muted hover:text-text-secondary transition-colors"
            >
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
                <line x1="3" y1="3" x2="13" y2="13"/>
                <line x1="13" y1="3" x2="3" y2="13"/>
              </svg>
            </button>
          </div>

          {/* Title input */}
          <div>
            <input
              ref={titleRef}
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="What needs doing?"
              className="w-full bg-transparent border-b-2 border-surface-raised focus:border-accent/60 outline-none text-text-primary placeholder-text-muted py-2 text-base transition-colors"
              maxLength={500}
              required
            />
          </div>

          {/* Domain selector */}
          <div className="space-y-2">
            <label className="text-xs font-medium tracking-widest uppercase text-text-muted">
              Domain
            </label>
            <div className="grid grid-cols-4 gap-2">
              {orderedDomains.map((d) => {
                const hex      = DOMAIN_HEX[d.name as Domain];
                const selected = d.id === domainId;
                return (
                  <button
                    key={d.id}
                    type="button"
                    onClick={() => setDomainId(d.id)}
                    className="flex flex-col items-center gap-1.5 py-2.5 rounded-xl text-center transition-all"
                    style={{
                      backgroundColor: selected ? `${hex}26` : "#241E17",
                      border:          `1px solid ${selected ? `${hex}60` : "#2E271E"}`,
                    }}
                  >
                    <span className="text-lg leading-none">{DOMAIN_ICON[d.name as Domain]}</span>
                    <span
                      className="text-[10px] font-medium"
                      style={{ color: selected ? hex : "#6B5C4A" }}
                    >
                      {DOMAIN_LABEL[d.name as Domain]}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Priority + Due date row */}
          <div className="flex gap-4">
            {/* Priority */}
            <div className="flex-1 space-y-2">
              <label className="text-xs font-medium tracking-widest uppercase text-text-muted">
                Priority
              </label>
              <div className="flex gap-1.5">
                {PRIORITIES.map((p) => {
                  const selected = p.value === priority;
                  const colors = {
                    low:    "#7DB87A",
                    medium: "#D4A96A",
                    high:   "#E0975C",
                    urgent: "#E05C5C",
                  } as const;
                  const hex = colors[p.value];
                  return (
                    <button
                      key={p.value}
                      type="button"
                      onClick={() => setPriority(p.value)}
                      className="flex-1 py-2 rounded-lg text-xs font-medium transition-all"
                      style={{
                        backgroundColor: selected ? `${hex}26` : "#241E17",
                        border:          `1px solid ${selected ? `${hex}60` : "#2E271E"}`,
                        color:           selected ? hex : "#6B5C4A",
                      }}
                    >
                      {p.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Due date */}
            <div className="flex-1 space-y-2">
              <label className="text-xs font-medium tracking-widest uppercase text-text-muted">
                Due date
              </label>
              <input
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="w-full bg-surface-raised border border-surface-overlay rounded-lg px-3 py-2 text-sm text-text-primary outline-none focus:border-accent/40 transition-colors"
              />
            </div>
          </div>

          {/* Error */}
          {error && (
            <p className="text-xs text-status-urgent">{error}</p>
          )}

          {/* Submit */}
          <button
            type="submit"
            disabled={isPending || !title.trim()}
            className="w-full py-3.5 rounded-xl font-medium text-sm transition-all active:scale-[0.98] disabled:opacity-40"
            style={{ backgroundColor: "#D4A96A", color: "#0F0C09" }}
          >
            {isPending ? "Adding…" : "Add Task"}
          </button>
        </form>
      </div>
    </>
  );
}

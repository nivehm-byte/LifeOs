"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import {
  weekDays, weekRange, weekLabel,
  monthGrid, monthRange,
  MONTH_NAMES,
  toDateStr,
} from "@/lib/utils/calendar";
import { rescheduleTask }    from "@/lib/tasks/actions";
import { WeekView }          from "./WeekView";
import { MonthView }         from "./MonthView";
import { QuickAddModal }     from "@/components/briefing/QuickAddModal";
import type { TaskWithDomain }          from "@/lib/tasks/queries";
import type { CalendarEventWithDomain } from "@/lib/calendar/queries";
import type { Database } from "@/types/database";

type DomainRow = Database["public"]["Tables"]["domains"]["Row"];
type View = "week" | "month";

interface Props {
  initialTasks:  TaskWithDomain[];
  initialEvents: CalendarEventWithDomain[];
  domains:       DomainRow[];
  today:         string; // YYYY-MM-DD
}

export function CalendarView({ initialTasks, initialEvents, domains, today }: Props) {
  const [view,       setView]       = useState<View>("week");
  const [anchor,     setAnchor]     = useState<Date>(() => new Date(today + "T00:00:00"));
  const [tasks,      setTasks]      = useState<TaskWithDomain[]>(initialTasks);
  const [events,     setEvents]     = useState<CalendarEventWithDomain[]>(initialEvents);
  const [loading,    setLoading]    = useState(false);
  const [addDate,    setAddDate]    = useState<string | null>(null);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [, startTransition]         = useTransition();

  // Skip the initial fetch (SSR data already covers current week)
  const isMounted = useRef(false);

  // Derived range for current anchor + view
  const range = view === "week" ? weekRange(anchor) : monthRange(anchor);

  // ── Data fetching ───────────────────────────────────────────────
  const fetchRange = useCallback(async (from: string, to: string) => {
    setLoading(true);
    try {
      const [tRes, eRes] = await Promise.all([
        fetch(`/api/tasks?due_from=${from}&due_to=${to}&limit=200`).then((r) => r.json()),
        fetch(`/api/calendar/events?from=${from}&to=${to}`).then((r) => r.json()),
      ]);
      setTasks((tRes.data  ?? []) as TaskWithDomain[]);
      setEvents((eRes.data ?? []) as CalendarEventWithDomain[]);
    } catch {
      // keep stale data on network error
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!isMounted.current) { isMounted.current = true; return; }
    fetchRange(range.from, range.to);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [range.from, range.to]);

  // ── Navigation ──────────────────────────────────────────────────
  function navigate(dir: -1 | 1) {
    setAnchor((a) => {
      const d = new Date(a);
      if (view === "week")  d.setDate(d.getDate() + dir * 7);
      else                  d.setMonth(d.getMonth() + dir);
      return d;
    });
  }

  function goToday() {
    setAnchor(new Date(today + "T00:00:00"));
  }

  // ── View switch ─────────────────────────────────────────────────
  function switchView(v: View) {
    setView(v);
    // anchor stays — view adjusts around same week/month
  }

  // ── Drag-to-reschedule ──────────────────────────────────────────
  function handleDragStart(e: React.DragEvent, taskId: string) {
    e.dataTransfer.setData("taskId", taskId);
    e.dataTransfer.effectAllowed = "move";
    setDraggingId(taskId);
  }

  function handleDragEnd() {
    setDraggingId(null);
  }

  function handleTaskDrop(taskId: string, dateStr: string) {
    setDraggingId(null);

    // Find the task being moved
    const task = tasks.find((t) => t.id === taskId);
    if (!task || task.due_date === dateStr) return;

    // Optimistic update
    setTasks((prev) =>
      prev.map((t) => (t.id === taskId ? { ...t, due_date: dateStr } : t))
    );

    startTransition(async () => {
      try {
        await rescheduleTask(taskId, { due_date: dateStr });
      } catch {
        // Revert on failure by re-fetching
        fetchRange(range.from, range.to);
      }
    });
  }

  // ── Click-to-add ────────────────────────────────────────────────
  function handleCellClick(dateStr: string) {
    setAddDate(dateStr);
  }

  function handleModalClose() {
    setAddDate(null);
    // Re-fetch to pick up the new task
    fetchRange(range.from, range.to);
  }

  // ── Header label ────────────────────────────────────────────────
  const headerLabel = view === "week"
    ? weekLabel(anchor)
    : `${MONTH_NAMES[anchor.getMonth()]} ${anchor.getFullYear()}`;

  // ── Grid data ───────────────────────────────────────────────────
  const days  = weekDays(anchor);
  const weeks = monthGrid(anchor);

  return (
    <div className="space-y-4">
      {/* ── Header ───────────────────────────────────────────────── */}
      <div className="flex items-center justify-between gap-3">
        {/* Nav buttons */}
        <div className="flex items-center gap-1">
          <NavBtn onClick={() => navigate(-1)} aria="Previous">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="10 3 5 8 10 13"/>
            </svg>
          </NavBtn>
          <NavBtn onClick={() => navigate(1)} aria="Next">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="6 3 11 8 6 13"/>
            </svg>
          </NavBtn>
        </div>

        {/* Period label */}
        <div className="flex-1 flex items-center gap-2 min-w-0">
          <h1 className="font-heading text-base text-text-primary truncate">
            {headerLabel}
          </h1>
          {loading && (
            <span className="text-[10px] text-text-muted shrink-0">loading…</span>
          )}
        </div>

        {/* Today + view toggle */}
        <div className="flex items-center gap-2 shrink-0">
          {toDateStr(anchor) !== today && (
            <button
              onClick={goToday}
              className="text-xs px-2.5 py-1 rounded-lg font-medium transition-all"
              style={{ backgroundColor: "#241E17", color: "#D4A96A", border: "1px solid #D4A96A30" }}
            >
              Today
            </button>
          )}
          <ViewToggle view={view} onChange={switchView} />
        </div>
      </div>

      {/* ── Calendar grid ────────────────────────────────────────── */}
      {view === "week" ? (
        <WeekView
          days={days}
          tasks={tasks}
          events={events}
          today={today}
          onCellClick={handleCellClick}
          draggingId={draggingId}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
          onTaskDrop={handleTaskDrop}
        />
      ) : (
        <MonthView
          weeks={weeks}
          tasks={tasks}
          events={events}
          today={today}
          anchorMonth={anchor.getMonth()}
          onCellClick={handleCellClick}
          draggingId={draggingId}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
          onTaskDrop={handleTaskDrop}
        />
      )}

      {/* ── Quick-add modal ───────────────────────────────────────── */}
      {addDate !== null && (
        <QuickAddModal
          domains={domains}
          initialDate={addDate}
          onClose={handleModalClose}
        />
      )}
    </div>
  );
}

// ── Small reusable pieces ─────────────────────────────────────────

function NavBtn({
  onClick,
  aria,
  children,
}: {
  onClick: () => void;
  aria: string;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      aria-label={aria}
      className="w-8 h-8 flex items-center justify-center rounded-lg transition-colors text-text-muted hover:text-text-secondary"
      style={{ backgroundColor: "#1A1510", border: "1px solid #241E17" }}
    >
      {children}
    </button>
  );
}

function ViewToggle({ view, onChange }: { view: View; onChange: (v: View) => void }) {
  return (
    <div
      className="flex rounded-lg overflow-hidden"
      style={{ border: "1px solid #241E17" }}
    >
      {(["week", "month"] as const).map((v) => (
        <button
          key={v}
          onClick={() => onChange(v)}
          className="px-3 py-1.5 text-xs font-medium capitalize transition-colors"
          style={{
            backgroundColor: view === v ? "#241E17" : "transparent",
            color:           view === v ? "#D4A96A" : "#6B5C4A",
          }}
        >
          {v}
        </button>
      ))}
    </div>
  );
}

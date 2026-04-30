"use client";

import { useState, useTransition } from "react";
import type { FitnessSessionRow } from "@/lib/fitness/queries";
import type { PlanExercise }      from "@/lib/fitness/types";

const FITNESS_GREEN  = "#7DB87A";
const DAY_NAMES      = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

interface Props {
  session:   FitnessSessionRow | null;
  onUpdated: (updated: FitnessSessionRow) => void;
}

export function TodaySessionCard({ session, onUpdated }: Props) {
  const [notes,      setNotes]      = useState(session?.actual_notes ?? "");
  const [isPending,  startTransition] = useTransition();
  const [localStatus, setLocalStatus] = useState(session?.status ?? "upcoming");
  const [showNotes,   setShowNotes]   = useState(false);

  if (!session) {
    return (
      <div
        className="rounded-2xl px-5 py-8 flex flex-col items-center gap-2 text-center"
        style={{ backgroundColor: "#1A1510", border: "1px solid #241E17" }}
      >
        <span className="text-3xl">🌿</span>
        <p className="font-medium" style={{ color: "#A89880" }}>Rest day</p>
        <p className="text-xs" style={{ color: "#6B5C4A" }}>No session scheduled for today.</p>
      </div>
    );
  }

  const exercises = (session.prescribed_exercises ?? []) as unknown as PlanExercise[];
  const dayName   = DAY_NAMES[session.day_of_week] ?? "";
  const typeLabel = session.session_type === "gym" ? "Gym" : "Run";
  const typeIcon  = session.session_type === "gym"  ? "🏋️" : "🏃";
  const isDone    = localStatus === "completed";
  const isSkipped = localStatus === "skipped";

  function handleAction(newStatus: "completed" | "skipped") {
    const nextStatus = localStatus === newStatus ? "upcoming" : newStatus;
    setLocalStatus(nextStatus);

    startTransition(async () => {
      try {
        const res = await fetch(`/api/fitness/sessions/${session!.id}`, {
          method:  "PATCH",
          headers: { "Content-Type": "application/json" },
          body:    JSON.stringify({ status: nextStatus, actual_notes: notes || null }),
        });
        const json = await res.json() as { data?: FitnessSessionRow };
        if (json.data) onUpdated(json.data);
      } catch {
        setLocalStatus(localStatus); // revert on error
      }
    });
  }

  function saveNotes() {
    startTransition(async () => {
      try {
        const res = await fetch(`/api/fitness/sessions/${session!.id}`, {
          method:  "PATCH",
          headers: { "Content-Type": "application/json" },
          body:    JSON.stringify({ status: localStatus, actual_notes: notes || null }),
        });
        const json = await res.json() as { data?: FitnessSessionRow };
        if (json.data) onUpdated(json.data);
      } catch { /* silent */ }
    });
  }

  return (
    <div
      className="rounded-2xl overflow-hidden"
      style={{ border: `1px solid ${isDone ? FITNESS_GREEN + "40" : "#241E17"}` }}
    >
      {/* Header */}
      <div
        className="px-5 py-4 flex items-start justify-between gap-3"
        style={{ backgroundColor: isDone ? `${FITNESS_GREEN}10` : "#1A1510" }}
      >
        <div className="min-w-0">
          <div className="flex items-center gap-2 mb-0.5">
            <span>{typeIcon}</span>
            <span
              className="text-[10px] font-semibold tracking-widest uppercase"
              style={{ color: "#6B5C4A" }}
            >
              Today · {dayName} · {typeLabel}
            </span>
          </div>
          <h2 className="font-heading text-lg text-text-primary leading-snug">
            {(session as unknown as { title?: string }).title ?? `${typeLabel} Session`}
          </h2>
        </div>

        {/* Status badge */}
        {isDone && (
          <span
            className="shrink-0 text-[10px] font-semibold tracking-widest uppercase px-2.5 py-1 rounded-full"
            style={{ backgroundColor: `${FITNESS_GREEN}20`, color: FITNESS_GREEN }}
          >
            Done ✓
          </span>
        )}
        {isSkipped && (
          <span
            className="shrink-0 text-[10px] font-semibold tracking-widest uppercase px-2.5 py-1 rounded-full"
            style={{ backgroundColor: "#24221E", color: "#6B5C4A" }}
          >
            Skipped
          </span>
        )}
      </div>

      {/* Exercise list */}
      {exercises.length > 0 && (
        <div
          className="px-5 py-3 space-y-2 border-t"
          style={{ backgroundColor: "#13110E", borderColor: "#1E1A14" }}
        >
          {exercises.map((ex, i) => (
            <ExerciseRow key={i} ex={ex} done={isDone} />
          ))}
        </div>
      )}

      {/* Session notes (plan-level) */}
      {(session as unknown as { notes?: string }).notes && (
        <div
          className="px-5 py-2.5 border-t"
          style={{ backgroundColor: "#13110E", borderColor: "#1E1A14" }}
        >
          <p className="text-xs italic" style={{ color: "#6B5C4A" }}>
            {(session as unknown as { notes?: string }).notes}
          </p>
        </div>
      )}

      {/* Actual notes */}
      {showNotes && (
        <div
          className="px-5 py-3 border-t space-y-2"
          style={{ backgroundColor: "#13110E", borderColor: "#1E1A14" }}
        >
          <label className="text-[10px] font-semibold tracking-widest uppercase" style={{ color: "#6B5C4A" }}>
            Session notes
          </label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            onBlur={saveNotes}
            rows={3}
            placeholder="How did it go?"
            className="w-full bg-transparent resize-none text-sm text-text-primary placeholder-text-muted outline-none rounded-lg p-2 transition-colors"
            style={{ border: "1px solid #241E17" }}
          />
        </div>
      )}

      {/* Action buttons */}
      <div
        className="px-5 py-3.5 flex items-center gap-2.5 border-t"
        style={{ backgroundColor: "#1A1510", borderColor: "#1E1A14" }}
      >
        <button
          onClick={() => handleAction("completed")}
          disabled={isPending}
          className="flex-1 py-2.5 rounded-xl text-sm font-medium transition-all active:scale-[0.98] disabled:opacity-40"
          style={{
            backgroundColor: isDone ? `${FITNESS_GREEN}30` : FITNESS_GREEN,
            color:           isDone ? FITNESS_GREEN : "#0F0C09",
            border:          isDone ? `1px solid ${FITNESS_GREEN}50` : "none",
          }}
        >
          {isDone ? "Mark Incomplete" : isPending ? "Saving…" : "Mark Complete"}
        </button>

        <button
          onClick={() => handleAction("skipped")}
          disabled={isPending}
          className="px-4 py-2.5 rounded-xl text-sm font-medium transition-all active:scale-[0.98] disabled:opacity-40"
          style={{
            backgroundColor: isSkipped ? "#2A2520" : "#241E17",
            color:           isSkipped ? "#A89880"  : "#6B5C4A",
            border:          `1px solid ${isSkipped ? "#3D3328" : "#2E271E"}`,
          }}
        >
          {isSkipped ? "Unskip" : "Skip"}
        </button>

        <button
          onClick={() => setShowNotes((v) => !v)}
          className="p-2.5 rounded-xl transition-colors"
          style={{
            backgroundColor: showNotes ? "#241E17" : "transparent",
            color:           "#6B5C4A",
            border:          "1px solid #2E271E",
          }}
          title="Add notes"
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
            <path d="M2 2h10v8H8l-2 2-2-2H2z"/>
          </svg>
        </button>
      </div>
    </div>
  );
}

// ── Exercise row ──────────────────────────────────────────────────

function ExerciseRow({ ex, done }: { ex: PlanExercise; done: boolean }) {
  const parts: string[] = [];
  if (ex.sets && ex.reps)       parts.push(`${ex.sets} × ${ex.reps}`);
  else if (ex.sets)             parts.push(`${ex.sets} sets`);
  if (ex.weight_kg)             parts.push(`@ ${ex.weight_kg} kg`);
  if (ex.duration_min)          parts.push(`${ex.duration_min} min`);
  if (ex.distance_km)           parts.push(`${ex.distance_km} km`);
  if (ex.rest_seconds)          parts.push(`${ex.rest_seconds}s rest`);

  return (
    <div className="flex items-baseline justify-between gap-3">
      <span
        className="text-sm font-medium truncate"
        style={{
          color:          done ? "#6B5C4A" : "#C8B89A",
          textDecoration: done ? "line-through" : "none",
        }}
      >
        {ex.name}
      </span>
      <span className="shrink-0 text-xs tabular-nums" style={{ color: "#6B5C4A" }}>
        {parts.join("  ")}
      </span>
    </div>
  );
}

"use client";

import { useState } from "react";
import type { FitnessSessionRow } from "@/lib/fitness/queries";
import type { PlanWeek, PlanExercise } from "@/lib/fitness/types";

const FITNESS_GREEN = "#7DB87A";
const DAY_NAMES     = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

interface Props {
  weeks:        PlanWeek[];
  sessions:     FitnessSessionRow[];
  currentWeek:  number;
}

export function WeekProgression({ weeks, sessions, currentWeek }: Props) {
  // Current week is expanded by default; others collapsed
  const [expanded, setExpanded] = useState<Set<number>>(
    () => new Set([currentWeek])
  );

  function toggle(wn: number) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(wn)) { next.delete(wn); } else { next.add(wn); }
      return next;
    });
  }

  return (
    <div className="space-y-2">
      <h2 className="text-[10px] font-semibold tracking-widest uppercase" style={{ color: "#6B5C4A" }}>
        Plan Progression
      </h2>

      <div className="space-y-1.5">
        {weeks.map((week) => {
          const weekSessions = sessions.filter((s) => s.week_number === week.week_number);
          const done         = weekSessions.filter((s) => s.status === "completed").length;
          const total        = weekSessions.length;
          const isCurrentWk  = week.week_number === currentWeek;
          const isPast       = week.week_number < currentWeek;
          const isOpen       = expanded.has(week.week_number);

          return (
            <div
              key={week.week_number}
              className="rounded-xl overflow-hidden transition-all"
              style={{
                border: `1px solid ${isCurrentWk ? FITNESS_GREEN + "40" : "#241E17"}`,
              }}
            >
              {/* Week row header */}
              <button
                onClick={() => toggle(week.week_number)}
                className="w-full flex items-center gap-3 px-4 py-3 text-left transition-colors"
                style={{
                  backgroundColor: isCurrentWk ? `${FITNESS_GREEN}08` : "#1A1510",
                }}
              >
                {/* Chevron */}
                <svg
                  width="12" height="12" viewBox="0 0 12 12" fill="none"
                  stroke="#6B5C4A" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"
                  style={{ transform: isOpen ? "rotate(90deg)" : "none", transition: "transform 150ms", flexShrink: 0 }}
                >
                  <polyline points="3 2 8 6 3 10"/>
                </svg>

                {/* Week number + theme */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span
                      className="text-xs font-semibold"
                      style={{ color: isCurrentWk ? FITNESS_GREEN : isPast ? "#6B5C4A" : "#A89880" }}
                    >
                      Week {week.week_number}
                    </span>
                    {week.theme && (
                      <span className="text-[10px]" style={{ color: "#6B5C4A" }}>
                        · {week.theme}
                      </span>
                    )}
                    {isCurrentWk && (
                      <span
                        className="text-[9px] font-semibold tracking-wider uppercase px-1.5 py-0.5 rounded-full"
                        style={{ backgroundColor: `${FITNESS_GREEN}20`, color: FITNESS_GREEN }}
                      >
                        Now
                      </span>
                    )}
                  </div>
                </div>

                {/* Status dots */}
                <div className="flex items-center gap-1 shrink-0">
                  {weekSessions.map((s) => (
                    <SessionDot key={s.id} status={s.status} />
                  ))}
                  {weekSessions.length === 0 && (
                    <span className="text-[10px]" style={{ color: "#3D3328" }}>—</span>
                  )}
                </div>

                {/* Count */}
                <span
                  className="text-[10px] tabular-nums shrink-0 ml-1"
                  style={{ color: "#6B5C4A" }}
                >
                  {done}/{total}
                </span>
              </button>

              {/* Expanded session details */}
              {isOpen && weekSessions.length > 0 && (
                <div
                  className="border-t divide-y"
                  style={{ borderColor: "#1E1A14", backgroundColor: "#13110E" }}
                >
                  {weekSessions.map((s) => (
                    <SessionRow key={s.id} session={s} />
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Session dot ───────────────────────────────────────────────────

function SessionDot({ status }: { status: string }) {
  const color =
    status === "completed" ? FITNESS_GREEN
    : status === "skipped" ? "#4A3F32"
    : "#2E271E";
  const fill =
    status === "completed" ? FITNESS_GREEN
    : status === "skipped" ? "#3D3328"
    : "transparent";

  return (
    <svg width="8" height="8" viewBox="0 0 8 8">
      <circle cx="4" cy="4" r="3.5" fill={fill} stroke={color} strokeWidth="1" />
    </svg>
  );
}

// ── Session detail row ────────────────────────────────────────────

function SessionRow({ session }: { session: FitnessSessionRow }) {
  const exercises = (session.prescribed_exercises ?? []) as unknown as PlanExercise[];
  const day       = DAY_NAMES[session.day_of_week] ?? "";
  const typeIcon  = session.session_type === "gym" ? "🏋️" : "🏃";
  const done      = session.status === "completed";
  const skipped   = session.status === "skipped";

  return (
    <div className="px-4 py-2.5">
      <div className="flex items-center gap-2 mb-1">
        <span className="text-[11px]">{typeIcon}</span>
        <span
          className="text-[11px] font-medium"
          style={{ color: done ? FITNESS_GREEN : skipped ? "#6B5C4A" : "#A89880" }}
        >
          {day}
          {(session as unknown as { title?: string }).title ? ` — ${(session as unknown as { title?: string }).title}` : ""}
        </span>
        <span className="text-[10px] ml-auto" style={{ color: "#6B5C4A" }}>
          {session.scheduled_date}
        </span>
      </div>

      {exercises.length > 0 && (
        <div className="space-y-0.5 pl-4">
          {exercises.slice(0, 4).map((ex, i) => (
            <p key={i} className="text-[10px] truncate" style={{ color: "#4A3F32" }}>
              {ex.name}
              {ex.sets && ex.reps ? ` · ${ex.sets}×${ex.reps}` : ""}
            </p>
          ))}
          {exercises.length > 4 && (
            <p className="text-[10px]" style={{ color: "#3D3328" }}>
              +{exercises.length - 4} more
            </p>
          )}
        </div>
      )}

      {session.actual_notes && (
        <p className="text-[10px] italic mt-1 pl-4" style={{ color: "#6B5C4A" }}>
          &ldquo;{session.actual_notes}&rdquo;
        </p>
      )}
    </div>
  );
}

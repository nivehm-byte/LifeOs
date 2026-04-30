"use client";

import { useState } from "react";
import { PlanHeader }       from "./PlanHeader";
import { TodaySessionCard } from "./TodaySessionCard";
import { WeekProgression }  from "./WeekProgression";
import { AdjustmentLog }    from "./AdjustmentLog";
import type { PlanWithSessions, FitnessSessionRow } from "@/lib/fitness/queries";

const FITNESS_GREEN = "#7DB87A";

interface Props {
  data:  PlanWithSessions | null;
  today: string;
}

export function FitnessDashboard({ data, today }: Props) {
  // Hooks must be called unconditionally — guard renders after
  const [sessions, setSessions] = useState<FitnessSessionRow[]>(data?.sessions ?? []);

  if (!data) return <EmptyState />;

  const { plan, planData } = data;

  // ── Derived values ─────────────────────────────────────────────
  const currentWeek  = computeCurrentWeek(plan.start_date, today, planData.meta.total_weeks);
  const todaySession = sessions.find((s) => s.scheduled_date === today) ?? null;
  const total        = sessions.length;
  const completed    = sessions.filter((s) => s.status === "completed").length;
  const skipped      = sessions.filter((s) => s.status === "skipped").length;
  const thisWeek     = sessions.filter((s) => s.week_number === currentWeek);
  const weekDone     = thisWeek.filter((s) => s.status === "completed").length;
  const adjustments  = planData.meta.adjustments ?? [];

  // ── Session update handler (called after PATCH) ────────────────
  function handleSessionUpdated(updated: FitnessSessionRow) {
    setSessions((prev) =>
      prev.map((s) => (s.id === updated.id ? updated : s))
    );
  }

  return (
    <div className="space-y-5">
      {/* ── Plan overview ─────────────────────────────────────────── */}
      <PlanHeader
        plan={plan}
        planData={planData}
        completed={completed}
        total={total}
        currentWeek={currentWeek}
      />

      {/* ── Today's session ────────────────────────────────────────── */}
      <TodaySessionCard
        session={todaySession}
        onUpdated={handleSessionUpdated}
      />

      {/* ── Quick stats row ─────────────────────────────────────────── */}
      <div className="grid grid-cols-3 gap-3">
        <StatCard
          label="Sessions done"
          value={completed}
          total={total}
          color={FITNESS_GREEN}
        />
        <StatCard
          label="This week"
          value={weekDone}
          total={thisWeek.length}
          color="#D4A96A"
        />
        <StatCard
          label="Skipped"
          value={skipped}
          total={total}
          color="#6B5C4A"
        />
      </div>

      {/* ── Week progression ─────────────────────────────────────────── */}
      <WeekProgression
        weeks={planData.weeks}
        sessions={sessions}
        currentWeek={currentWeek}
      />

      {/* ── Adjustment log ─────────────────────────────────────────────── */}
      <AdjustmentLog entries={adjustments} />
    </div>
  );
}

// ── Helpers ───────────────────────────────────────────────────────

function computeCurrentWeek(startDate: string | null, today: string, totalWeeks: number): number {
  if (!startDate) return 1;
  const start    = new Date(startDate + "T00:00:00");
  const now      = new Date(today   + "T00:00:00");
  const diffDays = Math.floor((now.getTime() - start.getTime()) / 86_400_000);
  if (diffDays < 0) return 1;
  return Math.min(Math.floor(diffDays / 7) + 1, totalWeeks);
}

// ── Stat card ─────────────────────────────────────────────────────

function StatCard({
  label, value, total, color,
}: { label: string; value: number; total: number; color: string }) {
  return (
    <div
      className="rounded-xl px-3 py-3 flex flex-col gap-1"
      style={{ backgroundColor: "#1A1510", border: "1px solid #241E17" }}
    >
      <span
        className="text-xl font-bold tabular-nums leading-none"
        style={{ color }}
      >
        {value}
      </span>
      <span className="text-[10px] leading-tight" style={{ color: "#6B5C4A" }}>
        {label}
      </span>
      <div
        className="h-1 w-full rounded-full overflow-hidden mt-1"
        style={{ backgroundColor: "#241E17" }}
      >
        <div
          className="h-full rounded-full"
          style={{
            width: total > 0 ? `${Math.round((value / total) * 100)}%` : "0%",
            backgroundColor: color,
          }}
        />
      </div>
    </div>
  );
}

// ── Empty state ───────────────────────────────────────────────────

function EmptyState() {
  return (
    <div className="space-y-5">
      <h1 className="font-heading text-2xl text-text-primary">Fitness</h1>
      <div
        className="rounded-2xl px-6 py-12 flex flex-col items-center gap-4 text-center"
        style={{ backgroundColor: "#1A1510", border: "1px dashed #241E17" }}
      >
        <span className="text-4xl">🏋️</span>
        <div>
          <p className="font-medium text-text-primary mb-1">No active plan</p>
          <p className="text-sm" style={{ color: "#6B5C4A" }}>
            Upload a training plan via Telegram or the API to get started.
          </p>
        </div>
        <div
          className="text-left w-full max-w-xs rounded-xl px-4 py-3 space-y-1"
          style={{ backgroundColor: "#13110E", border: "1px solid #1E1A14" }}
        >
          <p className="text-[10px] font-semibold tracking-widest uppercase" style={{ color: "#6B5C4A" }}>
            Telegram command
          </p>
          <p className="text-xs font-mono" style={{ color: "#A89880" }}>
            Upload your plan file and say: &ldquo;parse this as my fitness plan starting 1 May&rdquo;
          </p>
        </div>
      </div>
    </div>
  );
}

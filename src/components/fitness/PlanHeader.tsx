"use client";

import type { FitnessPlanRow }    from "@/lib/fitness/queries";
import type { FitnessPlanData }   from "@/lib/fitness/types";

const FITNESS_GREEN = "#7DB87A";

interface Props {
  plan:        FitnessPlanRow;
  planData:    FitnessPlanData;
  completed:   number;
  total:       number;
  currentWeek: number;
}

export function PlanHeader({ plan, planData, completed, total, currentWeek }: Props) {
  const pct     = total > 0 ? Math.round((completed / total) * 100) : 0;
  const start   = formatDate(plan.start_date);
  const end     = formatDate(plan.end_date);
  const totalWk = planData.meta.total_weeks;

  return (
    <div
      className="rounded-2xl px-5 py-4 space-y-3"
      style={{ backgroundColor: "#1A1510", border: "1px solid #241E17" }}
    >
      {/* Title + status */}
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="font-heading text-xl text-text-primary leading-snug truncate">
            {plan.title}
          </h1>
          {planData.meta.goal && (
            <p className="text-xs mt-0.5 truncate" style={{ color: "#6B5C4A" }}>
              {planData.meta.goal}
            </p>
          )}
        </div>
        <span
          className="shrink-0 text-[10px] font-semibold tracking-widest uppercase px-2.5 py-1 rounded-full"
          style={{ backgroundColor: `${FITNESS_GREEN}20`, color: FITNESS_GREEN }}
        >
          Active
        </span>
      </div>

      {/* Dates + week badge */}
      <div className="flex items-center gap-3 flex-wrap">
        <span className="text-xs" style={{ color: "#6B5C4A" }}>
          {start} – {end}
        </span>
        <span
          className="text-xs font-semibold px-2 py-0.5 rounded-full"
          style={{ backgroundColor: "#241E17", color: "#D4A96A" }}
        >
          Week {currentWeek} of {totalWk}
        </span>
        <span className="text-xs" style={{ color: "#6B5C4A" }}>
          {planData.meta.sessions_per_week}×/wk
        </span>
      </div>

      {/* Progress bar */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-medium" style={{ color: "#A89880" }}>
            {completed} / {total} sessions
          </span>
          <span className="text-[11px] font-semibold tabular-nums" style={{ color: FITNESS_GREEN }}>
            {pct}%
          </span>
        </div>
        <div
          className="h-1.5 w-full rounded-full overflow-hidden"
          style={{ backgroundColor: "#241E17" }}
        >
          <div
            className="h-full rounded-full transition-all duration-500"
            style={{ width: `${pct}%`, backgroundColor: FITNESS_GREEN }}
          />
        </div>
      </div>
    </div>
  );
}

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso + "T00:00:00").toLocaleDateString("en-ZA", {
    day: "numeric", month: "short", year: "numeric",
  });
}

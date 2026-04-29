import { createServiceClient } from "@/lib/supabase/server";
import type { FitnessPlanData } from "./types";
import type { Database } from "@/types/database";

type SessionInsert = Database["public"]["Tables"]["fitness_sessions"]["Insert"];

/**
 * Calculate the calendar date for a plan session.
 *
 * Convention: start_date is the anchor date for week 1.
 * We back up to the Sunday of start_date's calendar week, then
 * advance by (week_number - 1) full weeks + day_of_week days.
 *
 * Example: start_date = Wednesday 2026-05-06
 *   → Sunday of that week = 2026-05-03
 *   → Week 1, Monday (day 1) = 2026-05-04
 *   → Week 2, Monday (day 1) = 2026-05-11
 */
export function calcScheduledDate(
  startDate: string,
  weekNumber: number,
  dayOfWeek: number
): string {
  const start = new Date(startDate);
  const startDayJs = start.getDay(); // 0 = Sunday
  const sunday = new Date(start);
  sunday.setDate(start.getDate() - startDayJs);
  const target = new Date(sunday);
  target.setDate(sunday.getDate() + (weekNumber - 1) * 7 + dayOfWeek);
  return target.toISOString().split("T")[0];
}

/**
 * Replace all non-completed sessions for a plan with sessions derived from
 * the current structured plan data. Safe to call after every upload or adjustment.
 *
 * Completed sessions are preserved so historical data isn't lost.
 */
export async function syncSessionsFromPlan(
  planId: string,
  startDate: string,
  planData: FitnessPlanData
): Promise<void> {
  const supabase = createServiceClient();

  // Remove upcoming + skipped sessions — keep completed ones
  const { error: delError } = await supabase
    .from("fitness_sessions")
    .delete()
    .eq("plan_id", planId)
    .neq("status", "completed");

  if (delError) throw new Error(`syncSessionsFromPlan delete: ${delError.message}`);

  const inserts: SessionInsert[] = [];

  for (const week of planData.weeks) {
    for (const session of week.sessions) {
      inserts.push({
        plan_id: planId,
        week_number: week.week_number,
        day_of_week: session.day_of_week,
        session_type: session.session_type,
        prescribed_exercises: session.exercises as unknown as Record<string, unknown>,
        status: "upcoming",
        scheduled_date: calcScheduledDate(
          startDate,
          week.week_number,
          session.day_of_week
        ),
      });
    }
  }

  if (inserts.length === 0) return;

  const { error: insError } = await supabase
    .from("fitness_sessions")
    .insert(inserts);

  if (insError) throw new Error(`syncSessionsFromPlan insert: ${insError.message}`);
}

/**
 * Render the plan as a readable markdown string for Telegram responses
 * and updated-document generation.
 */
export function renderPlanMarkdown(
  plan: FitnessPlanData,
  startDate: string
): string {
  const lines: string[] = [
    `*${plan.meta.title}*`,
    `${plan.meta.total_weeks} weeks · ${plan.meta.sessions_per_week} sessions/week`,
    plan.meta.goal ? `Goal: ${plan.meta.goal}` : "",
    `Starts: ${startDate}`,
    "",
  ].filter((l) => l !== "");

  for (const week of plan.weeks) {
    const header = week.theme
      ? `*Week ${week.week_number}* — ${week.theme}`
      : `*Week ${week.week_number}*`;
    lines.push(header);

    for (const session of week.sessions) {
      const dayDate = calcScheduledDate(startDate, week.week_number, session.day_of_week);
      const label = session.title
        ? `${session.day_label ?? dayDate} — ${session.title}`
        : `${session.day_label ?? dayDate}`;
      lines.push(`  📅 ${label} (${session.session_type})`);

      for (const ex of session.exercises) {
        const parts: string[] = [`    • ${ex.name}`];
        if (ex.sets && ex.reps) parts.push(`${ex.sets}×${ex.reps}`);
        else if (ex.sets) parts.push(`${ex.sets} sets`);
        if (ex.distance_km) parts.push(`${ex.distance_km} km`);
        if (ex.duration_min) parts.push(`${ex.duration_min} min`);
        lines.push(parts.join(" "));
      }
    }
    lines.push("");
  }

  return lines.join("\n").trim();
}

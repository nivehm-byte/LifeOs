import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { todayInSAST } from "@/lib/utils/date";
import type { FitnessPlanData } from "@/lib/fitness/types";

/**
 * GET /api/fitness/plans
 *
 * Returns the active fitness plan with today's session (if any),
 * and a count of upcoming sessions this week.
 */
export async function GET(): Promise<NextResponse> {
  try {
    const supabase = createServiceClient();
    const today = todayInSAST();

    const { data: plan, error } = await supabase
      .from("fitness_plans")
      .select()
      .eq("status", "active")
      .maybeSingle();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    if (!plan) {
      return NextResponse.json({ plan: null, today_session: null });
    }

    // Today's session
    const { data: todaySession } = await supabase
      .from("fitness_sessions")
      .select()
      .eq("plan_id", plan.id)
      .eq("scheduled_date", today)
      .maybeSingle();

    // This week's session count (upcoming only)
    const weekEnd = (() => {
      const d = new Date(today);
      d.setDate(d.getDate() + (6 - d.getDay()));
      return d.toISOString().split("T")[0];
    })();

    const { count: weekSessionsLeft } = await supabase
      .from("fitness_sessions")
      .select("id", { count: "exact", head: true })
      .eq("plan_id", plan.id)
      .gte("scheduled_date", today)
      .lte("scheduled_date", weekEnd)
      .eq("status", "upcoming");

    const planData = plan.structured_data as unknown as FitnessPlanData;

    return NextResponse.json({
      plan: {
        id: plan.id,
        title: plan.title,
        start_date: plan.start_date,
        end_date: plan.end_date,
        status: plan.status,
        meta: planData?.meta ?? null,
        total_weeks: planData?.meta?.total_weeks ?? null,
      },
      today_session: todaySession ?? null,
      week_sessions_remaining: weekSessionsLeft ?? 0,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    console.error("[fitness/plans GET]", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

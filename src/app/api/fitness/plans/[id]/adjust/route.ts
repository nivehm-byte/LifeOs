import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { adjustFitnessPlan } from "@/lib/ai/router";
import { syncSessionsFromPlan, renderPlanMarkdown } from "@/lib/fitness/sessions";
import type { FitnessPlanData } from "@/lib/fitness/types";

function calcEndDate(startDate: string, totalWeeks: number): string {
  const d = new Date(startDate);
  d.setDate(d.getDate() + totalWeeks * 7 - 1);
  return d.toISOString().split("T")[0];
}

/**
 * POST /api/fitness/plans/[id]/adjust
 *
 * Body: { instruction: string }
 *
 * Applies a natural-language instruction to the plan via Claude Sonnet,
 * persists the updated structured_data, and re-syncs all upcoming sessions.
 * Returns the updated plan summary and a rendered markdown overview.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
): Promise<NextResponse> {
  try {
    const body = await request.json().catch(() => null);
    const instruction = (body?.instruction as string | null)?.trim();

    if (!instruction) {
      return NextResponse.json({ error: "instruction is required" }, { status: 400 });
    }

    const supabase = createServiceClient();

    // ── Load plan ─────────────────────────────────────────────────
    const { data: plan, error: planErr } = await supabase
      .from("fitness_plans")
      .select()
      .eq("id", params.id)
      .single();

    if (planErr || !plan) {
      return NextResponse.json({ error: "Plan not found" }, { status: 404 });
    }

    const currentPlanData = plan.structured_data as unknown as FitnessPlanData;

    // ── Apply AI adjustment ───────────────────────────────────────
    const result = await adjustFitnessPlan(
      currentPlanData,
      instruction,
      plan.start_date
    );

    const newStartDate = result.new_start_date ?? plan.start_date;
    const newEndDate = calcEndDate(newStartDate, result.plan.meta.total_weeks);

    // ── Persist ───────────────────────────────────────────────────
    const { error: updateErr } = await supabase
      .from("fitness_plans")
      .update({
        structured_data: result.plan as unknown as Record<string, unknown>,
        start_date: newStartDate,
        end_date: newEndDate,
      })
      .eq("id", plan.id);

    if (updateErr) {
      return NextResponse.json(
        { error: `Update failed: ${updateErr.message}` },
        { status: 500 }
      );
    }

    // ── Re-sync sessions ──────────────────────────────────────────
    await syncSessionsFromPlan(plan.id, newStartDate, result.plan);

    const totalSessions = result.plan.weeks.reduce(
      (sum, w) => sum + w.sessions.length,
      0
    );

    return NextResponse.json({
      ok: true,
      plan_id: plan.id,
      summary: result.summary,
      start_date: newStartDate,
      end_date: newEndDate,
      total_sessions: totalSessions,
      markdown: renderPlanMarkdown(result.plan, newStartDate),
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    console.error("[fitness/plans/adjust]", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/types/database";
import type { FitnessPlanData } from "./types";

export type FitnessPlanRow    = Database["public"]["Tables"]["fitness_plans"]["Row"];
export type FitnessSessionRow = Database["public"]["Tables"]["fitness_sessions"]["Row"];

export type PlanWithSessions = {
  plan:     FitnessPlansRow;
  planData: FitnessPlanData;
  sessions: FitnessSessionRow[];
};

// Local alias — avoids TS4082 on the re-export
type FitnessPlansRow = FitnessPlanRow;

// ── Active plan + all its sessions ──────────────────────────────────
export async function getActivePlanWithSessions(): Promise<PlanWithSessions | null> {
  const supabase = createClient();

  const { data: plan, error } = await supabase
    .from("fitness_plans")
    .select("*")
    .eq("status", "active")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error || !plan) return null;

  const { data: sessions } = await supabase
    .from("fitness_sessions")
    .select("*")
    .eq("plan_id", plan.id)
    .order("scheduled_date", { ascending: true });

  return {
    plan:     plan as FitnessPlansRow,
    planData: plan.structured_data as unknown as FitnessPlanData,
    sessions: (sessions ?? []) as FitnessSessionRow[],
  };
}

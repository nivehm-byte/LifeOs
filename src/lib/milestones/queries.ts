import { createClient } from "@/lib/supabase/server";
import { todayInSAST } from "@/lib/utils/date";
import type { Database } from "@/types/database";
import type {
  CreateMilestoneInput,
  UpdateMilestoneInput,
  MilestoneFilters,
  ReorderInput,
} from "@/lib/projects/schema";

type MilestoneRow = Database["public"]["Tables"]["milestones"]["Row"];
type ProjectRow   = Database["public"]["Tables"]["projects"]["Row"];

export type MilestoneWithProject = MilestoneRow & {
  project: Pick<ProjectRow, "id" | "title" | "domain_id">;
};

// ----------------------------------------------------------------
// listMilestones
// ----------------------------------------------------------------
export async function listMilestones(
  filters: MilestoneFilters
): Promise<MilestoneWithProject[]> {
  const supabase = createClient();

  let query = supabase
    .from("milestones")
    .select(`*, project:projects (id, title, domain_id)`)
    .order("sort_order", { ascending: true })
    .order("due_date",   { ascending: true, nullsFirst: false });

  if (filters.project_id) {
    query = query.eq("project_id", filters.project_id);
  }

  if (filters.status?.length === 1) {
    query = query.eq("status", filters.status[0]);
  } else if (filters.status && filters.status.length > 1) {
    query = query.in("status", filters.status);
  }

  if (filters.due_from) query = query.gte("due_date", filters.due_from);
  if (filters.due_to)   query = query.lte("due_date", filters.due_to);

  if (filters.overdue) {
    const today = todayInSAST();
    query = query
      .lt("due_date", today)
      .not("status", "in", "(completed)");
  }

  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return (data ?? []) as unknown as MilestoneWithProject[];
}

// ----------------------------------------------------------------
// getMilestoneById
// ----------------------------------------------------------------
export async function getMilestoneById(
  id: string
): Promise<MilestoneWithProject | null> {
  const supabase = createClient();

  const { data, error } = await supabase
    .from("milestones")
    .select(`*, project:projects (id, title, domain_id)`)
    .eq("id", id)
    .single();

  if (error) {
    if (error.code === "PGRST116") return null;
    throw new Error(error.message);
  }

  return data as unknown as MilestoneWithProject;
}

// ----------------------------------------------------------------
// createMilestone
// sort_order defaults to one past the current max for that project.
// ----------------------------------------------------------------
export async function createMilestone(
  input: CreateMilestoneInput
): Promise<MilestoneWithProject> {
  const supabase = createClient();

  // Derive next sort_order if not provided
  let sort_order = input.sort_order;
  if (sort_order === undefined) {
    const { data: last } = await supabase
      .from("milestones")
      .select("sort_order")
      .eq("project_id", input.project_id)
      .order("sort_order", { ascending: false })
      .limit(1)
      .maybeSingle();

    sort_order = last ? last.sort_order + 1 : 0;
  }

  const { data, error } = await supabase
    .from("milestones")
    .insert({ ...input, sort_order })
    .select(`*, project:projects (id, title, domain_id)`)
    .single();

  if (error) throw new Error(error.message);
  return data as unknown as MilestoneWithProject;
}

// ----------------------------------------------------------------
// updateMilestone
// ----------------------------------------------------------------
export async function updateMilestone(
  id: string,
  input: UpdateMilestoneInput
): Promise<MilestoneWithProject> {
  const supabase = createClient();

  const { data, error } = await supabase
    .from("milestones")
    .update(input)
    .eq("id", id)
    .select(`*, project:projects (id, title, domain_id)`)
    .single();

  if (error) {
    if (error.code === "PGRST116") throw new Error("Milestone not found");
    throw new Error(error.message);
  }

  return data as unknown as MilestoneWithProject;
}

// ----------------------------------------------------------------
// deleteMilestone — deliverables cascade in the DB
// ----------------------------------------------------------------
export async function deleteMilestone(id: string): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase.from("milestones").delete().eq("id", id);
  if (error) throw new Error(error.message);
}

// ----------------------------------------------------------------
// reorderMilestones
// Applies an ordered list of { id, sort_order } patches.
// Each is a separate update — PostgREST has no batch UPDATE, and
// for a single-user app the round-trips are negligible.
// ----------------------------------------------------------------
export async function reorderMilestones(
  items: ReorderInput["order"]
): Promise<void> {
  const supabase = createClient();

  const updates = items.map(({ id, sort_order }) =>
    supabase
      .from("milestones")
      .update({ sort_order })
      .eq("id", id)
  );

  const results = await Promise.all(updates);
  const failed  = results.find((r) => r.error);
  if (failed?.error) throw new Error(failed.error.message);
}

// ----------------------------------------------------------------
// syncOverdueStatuses
// Marks any milestone with due_date < today and a non-terminal
// status as "overdue". Called by the briefing cron before generation.
// ----------------------------------------------------------------
export async function syncOverdueStatuses(projectId?: string): Promise<void> {
  const supabase = createClient();
  const today    = todayInSAST();

  let query = supabase
    .from("milestones")
    .update({ status: "overdue" })
    .lt("due_date", today)
    .in("status", ["upcoming", "in-progress"]);

  if (projectId) {
    query = query.eq("project_id", projectId);
  }

  const { error } = await query;
  if (error) throw new Error(error.message);
}

// ----------------------------------------------------------------
// getMilestonesForProject — convenience wrapper used by the
// nested API route /api/projects/[id]/milestones
// ----------------------------------------------------------------
export async function getMilestonesForProject(
  projectId: string
): Promise<MilestoneRow[]> {
  const supabase = createClient();

  const { data, error } = await supabase
    .from("milestones")
    .select("*")
    .eq("project_id", projectId)
    .order("sort_order", { ascending: true });

  if (error) throw new Error(error.message);
  return data ?? [];
}

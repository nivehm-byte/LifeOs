import { createClient } from "@/lib/supabase/server";
import { todayInSAST } from "@/lib/utils/date";
import type { CreateTaskInput, TaskFilters, UpdateTaskInput } from "./schema";
import type { Database } from "@/types/database";

export type TaskRow = Database["public"]["Tables"]["tasks"]["Row"];

// Task row joined with its domain name and colour — used in most views.
export type TaskWithDomain = TaskRow & {
  domain: {
    name: Database["public"]["Tables"]["domains"]["Row"]["name"];
    color: string;
    icon: string;
  };
};

// ----------------------------------------------------------------
// list
// ----------------------------------------------------------------
export async function listTasks(filters: TaskFilters): Promise<TaskWithDomain[]> {
  const supabase = createClient();

  let query = supabase
    .from("tasks")
    .select(`
      *,
      domain:domains (name, color, icon)
    `)
    .order("due_date", { ascending: true, nullsFirst: false })
    .order("priority", { ascending: false }) // urgent > high > medium > low via DB order
    .order("created_at", { ascending: false });

  // ── domain filter ────────────────────────────────────────────
  // domain_id wins over domain name when both are present.
  if (filters.domain_id) {
    query = query.eq("domain_id", filters.domain_id);
  } else if (filters.domain) {
    // Resolve domain name → id via subquery-style filter on the join
    query = query.eq("domain.name" as never, filters.domain);
  }

  // ── project / milestone ──────────────────────────────────────
  if (filters.project_id) {
    query = query.eq("project_id", filters.project_id);
  }
  if (filters.milestone_id) {
    query = query.eq("milestone_id", filters.milestone_id);
  }

  // ── status ───────────────────────────────────────────────────
  if (filters.status?.length === 1) {
    query = query.eq("status", filters.status[0]);
  } else if (filters.status && filters.status.length > 1) {
    query = query.in("status", filters.status);
  }

  // ── priority ─────────────────────────────────────────────────
  if (filters.priority?.length === 1) {
    query = query.eq("priority", filters.priority[0]);
  } else if (filters.priority && filters.priority.length > 1) {
    query = query.in("priority", filters.priority);
  }

  // ── date filters ─────────────────────────────────────────────
  if (filters.due_date) {
    query = query.eq("due_date", filters.due_date);
  } else {
    if (filters.due_from) query = query.gte("due_date", filters.due_from);
    if (filters.due_to)   query = query.lte("due_date", filters.due_to);
  }

  // ── overdue shorthand ─────────────────────────────────────────
  // due_date is before today, task is not done or cancelled.
  if (filters.overdue) {
    const today = todayInSAST();
    query = query
      .lt("due_date", today)
      .not("status", "in", `(completed,cancelled)`);
  }

  // ── pagination ───────────────────────────────────────────────
  query = query.range(filters.offset, filters.offset + filters.limit - 1);

  const { data, error } = await query;

  if (error) throw new Error(error.message);
  return (data ?? []) as TaskWithDomain[];
}

// ----------------------------------------------------------------
// getById
// ----------------------------------------------------------------
export async function getTaskById(id: string): Promise<TaskWithDomain | null> {
  const supabase = createClient();

  const { data, error } = await supabase
    .from("tasks")
    .select(`*, domain:domains (name, color, icon)`)
    .eq("id", id)
    .single();

  if (error) {
    if (error.code === "PGRST116") return null; // not found
    throw new Error(error.message);
  }

  return data as TaskWithDomain;
}

// ----------------------------------------------------------------
// create
// user_id is pulled from the authenticated session — never trusted
// from the request body.
// ----------------------------------------------------------------
export async function createTask(input: CreateTaskInput): Promise<TaskWithDomain> {
  const supabase = createClient();

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) throw new Error("Not authenticated");

  const { data, error } = await supabase
    .from("tasks")
    .insert({
      ...input,
      user_id: user.id,
    })
    .select(`*, domain:domains (name, color, icon)`)
    .single();

  if (error) throw new Error(error.message);
  return data as TaskWithDomain;
}

// ----------------------------------------------------------------
// update
// ----------------------------------------------------------------
export async function updateTask(
  id: string,
  input: UpdateTaskInput
): Promise<TaskWithDomain> {
  const supabase = createClient();

  const { data, error } = await supabase
    .from("tasks")
    .update(input)
    .eq("id", id)
    .select(`*, domain:domains (name, color, icon)`)
    .single();

  if (error) {
    if (error.code === "PGRST116") throw new Error("Task not found");
    throw new Error(error.message);
  }

  return data as TaskWithDomain;
}

// ----------------------------------------------------------------
// remove
// ----------------------------------------------------------------
export async function deleteTask(id: string): Promise<void> {
  const supabase = createClient();

  const { error } = await supabase.from("tasks").delete().eq("id", id);

  if (error) throw new Error(error.message);
}

// ----------------------------------------------------------------
// getTodayTasks
// Convenience: tasks due today + overdue — used by the briefing.
// ----------------------------------------------------------------
export async function getTodayTasks(): Promise<TaskWithDomain[]> {
  const supabase = createClient();
  const today = todayInSAST();

  const { data, error } = await supabase
    .from("tasks")
    .select(`*, domain:domains (name, color, icon)`)
    .lte("due_date", today)
    .not("status", "in", "(completed,cancelled)")
    .order("escalation_count", { ascending: false })
    .order("priority",         { ascending: false })
    .order("due_date",         { ascending: true });

  if (error) throw new Error(error.message);
  return (data ?? []) as TaskWithDomain[];
}

// ----------------------------------------------------------------
// getUpcomingTasks
// Tasks due in the next N days — used by the briefing's upcoming section.
// ----------------------------------------------------------------
export async function getUpcomingTasks(
  days: number = 7
): Promise<TaskWithDomain[]> {
  const supabase = createClient();
  const today = todayInSAST();

  // tomorrow through today+days
  const from = new Date(today);
  from.setDate(from.getDate() + 1);
  const to = new Date(today);
  to.setDate(to.getDate() + days);

  const { data, error } = await supabase
    .from("tasks")
    .select(`*, domain:domains (name, color, icon)`)
    .gte("due_date", from.toISOString().split("T")[0])
    .lte("due_date", to.toISOString().split("T")[0])
    .not("status", "in", "(completed,cancelled)")
    .order("due_date", { ascending: true })
    .order("priority",  { ascending: false })
    .limit(20);

  if (error) throw new Error(error.message);
  return (data ?? []) as TaskWithDomain[];
}

import { createClient } from "@/lib/supabase/server";
import { todayInSAST } from "@/lib/utils/date";
import type { Database } from "@/types/database";
import type {
  CreateProjectInput,
  UpdateProjectInput,
  ProjectFilters,
} from "./schema";

type ProjectRow    = Database["public"]["Tables"]["projects"]["Row"];
type MilestoneRow  = Database["public"]["Tables"]["milestones"]["Row"];
type DomainRow     = Database["public"]["Tables"]["domains"]["Row"];
type ClientRow     = Database["public"]["Tables"]["clients"]["Row"];

// Full project with joined relations used in list views
export type ProjectWithMeta = ProjectRow & {
  domain: Pick<DomainRow, "name" | "color" | "icon">;
  client: Pick<ClientRow, "name" | "company"> | null;
  // Summary counts derived from milestones array
  milestones_total:     number;
  milestones_completed: number;
  next_milestone_due:   string | null;
};

// Full project with all milestones — used in the detail view
export type ProjectWithMilestones = ProjectRow & {
  domain:     Pick<DomainRow, "name" | "color" | "icon">;
  client:     Pick<ClientRow, "name" | "company"> | null;
  milestones: MilestoneRow[];
};

// Raw select string reused across queries
const PROJECT_SELECT = `
  *,
  domain:domains (name, color, icon),
  client:clients (name, company)
` as const;

const MILESTONE_SELECT = `
  *,
  milestones (id, status, due_date, sort_order)
` as const;

// ----------------------------------------------------------------
// listProjects
// ----------------------------------------------------------------
export async function listProjects(filters: ProjectFilters): Promise<ProjectWithMeta[]> {
  const supabase = createClient();

  let query = supabase
    .from("projects")
    .select(`${PROJECT_SELECT}, ${MILESTONE_SELECT}`)
    .order("created_at", { ascending: false });

  if (filters.domain_id) {
    query = query.eq("domain_id", filters.domain_id);
  } else if (filters.domain) {
    query = query.eq("domain.name" as never, filters.domain);
  }

  if (filters.client_id) {
    query = query.eq("client_id", filters.client_id);
  }

  if (filters.status?.length === 1) {
    query = query.eq("status", filters.status[0]);
  } else if (filters.status && filters.status.length > 1) {
    query = query.in("status", filters.status);
  }

  query = query.range(filters.offset, filters.offset + filters.limit - 1);

  const { data, error } = await query;
  if (error) throw new Error(error.message);

  // Derive milestone summary from the joined array.
  // Cast to a concrete shape; Supabase's inference for joined selects
  // with computed columns is too complex for TypeScript to resolve inline.
  type RawRow = ProjectRow & {
    domain:     Pick<DomainRow, "name" | "color" | "icon">;
    client:     Pick<ClientRow, "name" | "company"> | null;
    milestones: Pick<MilestoneRow, "id" | "status" | "due_date" | "sort_order">[];
  };

  return (data ?? []).map((raw) => {
    const row        = raw as unknown as RawRow;
    const ms         = row.milestones ?? [];
    const completed  = ms.filter((m) => m.status === "completed");
    const upcoming   = ms
      .filter((m) => m.status !== "completed" && m.due_date)
      .sort((a, b) => (a.due_date! < b.due_date! ? -1 : 1));

    return {
      id:                   row.id,
      user_id:              row.user_id,
      domain_id:            row.domain_id,
      client_id:            row.client_id,
      title:                row.title,
      description:          row.description,
      status:               row.status,
      start_date:           row.start_date,
      target_end_date:      row.target_end_date,
      created_at:           row.created_at,
      updated_at:           row.updated_at,
      domain:               row.domain,
      client:               row.client,
      milestones_total:     ms.length,
      milestones_completed: completed.length,
      next_milestone_due:   upcoming[0]?.due_date ?? null,
    } satisfies ProjectWithMeta;
  });
}

// ----------------------------------------------------------------
// getProjectById — returns full milestones for the detail view
// ----------------------------------------------------------------
export async function getProjectById(id: string): Promise<ProjectWithMilestones | null> {
  const supabase = createClient();

  const { data, error } = await supabase
    .from("projects")
    .select(`
      ${PROJECT_SELECT},
      milestones (*)
    `)
    .eq("id", id)
    .order("sort_order", { referencedTable: "milestones", ascending: true })
    .single();

  if (error) {
    if (error.code === "PGRST116") return null;
    throw new Error(error.message);
  }

  return data as unknown as ProjectWithMilestones;
}

// ----------------------------------------------------------------
// createProject
// ----------------------------------------------------------------
export async function createProject(input: CreateProjectInput): Promise<ProjectWithMilestones> {
  const supabase = createClient();

  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) throw new Error("Not authenticated");

  const { data, error } = await supabase
    .from("projects")
    .insert({ ...input, user_id: user.id })
    .select(`${PROJECT_SELECT}, milestones (*)`)
    .single();

  if (error) throw new Error(error.message);
  return data as unknown as ProjectWithMilestones;
}

// ----------------------------------------------------------------
// updateProject
// ----------------------------------------------------------------
export async function updateProject(
  id: string,
  input: UpdateProjectInput
): Promise<ProjectWithMilestones> {
  const supabase = createClient();

  const { data, error } = await supabase
    .from("projects")
    .update(input)
    .eq("id", id)
    .select(`${PROJECT_SELECT}, milestones (*)`)
    .single();

  if (error) {
    if (error.code === "PGRST116") throw new Error("Project not found");
    throw new Error(error.message);
  }

  return data as unknown as ProjectWithMilestones;
}

// ----------------------------------------------------------------
// deleteProject — milestones and tasks cascade in the DB
// ----------------------------------------------------------------
export async function deleteProject(id: string): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase.from("projects").delete().eq("id", id);
  if (error) throw new Error(error.message);
}

// ----------------------------------------------------------------
// getActiveProjectsSummary
// Used by the daily briefing: active projects with milestone health.
// ----------------------------------------------------------------
export async function getActiveProjectsSummary() {
  const supabase = createClient();
  const today    = todayInSAST();

  const { data, error } = await supabase
    .from("projects")
    .select(`
      id, title, status, domain_id,
      domain:domains (name, color, icon),
      client:clients (name),
      milestones (id, status, due_date)
    `)
    .in("status", ["active", "paused"])
    .order("created_at", { ascending: false })
    .limit(10);

  if (error) throw new Error(error.message);

  type SummaryRaw = {
    id: string;
    title: string;
    status: string;
    domain_id: string;
    domain: { name: string; color: string; icon: string };
    client: { name: string } | null;
    milestones: { id: string; status: string; due_date: string | null }[];
  };

  return (data ?? []).map((raw) => {
    const row = raw as unknown as SummaryRaw;
    const ms  = row.milestones ?? [];
    const overdueMilestones = ms.filter(
      (m) => m.due_date && m.due_date < today && m.status !== "completed"
    );
    const upcoming = ms
      .filter((m) => m.status !== "completed" && m.due_date && m.due_date >= today)
      .sort((a, b) => (a.due_date! < b.due_date! ? -1 : 1));

    return {
      id:                   row.id,
      title:                row.title,
      status:               row.status,
      domain:               row.domain,
      client:               row.client,
      milestones_total:     ms.length,
      milestones_completed: ms.filter((m) => m.status === "completed").length,
      overdue_count:        overdueMilestones.length,
      next_milestone_due:   upcoming[0]?.due_date ?? null,
    };
  });
}

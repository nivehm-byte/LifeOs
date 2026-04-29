import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/types/database";

export type ClientRow      = Database["public"]["Tables"]["clients"]["Row"];
export type ProjectRow     = Database["public"]["Tables"]["projects"]["Row"];
export type MilestoneRow   = Database["public"]["Tables"]["milestones"]["Row"];
export type DeliverableRow = Database["public"]["Tables"]["deliverables"]["Row"];
export type DocumentRow    = Database["public"]["Tables"]["documents"]["Row"];

export type MilestoneWithDeliverables = MilestoneRow & {
  deliverables: DeliverableRow[];
};

export type ProjectWithRelations = ProjectRow & {
  milestones: MilestoneWithDeliverables[];
  documents:  DocumentRow[];
};

export type ClientDetail = ClientRow & {
  projects: ProjectWithRelations[];
};

// ── All clients — ordered by recency within each stage ───────────
export async function getClients(): Promise<ClientRow[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("clients")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return data ?? [];
}

// ── Single client with all nested data ───────────────────────────
// Fetches in parallel and assembles in memory to avoid TypeScript
// inference issues with deeply nested Supabase selects.
export async function getClientById(id: string): Promise<ClientDetail | null> {
  const supabase = createClient();

  const { data: client, error } = await supabase
    .from("clients")
    .select("*")
    .eq("id", id)
    .single();

  if (error) {
    if (error.code === "PGRST116") return null;
    throw new Error(error.message);
  }

  const { data: projectsData } = await supabase
    .from("projects")
    .select("*")
    .eq("client_id", id)
    .order("created_at", { ascending: false });

  const projects = (projectsData ?? []) as ProjectRow[];
  const projectIds = projects.map((p) => p.id);

  const [milestonesRes, documentsRes] = await Promise.all([
    projectIds.length > 0
      ? supabase.from("milestones").select("*").in("project_id", projectIds).order("sort_order")
      : Promise.resolve({ data: [] as MilestoneRow[] }),
    projectIds.length > 0
      ? supabase.from("documents").select("*").in("project_id", projectIds).order("uploaded_at", { ascending: false })
      : Promise.resolve({ data: [] as DocumentRow[] }),
  ]);

  const milestones   = (milestonesRes.data ?? []) as MilestoneRow[];
  const documents    = (documentsRes.data   ?? []) as DocumentRow[];
  const milestoneIds = milestones.map((m) => m.id);

  const deliverablesRes = milestoneIds.length > 0
    ? await supabase.from("deliverables").select("*").in("milestone_id", milestoneIds)
    : { data: [] as DeliverableRow[] };

  const deliverables = (deliverablesRes.data ?? []) as DeliverableRow[];

  const projectsWithRelations: ProjectWithRelations[] = projects.map((project) => ({
    ...project,
    documents: documents.filter((d) => d.project_id === project.id),
    milestones: milestones
      .filter((m) => m.project_id === project.id)
      .map((milestone) => ({
        ...milestone,
        deliverables: deliverables.filter((d) => d.milestone_id === milestone.id),
      })),
  }));

  return { ...client, projects: projectsWithRelations };
}

import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/types/database";
import type { DomainInfo, ProjectInfo, DocumentWithRelations } from "@/lib/documents/tree";

export type { DomainInfo, ProjectInfo, DocumentWithRelations };

type DocumentRow = Database["public"]["Tables"]["documents"]["Row"];
export type ClientInfo = { id: string; name: string };

// ── All documents for the current user ──────────────────────────
// Joins domain and project, then resolves client names in a second
// pass to avoid complex 3-level Supabase TypeScript inference.
export async function getDocuments(): Promise<DocumentWithRelations[]> {
  const supabase = createClient();

  type RawDoc = DocumentRow & {
    domain:  DomainInfo | null;
    project: ProjectInfo | null;
  };

  const { data, error } = await supabase
    .from("documents")
    .select(`
      *,
      domain:domains (id, name, color, icon),
      project:projects (id, title, client_id)
    `)
    .order("uploaded_at", { ascending: false });

  if (error) throw new Error(error.message);
  const rows = (data ?? []) as unknown as RawDoc[];

  // Collect distinct client IDs from consulting projects
  const clientIdSet: Record<string, true> = {};
  for (const r of rows) {
    if (r.project?.client_id) clientIdSet[r.project.client_id] = true;
  }
  const clientIds = Object.keys(clientIdSet);

  const clientMap: Record<string, string> = {};
  if (clientIds.length > 0) {
    const { data: clients } = await supabase
      .from("clients")
      .select("id, name")
      .in("id", clientIds);
    for (const c of clients ?? []) clientMap[c.id] = c.name;
  }

  return rows.map((row) => ({
    ...row,
    domain:      row.domain ?? { id: "", name: "personal", color: "#7BA8C4", icon: "🏠" },
    project:     row.project ?? null,
    client_name: row.project?.client_id ? (clientMap[row.project.client_id] ?? null) : null,
  }));
}

// ── All domains (for upload modal selects) ───────────────────────
export async function getDomains(): Promise<DomainInfo[]> {
  const supabase = createClient();
  const { data } = await supabase
    .from("domains")
    .select("id, name, color, icon")
    .order("sort_order");
  return (data ?? []) as DomainInfo[];
}

// ── Projects for a specific domain ──────────────────────────────
export async function getProjectsForDomain(domainId: string): Promise<ProjectInfo[]> {
  const supabase = createClient();
  const { data } = await supabase
    .from("projects")
    .select("id, title, client_id")
    .eq("domain_id", domainId)
    .in("status", ["active", "paused"])
    .order("title");
  return (data ?? []) as ProjectInfo[];
}


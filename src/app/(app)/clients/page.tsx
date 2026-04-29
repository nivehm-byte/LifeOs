import { createClient }   from "@/lib/supabase/server";
import { getClients }      from "@/lib/clients/queries";
import { ClientKanban }    from "@/components/clients/ClientKanban";

export const dynamic = "force-dynamic";

export default async function ClientsPage() {
  const supabase = createClient();

  const [clients, projectCountsRes] = await Promise.all([
    getClients().catch(() => []),
    supabase
      .from("projects")
      .select("client_id")
      .not("client_id", "is", null),
  ]);

  // Build a map of clientId → project count
  const projectCounts: Record<string, number> = {};
  for (const row of projectCountsRes.data ?? []) {
    if (row.client_id) {
      projectCounts[row.client_id] = (projectCounts[row.client_id] ?? 0) + 1;
    }
  }

  return (
    <ClientKanban
      initialClients={clients}
      projectCounts={projectCounts}
    />
  );
}

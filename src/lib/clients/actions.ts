"use server";

import { revalidatePath, revalidateTag } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { PipelineStage } from "@/types/database";

// ── Stage checklist definitions ──────────────────────────────────
// When a client enters a stage these tasks are auto-created in the
// consulting domain so the user has an immediate action list.
const STAGE_TASKS: Record<
  PipelineStage,
  Array<{ title: string; priority: "low" | "medium" | "high" | "urgent" }>
> = {
  discovery: [
    { title: "Schedule discovery call",       priority: "high"   },
    { title: "Send capability overview",       priority: "medium" },
    { title: "Document client requirements",   priority: "high"   },
    { title: "Assess project feasibility",     priority: "medium" },
  ],
  proposal: [
    { title: "Draft proposal document",        priority: "high"   },
    { title: "Define scope and timeline",      priority: "high"   },
    { title: "Prepare fee schedule",           priority: "medium" },
    { title: "Send proposal to client",        priority: "urgent" },
  ],
  contract: [
    { title: "Finalise contract terms",        priority: "high"   },
    { title: "Send contract for signature",    priority: "urgent" },
    { title: "Collect signed contract",        priority: "urgent" },
    { title: "Issue deposit invoice",          priority: "high"   },
  ],
  active: [
    { title: "Send project kickoff email",     priority: "high"   },
    { title: "Set up project workspace",       priority: "medium" },
    { title: "Schedule kickoff meeting",       priority: "high"   },
    { title: "Create project milestones",      priority: "medium" },
  ],
  delivery: [
    { title: "Prepare final deliverables",     priority: "high"   },
    { title: "Conduct internal quality review", priority: "high"  },
    { title: "Present deliverables to client", priority: "urgent" },
    { title: "Collect client sign-off",        priority: "urgent" },
  ],
  closed: [
    { title: "Send final invoice",             priority: "urgent" },
    { title: "Collect outstanding payment",    priority: "high"   },
    { title: "Request client testimonial",     priority: "medium" },
    { title: "Archive project documents",      priority: "low"    },
  ],
};

function revalidateClients(clientId?: string) {
  revalidateTag("clients");
  revalidatePath("/clients");
  revalidatePath("/today");
  if (clientId) revalidatePath(`/clients/${clientId}`);
}

async function createChecklistTasks(
  clientName: string,
  stage: PipelineStage,
): Promise<void> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;

  const { data: domain } = await supabase
    .from("domains")
    .select("id")
    .eq("user_id", user.id)
    .eq("name", "consulting")
    .single();
  if (!domain) return;

  await supabase.from("tasks").insert(
    STAGE_TASKS[stage].map((t) => ({
      user_id:     user.id,
      domain_id:   domain.id,
      title:       `${t.title} — ${clientName}`,
      priority:    t.priority,
      created_via: "auto" as const,
    })),
  );
}

// ── createClient ─────────────────────────────────────────────────
export async function createClientAction(input: {
  name:    string;
  company: string | null;
  email:   string;
  phone:   string | null;
  notes:   string | null;
}) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const { data, error } = await supabase
    .from("clients")
    .insert({ ...input, user_id: user.id })
    .select("*")
    .single();
  if (error) throw new Error(error.message);

  await createChecklistTasks(input.name, "discovery");
  revalidateClients();
  return data;
}

// ── moveStage — also fires checklist ─────────────────────────────
export async function moveClientStageAction(
  clientId: string,
  newStage:  PipelineStage,
) {
  const supabase = createClient();

  const { data: client, error } = await supabase
    .from("clients")
    .update({ pipeline_stage: newStage, updated_at: new Date().toISOString() })
    .eq("id", clientId)
    .select("name")
    .single();
  if (error) throw new Error(error.message);

  await createChecklistTasks(client.name, newStage);
  revalidateClients(clientId);
}

// ── updateClient ─────────────────────────────────────────────────
export async function updateClientAction(
  clientId: string,
  updates: Partial<{
    name:    string;
    company: string | null;
    email:   string;
    phone:   string | null;
    notes:   string | null;
  }>,
) {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("clients")
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq("id", clientId)
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  revalidateClients(clientId);
  return data;
}

// ── deleteClient ─────────────────────────────────────────────────
export async function deleteClientAction(clientId: string) {
  const supabase = createClient();
  const { error } = await supabase.from("clients").delete().eq("id", clientId);
  if (error) throw new Error(error.message);
  revalidateClients();
}

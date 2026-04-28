"use server";

import { revalidatePath, revalidateTag } from "next/cache";
import {
  createMilestone,
  updateMilestone,
  deleteMilestone,
  reorderMilestones,
} from "./queries";
import {
  createMilestoneSchema,
  updateMilestoneSchema,
  reorderSchema,
} from "@/lib/projects/schema";

function revalidateMilestones(projectId?: string) {
  revalidateTag("milestones");
  revalidatePath("/projects");
  revalidatePath("/today");
  if (projectId) {
    revalidatePath(`/projects/${projectId}`);
  }
}

// ----------------------------------------------------------------
// createMilestone
// ----------------------------------------------------------------
export async function createMilestoneAction(raw: unknown) {
  const input = createMilestoneSchema.parse(raw);
  const milestone = await createMilestone(input);
  revalidateMilestones(input.project_id);
  return milestone;
}

// ----------------------------------------------------------------
// updateMilestone
// ----------------------------------------------------------------
export async function updateMilestoneAction(
  milestoneId: string,
  raw: unknown,
  projectId?: string
) {
  const input = updateMilestoneSchema.parse(raw);
  const milestone = await updateMilestone(milestoneId, input);
  revalidateMilestones(projectId ?? milestone.project_id);
  return milestone;
}

// ----------------------------------------------------------------
// completeMilestone
// Sets status to completed. Does not auto-complete child tasks —
// the user decides whether to carry them forward.
// ----------------------------------------------------------------
export async function completeMilestone(milestoneId: string, projectId?: string) {
  const milestone = await updateMilestone(milestoneId, { status: "completed" });
  revalidateMilestones(projectId ?? milestone.project_id);
  return milestone;
}

// ----------------------------------------------------------------
// reopenMilestone
// Reverts completed/overdue back to in-progress.
// ----------------------------------------------------------------
export async function reopenMilestone(milestoneId: string, projectId?: string) {
  const milestone = await updateMilestone(milestoneId, { status: "in-progress" });
  revalidateMilestones(projectId ?? milestone.project_id);
  return milestone;
}

// ----------------------------------------------------------------
// deleteMilestone
// Deliverables cascade in the DB; tasks have milestone_id set null.
// ----------------------------------------------------------------
export async function deleteMilestoneAction(
  milestoneId: string,
  projectId?: string
) {
  await deleteMilestone(milestoneId);
  revalidateMilestones(projectId);
}

// ----------------------------------------------------------------
// reorderMilestones
// Accepts the full new order as [{ id, sort_order }].
// Called by the drag-and-drop UI in the project detail view.
// ----------------------------------------------------------------
export async function reorderMilestonesAction(raw: unknown, projectId?: string) {
  const { order } = reorderSchema.parse(raw);
  await reorderMilestones(order);
  revalidateMilestones(projectId);
}

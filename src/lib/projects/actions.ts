"use server";

import { revalidatePath, revalidateTag } from "next/cache";
import { z } from "zod";
import {
  createProject,
  updateProject,
  deleteProject,
} from "./queries";
import { createProjectSchema, updateProjectSchema } from "./schema";
import type { ProjectStatus } from "@/types/database";

function revalidateProjects(projectId?: string) {
  revalidatePath("/projects");
  revalidatePath("/today");
  revalidateTag("projects");
  if (projectId) {
    revalidatePath(`/projects/${projectId}`);
  }
}

// ----------------------------------------------------------------
// createProject
// ----------------------------------------------------------------
export async function createProjectAction(
  raw: unknown
) {
  const input = createProjectSchema.parse(raw);
  const project = await createProject(input);
  revalidateProjects();
  return project;
}

// ----------------------------------------------------------------
// updateProject
// ----------------------------------------------------------------
export async function updateProjectAction(
  projectId: string,
  raw: unknown
) {
  const input = updateProjectSchema.parse(raw);
  const project = await updateProject(projectId, input);
  revalidateProjects(projectId);
  return project;
}

// ----------------------------------------------------------------
// changeProjectStatus
// Thin wrapper that makes intent explicit in calling code.
// ----------------------------------------------------------------
const statusSchema = z.enum(["active", "paused", "completed", "archived"]);

export async function changeProjectStatus(
  projectId: string,
  status: ProjectStatus
) {
  statusSchema.parse(status);
  const project = await updateProject(projectId, { status });
  revalidateProjects(projectId);
  return project;
}

// ----------------------------------------------------------------
// archiveProject
// ----------------------------------------------------------------
export async function archiveProject(projectId: string) {
  return changeProjectStatus(projectId, "archived");
}

// ----------------------------------------------------------------
// deleteProject
// Destructive — milestones, tasks, and deliverables cascade.
// ----------------------------------------------------------------
export async function deleteProjectAction(projectId: string) {
  await deleteProject(projectId);
  revalidateProjects();
}

// ----------------------------------------------------------------
// linkClientToProject / unlinkClientFromProject
// For attaching a consulting client after project creation.
// ----------------------------------------------------------------
export async function linkClientToProject(
  projectId: string,
  clientId: string
) {
  z.string().uuid().parse(clientId);
  const project = await updateProject(projectId, { client_id: clientId });
  revalidateProjects(projectId);
  return project;
}

export async function unlinkClientFromProject(projectId: string) {
  const project = await updateProject(projectId, { client_id: null });
  revalidateProjects(projectId);
  return project;
}

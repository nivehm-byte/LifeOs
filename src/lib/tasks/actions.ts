"use server";

import { revalidatePath, revalidateTag } from "next/cache";
import { z } from "zod";
import { createTask, updateTask } from "./queries";
import { createTaskSchema, rescheduleSchema } from "./schema";
import type { Priority } from "@/types/database";

// ----------------------------------------------------------------
// Shared revalidation — call after any mutation so the Today view
// and any cached task lists reflect the change immediately.
// ----------------------------------------------------------------
function revalidateTasks() {
  revalidatePath("/today");
  revalidatePath("/projects");
  revalidateTag("tasks");
}

// ----------------------------------------------------------------
// createTaskAction
// Called from the QuickAdd modal and Telegram bot action handler.
// ----------------------------------------------------------------
export async function createTaskAction(raw: unknown) {
  const input = createTaskSchema.parse(raw);
  const task  = await createTask(input);
  revalidateTasks();
  return task;
}

// ----------------------------------------------------------------
// markTaskComplete
// Sets status → completed, records timestamp.
// Returns the updated task so the client can optimistically commit.
// ----------------------------------------------------------------
export async function markTaskComplete(taskId: string) {
  const task = await updateTask(taskId, {
    status: "completed",
    completed_at: new Date().toISOString(),
  });

  revalidateTasks();
  return task;
}

// ----------------------------------------------------------------
// markTaskIncomplete
// Reopens a completed task (e.g. user un-checks it).
// Clears completed_at and resets status to todo.
// ----------------------------------------------------------------
export async function markTaskIncomplete(taskId: string) {
  const task = await updateTask(taskId, {
    status: "todo",
    completed_at: null,
  });

  revalidateTasks();
  return task;
}

// ----------------------------------------------------------------
// changePriority
// ----------------------------------------------------------------
const prioritySchema = z.enum(["low", "medium", "high", "urgent"]);

export async function changePriority(taskId: string, priority: Priority) {
  prioritySchema.parse(priority);

  const task = await updateTask(taskId, { priority });

  revalidateTasks();
  return task;
}

// ----------------------------------------------------------------
// rescheduleTask
// Updates due_date (required) and optionally due_time.
// Resets escalation_count to 0 — the user has explicitly
// acknowledged the task by rescheduling it.
// ----------------------------------------------------------------
export async function rescheduleTask(
  taskId: string,
  input: { due_date: string; due_time?: string | null }
) {
  const validated = rescheduleSchema.parse(input);

  const task = await updateTask(taskId, {
    due_date: validated.due_date,
    due_time: validated.due_time ?? null,
    escalation_count: 0,
  });

  revalidateTasks();
  return task;
}

// ----------------------------------------------------------------
// cancelTask
// Soft-deletes by marking cancelled rather than hard-deleting,
// preserving history and preventing briefing re-surfacing.
// ----------------------------------------------------------------
export async function cancelTask(taskId: string) {
  const task = await updateTask(taskId, { status: "cancelled" });

  revalidateTasks();
  return task;
}

// ----------------------------------------------------------------
// incrementEscalation
// Called by the daily cron job for each task that was not
// completed and rolled over from the previous day.
// Not user-facing — no revalidation needed (cron runs before briefing).
// ----------------------------------------------------------------
export async function incrementEscalation(
  taskId: string,
  currentCount: number
) {
  return updateTask(taskId, {
    escalation_count: currentCount + 1,
  });
}

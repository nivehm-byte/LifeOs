import { type NextRequest } from "next/server";
import { updateTaskSchema } from "@/lib/tasks/schema";
import { getTaskById, updateTask, deleteTask } from "@/lib/tasks/queries";
import { ok, err, handleError } from "@/lib/utils/api";

type RouteContext = { params: { id: string } };

// ----------------------------------------------------------------
// GET /api/tasks/[id]
// ----------------------------------------------------------------
export async function GET(_req: NextRequest, { params }: RouteContext) {
  try {
    const task = await getTaskById(params.id);
    if (!task) return err("Task not found", 404);
    return ok(task);
  } catch (e) {
    return handleError(e);
  }
}

// ----------------------------------------------------------------
// PATCH /api/tasks/[id]
// Partial update — send only the fields you want to change.
// domain_id can be updated but not set to null.
// ----------------------------------------------------------------
export async function PATCH(request: NextRequest, { params }: RouteContext) {
  try {
    const body = await request.json().catch(() => {
      throw new Error("Invalid JSON body");
    });

    const input = updateTaskSchema.parse(body);

    // Guard: domain_id cannot be explicitly nulled (schema won't allow it
    // but this makes the intent explicit for readers)
    if ("domain_id" in input && !input.domain_id) {
      return err("domain_id cannot be removed from a task", 422);
    }

    const task = await updateTask(params.id, input);
    return ok(task);
  } catch (e) {
    return handleError(e);
  }
}

// ----------------------------------------------------------------
// DELETE /api/tasks/[id]
// ----------------------------------------------------------------
export async function DELETE(_req: NextRequest, { params }: RouteContext) {
  try {
    await deleteTask(params.id);
    return ok({ id: params.id });
  } catch (e) {
    return handleError(e);
  }
}

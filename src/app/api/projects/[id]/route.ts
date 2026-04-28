import { type NextRequest } from "next/server";
import { updateProjectSchema } from "@/lib/projects/schema";
import { getProjectById, updateProject, deleteProject } from "@/lib/projects/queries";
import { ok, err, handleError } from "@/lib/utils/api";

type RouteContext = { params: { id: string } };

// GET /api/projects/:id
// Returns the project with its full milestone list.
export async function GET(_req: NextRequest, { params }: RouteContext) {
  try {
    const project = await getProjectById(params.id);
    if (!project) return err("Project not found", 404);
    return ok(project);
  } catch (e) {
    return handleError(e);
  }
}

// PATCH /api/projects/:id
// Partial update — send only the fields to change.
// domain_id can be changed but not set to null.
export async function PATCH(request: NextRequest, { params }: RouteContext) {
  try {
    const body  = await request.json().catch(() => { throw new Error("Invalid JSON body"); });
    const input = updateProjectSchema.parse(body);

    if ("domain_id" in input && !input.domain_id) {
      return err("domain_id cannot be removed from a project", 422);
    }

    const project = await updateProject(params.id, input);
    return ok(project);
  } catch (e) {
    return handleError(e);
  }
}

// DELETE /api/projects/:id
// Cascades to milestones, deliverables, and tasks (via DB constraints).
export async function DELETE(_req: NextRequest, { params }: RouteContext) {
  try {
    await deleteProject(params.id);
    return ok({ id: params.id });
  } catch (e) {
    return handleError(e);
  }
}

import { type NextRequest } from "next/server";
import { updateMilestoneSchema, reorderSchema } from "@/lib/projects/schema";
import {
  getMilestoneById,
  updateMilestone,
  deleteMilestone,
  reorderMilestones,
} from "@/lib/milestones/queries";
import { ok, err, handleError } from "@/lib/utils/api";

type RouteContext = { params: { id: string } };

// GET /api/milestones/:id
export async function GET(_req: NextRequest, { params }: RouteContext) {
  try {
    const milestone = await getMilestoneById(params.id);
    if (!milestone) return err("Milestone not found", 404);
    return ok(milestone);
  } catch (e) {
    return handleError(e);
  }
}

// PATCH /api/milestones/:id
// Partial update.
// Special body shape { reorder: [{ id, sort_order }] } triggers
// a bulk reorder of siblings instead of a single-field update.
export async function PATCH(request: NextRequest, { params }: RouteContext) {
  try {
    const body = await request.json().catch(() => { throw new Error("Invalid JSON body"); });

    // Reorder mode: body is { order: [{ id, sort_order }] }
    if ("order" in body) {
      const { order } = reorderSchema.parse(body);
      await reorderMilestones(order);
      return ok({ reordered: order.length });
    }

    // Standard field update
    const input = updateMilestoneSchema.parse(body);
    const milestone = await updateMilestone(params.id, input);
    return ok(milestone);
  } catch (e) {
    return handleError(e);
  }
}

// DELETE /api/milestones/:id
export async function DELETE(_req: NextRequest, { params }: RouteContext) {
  try {
    await deleteMilestone(params.id);
    return ok({ id: params.id });
  } catch (e) {
    return handleError(e);
  }
}

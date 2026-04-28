import { type NextRequest } from "next/server";
import { createMilestoneSchema } from "@/lib/projects/schema";
import { getMilestonesForProject } from "@/lib/milestones/queries";
import { createMilestone } from "@/lib/milestones/queries";
import { ok, handleError } from "@/lib/utils/api";

type RouteContext = { params: { id: string } };

// GET /api/projects/:id/milestones
// Returns all milestones for the project ordered by sort_order.
export async function GET(_req: NextRequest, { params }: RouteContext) {
  try {
    const milestones = await getMilestonesForProject(params.id);
    return ok(milestones);
  } catch (e) {
    return handleError(e);
  }
}

// POST /api/projects/:id/milestones
// project_id is taken from the URL — body does not need to include it.
export async function POST(request: NextRequest, { params }: RouteContext) {
  try {
    const body  = await request.json().catch(() => { throw new Error("Invalid JSON body"); });
    const input = createMilestoneSchema.parse({ ...body, project_id: params.id });
    const milestone = await createMilestone(input);
    return ok(milestone, 201);
  } catch (e) {
    return handleError(e);
  }
}

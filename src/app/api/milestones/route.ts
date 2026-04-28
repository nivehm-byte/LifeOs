import { type NextRequest } from "next/server";
import { milestoneFiltersSchema, createMilestoneSchema } from "@/lib/projects/schema";
import { listMilestones, createMilestone } from "@/lib/milestones/queries";
import { ok, handleError } from "@/lib/utils/api";

// GET /api/milestones
// ?project_id=&status=upcoming,in-progress&due_from=&due_to=&overdue=true
export async function GET(request: NextRequest) {
  try {
    const raw       = Object.fromEntries(request.nextUrl.searchParams.entries());
    const filters   = milestoneFiltersSchema.parse(raw);
    const milestones = await listMilestones(filters);
    return ok(milestones);
  } catch (e) {
    return handleError(e);
  }
}

// POST /api/milestones
// Body: CreateMilestoneInput (project_id + title required)
export async function POST(request: NextRequest) {
  try {
    const body  = await request.json().catch(() => { throw new Error("Invalid JSON body"); });
    const input = createMilestoneSchema.parse(body);
    const milestone = await createMilestone(input);
    return ok(milestone, 201);
  } catch (e) {
    return handleError(e);
  }
}

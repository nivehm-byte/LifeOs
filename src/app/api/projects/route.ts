import { type NextRequest } from "next/server";
import { projectFiltersSchema, createProjectSchema } from "@/lib/projects/schema";
import { listProjects, createProject } from "@/lib/projects/queries";
import { ok, handleError } from "@/lib/utils/api";

// GET /api/projects
// ?domain_id=&domain=&client_id=&status=active,paused&limit=&offset=
export async function GET(request: NextRequest) {
  try {
    const raw     = Object.fromEntries(request.nextUrl.searchParams.entries());
    const filters = projectFiltersSchema.parse(raw);
    const projects = await listProjects(filters);
    return ok(projects);
  } catch (e) {
    return handleError(e);
  }
}

// POST /api/projects
// Body: CreateProjectInput (title + domain_id required)
export async function POST(request: NextRequest) {
  try {
    const body  = await request.json().catch(() => { throw new Error("Invalid JSON body"); });
    const input = createProjectSchema.parse(body);
    const project = await createProject(input);
    return ok(project, 201);
  } catch (e) {
    return handleError(e);
  }
}

import { type NextRequest } from "next/server";
import { createTaskSchema, taskFiltersSchema } from "@/lib/tasks/schema";
import { createTask, listTasks } from "@/lib/tasks/queries";
import { ok, handleError } from "@/lib/utils/api";

// ----------------------------------------------------------------
// GET /api/tasks
// Supports: domain_id, domain, project_id, milestone_id, status,
//           priority, due_date, due_from, due_to, overdue,
//           limit, offset
// ----------------------------------------------------------------
export async function GET(request: NextRequest) {
  try {
    const raw = Object.fromEntries(request.nextUrl.searchParams.entries());
    const filters = taskFiltersSchema.parse(raw);
    const tasks = await listTasks(filters);
    return ok(tasks);
  } catch (e) {
    return handleError(e);
  }
}

// ----------------------------------------------------------------
// POST /api/tasks
// Body: CreateTaskInput (domain_id required)
// ----------------------------------------------------------------
export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => {
      throw new Error("Invalid JSON body");
    });

    const input = createTaskSchema.parse(body);
    const task = await createTask(input);
    return ok(task, 201);
  } catch (e) {
    return handleError(e);
  }
}

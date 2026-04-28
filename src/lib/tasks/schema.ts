import { z } from "zod";

// ----------------------------------------------------------------
// Shared field definitions
// ----------------------------------------------------------------
const uuidField = z.string().uuid();
const dateField = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be YYYY-MM-DD");
const timeField = z
  .string()
  .regex(/^\d{2}:\d{2}(:\d{2})?$/, "Time must be HH:MM or HH:MM:SS");

const PRIORITY  = ["low", "medium", "high", "urgent"] as const;
const STATUS    = ["todo", "in-progress", "completed", "cancelled"] as const;
const DOMAIN    = ["fitness", "personal", "consulting", "corporate"] as const;
const VIA       = ["web", "telegram", "calendar", "auto"] as const;

// ----------------------------------------------------------------
// Create
// domain_id is required — tasks must always belong to a domain.
// ----------------------------------------------------------------
export const createTaskSchema = z.object({
  title:            z.string().min(1, "Title is required").max(500),
  domain_id:        uuidField,
  project_id:       uuidField.optional().nullable(),
  milestone_id:     uuidField.optional().nullable(),
  description:      z.string().max(5000).optional().nullable(),
  priority:         z.enum(PRIORITY).default("medium"),
  status:           z.enum(STATUS).default("todo"),
  due_date:         dateField.optional().nullable(),
  due_time:         timeField.optional().nullable(),
  recurrence_rule:  z.string().max(200).optional().nullable(),
  created_via:      z.enum(VIA).default("web"),
});

export type CreateTaskInput = z.infer<typeof createTaskSchema>;

// ----------------------------------------------------------------
// Update — all fields optional, but domain_id cannot be cleared
// ----------------------------------------------------------------
export const updateTaskSchema = z.object({
  title:            z.string().min(1).max(500).optional(),
  domain_id:        uuidField.optional(),         // can move between domains
  project_id:       uuidField.optional().nullable(),
  milestone_id:     uuidField.optional().nullable(),
  description:      z.string().max(5000).optional().nullable(),
  priority:         z.enum(PRIORITY).optional(),
  status:           z.enum(STATUS).optional(),
  due_date:         dateField.optional().nullable(),
  due_time:         timeField.optional().nullable(),
  recurrence_rule:  z.string().max(200).optional().nullable(),
  escalation_count: z.number().int().min(0).optional(),
  completed_at:     z.string().datetime().optional().nullable(),
}).refine(
  (data) => Object.keys(data).length > 0,
  { message: "Update body must contain at least one field" }
);

export type UpdateTaskInput = z.infer<typeof updateTaskSchema>;

// ----------------------------------------------------------------
// Filters (query string → GET /api/tasks)
// ----------------------------------------------------------------
const csvEnum = <T extends string>(values: readonly T[]) =>
  z
    .string()
    .transform((v) => v.split(",").map((s) => s.trim()) as T[])
    .pipe(z.array(z.enum(values as [T, ...T[]])))
    .or(z.enum(values as [T, ...T[]]).transform((v) => [v]));

export const taskFiltersSchema = z.object({
  domain_id:    uuidField.optional(),
  domain:       z.enum(DOMAIN).optional(),          // resolved to domain_id server-side
  project_id:   uuidField.optional(),
  milestone_id: uuidField.optional(),
  status:       csvEnum(STATUS).optional(),
  priority:     csvEnum(PRIORITY).optional(),
  due_date:     dateField.optional(),               // exact date
  due_from:     dateField.optional(),               // inclusive range start
  due_to:       dateField.optional(),               // inclusive range end
  overdue:      z
    .string()
    .transform((v) => v === "true")
    .optional(),
  limit:        z.coerce.number().int().min(1).max(200).default(50),
  offset:       z.coerce.number().int().min(0).default(0),
});

export type TaskFilters = z.infer<typeof taskFiltersSchema>;

// ----------------------------------------------------------------
// Server action inputs (already typed, simpler than full schema)
// ----------------------------------------------------------------
export const rescheduleSchema = z.object({
  due_date: dateField,
  due_time: timeField.optional().nullable(),
});

export type RescheduleInput = z.infer<typeof rescheduleSchema>;

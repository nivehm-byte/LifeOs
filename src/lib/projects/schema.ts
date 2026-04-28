import { z } from "zod";

const uuidField = z.string().uuid();
const dateField = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be YYYY-MM-DD");

const PROJECT_STATUS    = ["active", "paused", "completed", "archived"] as const;
const MILESTONE_STATUS  = ["upcoming", "in-progress", "completed", "overdue"] as const;

// ----------------------------------------------------------------
// Projects
// ----------------------------------------------------------------
export const createProjectSchema = z.object({
  title:           z.string().min(1, "Title is required").max(500),
  domain_id:       uuidField,
  client_id:       uuidField.optional().nullable(),
  description:     z.string().max(5000).optional().nullable(),
  status:          z.enum(PROJECT_STATUS).default("active"),
  start_date:      dateField.optional().nullable(),
  target_end_date: dateField.optional().nullable(),
}).refine(
  (d) => !d.start_date || !d.target_end_date || d.target_end_date >= d.start_date,
  { message: "target_end_date must be on or after start_date", path: ["target_end_date"] }
);

export type CreateProjectInput = z.infer<typeof createProjectSchema>;

export const updateProjectSchema = z.object({
  title:           z.string().min(1).max(500).optional(),
  domain_id:       uuidField.optional(),
  client_id:       uuidField.optional().nullable(),
  description:     z.string().max(5000).optional().nullable(),
  status:          z.enum(PROJECT_STATUS).optional(),
  start_date:      dateField.optional().nullable(),
  target_end_date: dateField.optional().nullable(),
}).refine(
  (d) => Object.keys(d).length > 0,
  { message: "Update body must contain at least one field" }
);

export type UpdateProjectInput = z.infer<typeof updateProjectSchema>;

const csvEnum = <T extends string>(values: readonly T[]) =>
  z
    .string()
    .transform((v) => v.split(",").map((s) => s.trim()) as T[])
    .pipe(z.array(z.enum(values as [T, ...T[]])))
    .or(z.enum(values as [T, ...T[]]).transform((v) => [v]));

export const projectFiltersSchema = z.object({
  domain_id:  uuidField.optional(),
  domain:     z.enum(["fitness", "personal", "consulting", "corporate"]).optional(),
  client_id:  uuidField.optional(),
  status:     csvEnum(PROJECT_STATUS).optional(),
  limit:      z.coerce.number().int().min(1).max(200).default(50),
  offset:     z.coerce.number().int().min(0).default(0),
});

export type ProjectFilters = z.infer<typeof projectFiltersSchema>;

// ----------------------------------------------------------------
// Milestones
// ----------------------------------------------------------------
export const createMilestoneSchema = z.object({
  project_id:  uuidField,
  title:       z.string().min(1, "Title is required").max(500),
  description: z.string().max(5000).optional().nullable(),
  due_date:    dateField.optional().nullable(),
  status:      z.enum(MILESTONE_STATUS).default("upcoming"),
  sort_order:  z.number().int().min(0).optional(),
});

export type CreateMilestoneInput = z.infer<typeof createMilestoneSchema>;

export const updateMilestoneSchema = z.object({
  title:       z.string().min(1).max(500).optional(),
  description: z.string().max(5000).optional().nullable(),
  due_date:    dateField.optional().nullable(),
  status:      z.enum(MILESTONE_STATUS).optional(),
  sort_order:  z.number().int().min(0).optional(),
}).refine(
  (d) => Object.keys(d).length > 0,
  { message: "Update body must contain at least one field" }
);

export type UpdateMilestoneInput = z.infer<typeof updateMilestoneSchema>;

export const milestoneFiltersSchema = z.object({
  project_id: uuidField.optional(),
  status:     csvEnum(MILESTONE_STATUS).optional(),
  due_from:   dateField.optional(),
  due_to:     dateField.optional(),
  overdue:    z.string().transform((v) => v === "true").optional(),
});

export type MilestoneFilters = z.infer<typeof milestoneFiltersSchema>;

export const reorderSchema = z.object({
  // Array of { id, sort_order } pairs
  order: z.array(z.object({ id: uuidField, sort_order: z.number().int().min(0) })).min(1),
});

export type ReorderInput = z.infer<typeof reorderSchema>;

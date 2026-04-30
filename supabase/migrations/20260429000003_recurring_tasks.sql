-- Add recurrence_parent_id to link generated instances back to their template task.
-- ON DELETE CASCADE: deleting the template removes all its instances.

ALTER TABLE public.tasks
  ADD COLUMN recurrence_parent_id uuid REFERENCES public.tasks (id) ON DELETE CASCADE;

CREATE INDEX idx_tasks_recurrence_parent ON public.tasks (recurrence_parent_id)
  WHERE recurrence_parent_id IS NOT NULL;

CREATE INDEX idx_tasks_recurrence_rule ON public.tasks (recurrence_rule)
  WHERE recurrence_rule IS NOT NULL;

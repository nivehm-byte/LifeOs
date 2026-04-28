-- Batch-increment escalation_count for all overdue, non-terminal tasks.
-- Called by the daily cron via the service role (bypasses RLS).
create or replace function increment_overdue_escalation()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  affected integer;
begin
  update tasks
  set
    escalation_count = escalation_count + 1,
    updated_at       = now()
  where
    due_date < current_date
    and status not in ('completed', 'cancelled');

  get diagnostics affected = row_count;
  return affected;
end;
$$;

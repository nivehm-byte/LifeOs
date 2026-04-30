import { createClient }       from "@/lib/supabase/server";
import { todayInSAST }         from "@/lib/utils/date";
import { weekRange }           from "@/lib/utils/calendar";
import { getEventsByRange }    from "@/lib/calendar/queries";
import { listTasks }           from "@/lib/tasks/queries";
import { CalendarView }        from "@/components/calendar/CalendarView";
import type { TaskWithDomain } from "@/lib/tasks/queries";

export const dynamic = "force-dynamic";

export default async function CalendarPage() {
  const today    = todayInSAST();
  const anchor   = new Date(today + "T00:00:00");
  const { from, to } = weekRange(anchor);

  const supabase = createClient();

  const [tasks, events, domainsRes] = await Promise.all([
    listTasks({ due_from: from, due_to: to, limit: 200, offset: 0 }).catch(
      () => [] as TaskWithDomain[]
    ),
    getEventsByRange(from, to).catch(() => []),
    supabase.from("domains").select("*").order("sort_order"),
  ]);

  const domains = domainsRes.data ?? [];

  return (
    <CalendarView
      initialTasks={tasks}
      initialEvents={events}
      domains={domains}
      today={today}
    />
  );
}

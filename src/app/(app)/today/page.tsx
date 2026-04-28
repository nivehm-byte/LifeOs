import { createClient } from "@/lib/supabase/server";
import { getTodayTasks, getUpcomingTasks } from "@/lib/tasks/queries";
import { getTodayEvents, getUpcomingEvents } from "@/lib/calendar/queries";
import { getActiveProjectsSummary } from "@/lib/projects/queries";
import { todayInSAST } from "@/lib/utils/date";
import { DOMAIN_ORDER } from "@/lib/utils/domain";

import { TodayHeader }      from "@/components/briefing/TodayHeader";
import { ScheduleSection }  from "@/components/briefing/ScheduleSection";
import { OverdueBanner }    from "@/components/briefing/OverdueBanner";
import { DomainTaskSection } from "@/components/briefing/DomainTaskSection";
import { UpcomingSection }  from "@/components/briefing/UpcomingSection";
import { ProjectsStatus }   from "@/components/briefing/ProjectsStatus";
import { QuickAddButton }   from "@/components/briefing/QuickAddButton";
import type { TaskWithDomain } from "@/lib/tasks/queries";
import type { Domain } from "@/types/database";

export const dynamic = "force-dynamic";

export default async function TodayPage() {
  const supabase = createClient();
  const today    = todayInSAST();

  // Fetch everything in parallel; degrade gracefully on error
  const [allTasks, upcomingTasks, events, upcomingEvents, projects, domainsRes] =
    await Promise.all([
      getTodayTasks().catch(() => [] as TaskWithDomain[]),
      getUpcomingTasks(7).catch(() => [] as TaskWithDomain[]),
      getTodayEvents().catch(() => []),
      getUpcomingEvents(7).catch(() => []),
      getActiveProjectsSummary().catch(() => []),
      supabase.from("domains").select("*").order("sort_order"),
    ]);

  const domains = domainsRes.data ?? [];

  // Split tasks into overdue vs due-today
  const overdueTasks = allTasks.filter(
    (t) => t.due_date && t.due_date < today
  );
  const todayTasks = allTasks.filter((t) => t.due_date === today);

  // Group today's tasks by domain in canonical order
  const tasksByDomain = DOMAIN_ORDER.reduce<Record<Domain, TaskWithDomain[]>>(
    (acc, d) => {
      acc[d] = todayTasks.filter((t) => t.domain.name === d);
      return acc;
    },
    { fitness: [], personal: [], consulting: [], corporate: [] }
  );

  return (
    <div className="space-y-8">
      <TodayHeader date={today} taskCount={allTasks.length} />

      {/* Schedule */}
      {events.length > 0 && <ScheduleSection events={events} />}

      {/* Overdue — shown at the top when present */}
      {overdueTasks.length > 0 && (
        <OverdueBanner tasks={overdueTasks} />
      )}

      {/* Today's tasks grouped by domain */}
      {DOMAIN_ORDER.map((domain) => {
        const tasks = tasksByDomain[domain];
        if (tasks.length === 0) return null;
        return (
          <DomainTaskSection
            key={domain}
            domain={domain}
            tasks={tasks}
          />
        );
      })}

      {/* Empty today state */}
      {allTasks.length === 0 && events.length === 0 && (
        <div className="py-12 text-center">
          <p className="font-heading text-2xl text-text-primary mb-2">Clear day.</p>
          <p className="text-text-muted text-sm">Nothing due today. Use the + button to capture something.</p>
        </div>
      )}

      {/* Upcoming — next 7 days */}
      {(upcomingTasks.length > 0 || upcomingEvents.length > 0) && (
        <UpcomingSection tasks={upcomingTasks} events={upcomingEvents} today={today} />
      )}

      {/* Active projects status */}
      {projects.length > 0 && <ProjectsStatus projects={projects} />}

      {/* Bottom breathing room above FAB */}
      <div className="h-4" />

      <QuickAddButton domains={domains} />
    </div>
  );
}

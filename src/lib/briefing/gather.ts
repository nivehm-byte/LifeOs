import { createServiceClient } from "@/lib/supabase/server";
import { todayInSAST, addDays } from "@/lib/utils/date";
import type {
  BriefingContent,
  BriefingEvent,
  BriefingTask,
  BriefingProject,
  BriefingTasksSnapshot,
} from "./types";

// Raw shapes returned by Supabase partial selects
type RawEvent = {
  id: string; title: string; start_time: string; end_time: string;
  all_day: boolean; location: string | null;
  domain: { name: string } | null;
};

type RawTask = {
  id: string; title: string; priority: string; due_date: string | null;
  due_time: string | null; escalation_count: number;
  domain: { name: string } | null;
};

type RawProject = {
  id: string; title: string; status: string;
  domain: { name: string } | null;
  client: { name: string } | null;
  milestones: { id: string; status: string; due_date: string | null }[];
};

type RawSession = {
  id: string; session_type: string; week_number: number;
  day_of_week: number; status: string;
  prescribed_exercises: Record<string, unknown>;
};

export async function gatherBriefingData(userId: string): Promise<{
  content:  BriefingContent;
  snapshot: BriefingTasksSnapshot;
}> {
  const supabase  = createServiceClient();
  const today     = todayInSAST();
  const tomorrow  = addDays(today, 1);
  const in7Days   = addDays(today, 7);
  const nowIso    = new Date().toISOString();

  // Fetch events, tasks (3 buckets), projects, and active fitness plan in parallel
  const [
    eventsRes,
    todayTasksRes,
    overdueTasksRes,
    upcomingTasksRes,
    projectsRes,
    activePlanRes,
  ] = await Promise.all([
    supabase
      .from("calendar_events")
      .select("id, title, start_time, end_time, all_day, location, domain:domains(name)")
      .eq("user_id", userId)
      .gte("start_time", `${today}T00:00:00+02:00`)
      .lt( "start_time", `${tomorrow}T00:00:00+02:00`)
      .order("start_time", { ascending: true }),

    supabase
      .from("tasks")
      .select("id, title, priority, due_date, due_time, escalation_count, domain:domains(name)")
      .eq("user_id", userId)
      .eq("due_date", today)
      .not("status", "in", "(completed,cancelled)")
      .order("priority", { ascending: false }),

    supabase
      .from("tasks")
      .select("id, title, priority, due_date, due_time, escalation_count, domain:domains(name)")
      .eq("user_id", userId)
      .lt("due_date", today)
      .not("status", "in", "(completed,cancelled)")
      .order("escalation_count", { ascending: false })
      .order("priority",         { ascending: false }),

    supabase
      .from("tasks")
      .select("id, title, priority, due_date, due_time, escalation_count, domain:domains(name)")
      .eq("user_id", userId)
      .gte("due_date", tomorrow)
      .lte("due_date", in7Days)
      .not("status", "in", "(completed,cancelled)")
      .order("due_date", { ascending: true })
      .order("priority", { ascending: false })
      .limit(30),

    supabase
      .from("projects")
      .select(`
        id, title, status,
        domain:domains(name),
        client:clients(name),
        milestones(id, status, due_date)
      `)
      .eq("user_id", userId)
      .in("status", ["active", "paused"])
      .order("created_at", { ascending: false })
      .limit(10),

    supabase
      .from("fitness_plans")
      .select("id")
      .eq("user_id", userId)
      .eq("status", "active")
      .maybeSingle(),
  ]);

  // Fitness session — depends on the active plan id
  let fitnessSession: RawSession | null = null;
  if (activePlanRes.data?.id) {
    const { data } = await supabase
      .from("fitness_sessions")
      .select("id, session_type, week_number, day_of_week, status, prescribed_exercises")
      .eq("plan_id", activePlanRes.data.id)
      .eq("scheduled_date", today)
      .maybeSingle();
    fitnessSession = data as RawSession | null;
  }

  // ── Shape events ──────────────────────────────────────────────
  const events: BriefingEvent[] = ((eventsRes.data ?? []) as unknown as RawEvent[]).map((e) => ({
    id:         e.id,
    title:      e.title,
    start_time: e.start_time,
    end_time:   e.end_time,
    all_day:    e.all_day,
    location:   e.location,
    domain:     e.domain?.name ?? "personal",
  }));

  // ── Shape task buckets ────────────────────────────────────────
  function shapeTask(t: RawTask): BriefingTask {
    return {
      id:               t.id,
      title:            t.title,
      priority:         t.priority,
      domain:           t.domain?.name ?? "personal",
      due_date:         t.due_date,
      due_time:         t.due_time,
      escalation_count: t.escalation_count,
    };
  }

  const todayTasks    = ((todayTasksRes.data    ?? []) as unknown as RawTask[]).map(shapeTask);
  const overdueTasks  = ((overdueTasksRes.data  ?? []) as unknown as RawTask[]).map(shapeTask);
  const upcomingTasks = ((upcomingTasksRes.data ?? []) as unknown as RawTask[]).map(shapeTask);

  // ── Shape projects ────────────────────────────────────────────
  const projects: BriefingProject[] = ((projectsRes.data ?? []) as unknown as RawProject[]).map((p) => {
    const ms        = p.milestones ?? [];
    const completed = ms.filter((m) => m.status === "completed").length;
    const overdue   = ms.filter((m) => m.due_date && m.due_date < today && m.status !== "completed").length;
    const upcoming  = ms
      .filter((m) => m.status !== "completed" && m.due_date && m.due_date >= today)
      .sort((a, b) => (a.due_date! < b.due_date! ? -1 : 1));

    return {
      id:                   p.id,
      title:                p.title,
      status:               p.status,
      domain:               p.domain?.name ?? "personal",
      client:               p.client?.name ?? null,
      milestones_total:     ms.length,
      milestones_completed: completed,
      overdue_milestones:   overdue,
      next_milestone_due:   upcoming[0]?.due_date ?? null,
    };
  });

  // ── Tasks snapshot (metrics) ──────────────────────────────────
  const allOpenTasks = [...todayTasks, ...overdueTasks, ...upcomingTasks];

  const by_domain: Record<string, number>   = {};
  const by_priority: Record<string, number> = {};
  for (const t of allOpenTasks) {
    by_domain[t.domain]     = (by_domain[t.domain]     ?? 0) + 1;
    by_priority[t.priority] = (by_priority[t.priority] ?? 0) + 1;
  }

  const snapshot: BriefingTasksSnapshot = {
    total_open:  allOpenTasks.length,
    overdue:     overdueTasks.length,
    today:       todayTasks.length,
    upcoming_7d: upcomingTasks.length,
    by_domain,
    by_priority,
  };

  // ── Assemble content ──────────────────────────────────────────
  const content: BriefingContent = {
    date:         today,
    generated_at: nowIso,
    schedule: {
      count:  events.length,
      events,
    },
    tasks: {
      today_count:    todayTasks.length,
      overdue_count:  overdueTasks.length,
      upcoming_count: upcomingTasks.length,
      today:          todayTasks,
      overdue:        overdueTasks,
      upcoming:       upcomingTasks,
    },
    projects: {
      count: projects.length,
      items: projects,
    },
    fitness: {
      session: fitnessSession
        ? {
            id:                   fitnessSession.id,
            session_type:         fitnessSession.session_type,
            week_number:          fitnessSession.week_number,
            day_of_week:          fitnessSession.day_of_week,
            status:               fitnessSession.status,
            prescribed_exercises: fitnessSession.prescribed_exercises,
          }
        : null,
    },
  };

  return { content, snapshot };
}

// Shared types for the daily briefing JSON payload.
// Stored in daily_briefings.content and daily_briefings.tasks_snapshot.

export interface BriefingEvent {
  id:         string;
  title:      string;
  start_time: string;
  end_time:   string;
  all_day:    boolean;
  location:   string | null;
  domain:     string;
}

export interface BriefingTask {
  id:               string;
  title:            string;
  priority:         string;
  domain:           string;
  due_date:         string | null;
  due_time:         string | null;
  escalation_count: number;
}

export interface BriefingProject {
  id:                   string;
  title:                string;
  status:               string;
  domain:               string;
  client:               string | null;
  milestones_total:     number;
  milestones_completed: number;
  overdue_milestones:   number;
  next_milestone_due:   string | null;
}

export interface BriefingFitnessSession {
  id:                   string;
  session_type:         string;
  week_number:          number;
  day_of_week:          number;
  status:               string;
  prescribed_exercises: Record<string, unknown>;
}

export interface BriefingContent {
  date:         string;
  generated_at: string;
  schedule: {
    count:  number;
    events: BriefingEvent[];
  };
  tasks: {
    today_count:    number;
    overdue_count:  number;
    upcoming_count: number;
    today:          BriefingTask[];
    overdue:        BriefingTask[];
    upcoming:       BriefingTask[];
  };
  projects: {
    count: number;
    items: BriefingProject[];
  };
  fitness: {
    session: BriefingFitnessSession | null;
  };
}

export interface BriefingTasksSnapshot {
  total_open:   number;
  overdue:      number;
  today:        number;
  upcoming_7d:  number;
  by_domain:    Record<string, number>;
  by_priority:  Record<string, number>;
}

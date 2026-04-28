export * from "./database";

export interface BriefingContent {
  date: string;
  schedule: ScheduleItem[];
  priorityTasks: BriefingTask[];
  upcoming: UpcomingItem[];
  activeProjects: ProjectStatus[];
  fitnessSession: FitnessSessionSummary | null;
}

export interface ScheduleItem {
  time: string;
  title: string;
  domain: import("./database").Domain;
  icon: string;
}

export interface BriefingTask {
  id: string;
  title: string;
  domain: import("./database").Domain;
  priority: import("./database").Priority;
  dueDate: string | null;
  escalationCount: number;
  completed: boolean;
}

export interface UpcomingItem {
  date: string;
  title: string;
  domain: import("./database").Domain;
}

export interface ProjectStatus {
  id: string;
  title: string;
  domain: import("./database").Domain;
  status: string;
  milestonesCompleted: number;
  milestonesTotal: number;
  nextMilestoneDue: string | null;
}

export interface FitnessSessionSummary {
  type: import("./database").SessionType;
  title: string;
  weekNumber: number;
  totalWeeks: number;
  exercises: string[];
}

export type AIIntent =
  | "create-task"
  | "update-task"
  | "query"
  | "adjust-plan"
  | "status-update"
  | "general";

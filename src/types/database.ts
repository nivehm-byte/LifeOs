// ----------------------------------------------------------------
// Primitive domain types
// ----------------------------------------------------------------
export type Domain            = "fitness" | "personal" | "consulting" | "corporate";
export type Priority          = "low" | "medium" | "high" | "urgent";
export type TaskStatus        = "todo" | "in-progress" | "completed" | "cancelled";
export type ProjectStatus     = "active" | "paused" | "completed" | "archived";
export type MilestoneStatus   = "upcoming" | "in-progress" | "completed" | "overdue";
export type PipelineStage     = "discovery" | "proposal" | "contract" | "active" | "delivery" | "closed";
export type FitnessPlanStatus = "active" | "completed" | "paused";
export type SessionStatus     = "upcoming" | "completed" | "skipped";
export type SessionType       = "gym" | "run";
export type CreatedVia        = "web" | "telegram" | "calendar" | "auto";
export type ExerciseCategory  = "strength" | "cardio" | "mobility";
export type FileType          = "pdf" | "docx" | "md" | "image" | "other";
export type DocumentType      = "proposal" | "contract" | "invoice" | "training-plan" | "deliverable" | "notes" | "other";
export type DeliverableType   = "proposal" | "contract" | "design" | "development" | "report" | "invoice";
export type DeliverableStatus = "draft" | "in-review" | "approved" | "delivered";

// ----------------------------------------------------------------
// Supabase generic table wrapper.
// Adds Relationships: [] so each table satisfies GenericTable.
// ----------------------------------------------------------------
type Tbl<Row extends Record<string, unknown>, Ins extends Record<string, unknown>, Upd extends Record<string, unknown>> = {
  Row: Row;
  Insert: Ins;
  Update: Upd;
  Relationships: [];
};

// ----------------------------------------------------------------
// Row shapes
// ----------------------------------------------------------------
type UsersRow = {
  id: string;
  email: string;
  name: string;
  timezone: string;
  telegram_chat_id: string | null;
  notification_preferences: Record<string, unknown>;
  created_at: string;
  updated_at: string;
};

type DomainsRow = {
  id: string;
  user_id: string;
  name: Domain;
  color: string;
  icon: string;
  sort_order: number;
};

type ClientsRow = {
  id: string;
  user_id: string;
  name: string;
  company: string | null;
  email: string;
  phone: string | null;
  pipeline_stage: PipelineStage;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

type ProjectsRow = {
  id: string;
  user_id: string;
  domain_id: string;
  client_id: string | null;
  title: string;
  description: string | null;
  status: ProjectStatus;
  start_date: string | null;
  target_end_date: string | null;
  created_at: string;
  updated_at: string;
};

type MilestonesRow = {
  id: string;
  project_id: string;
  title: string;
  description: string | null;
  due_date: string | null;
  status: MilestoneStatus;
  sort_order: number;
};

type TasksRow = {
  id: string;
  user_id: string;
  domain_id: string;
  project_id: string | null;
  milestone_id: string | null;
  title: string;
  description: string | null;
  priority: Priority;
  status: TaskStatus;
  due_date: string | null;
  due_time: string | null;
  recurrence_rule: string | null;
  escalation_count: number;
  completed_at: string | null;
  created_at: string;
  created_via: CreatedVia;
};

type DailyBriefingsRow = {
  id: string;
  user_id: string;
  date: string;
  generated_at: string;
  content: Record<string, unknown>;
  summary_text: string;
  tasks_snapshot: Record<string, unknown>;
};

type DocumentsRow = {
  id: string;
  user_id: string;
  domain_id: string;
  project_id: string | null;
  title: string;
  file_type: FileType;
  storage_path: string;
  document_type: DocumentType;
  ai_summary: string | null;
  uploaded_at: string;
  updated_at: string;
};

type CalendarEventsRow = {
  id: string;
  user_id: string;
  domain_id: string;
  google_event_id: string | null;
  title: string;
  description: string | null;
  start_time: string;
  end_time: string;
  all_day: boolean;
  location: string | null;
  source: "lifeos" | "google";
  synced_at: string | null;
};

type GoogleTokensRow = {
  user_id: string;
  access_token: string;
  refresh_token: string;
  token_expiry: string;
  calendar_id: string;
  corporate_event_id: string | null;
  created_at: string;
  updated_at: string;
};

type TelegramMessagesRow = {
  id: string;
  user_id: string;
  chat_id: string;
  message_text: string;
  parsed_intent: string | null;
  parsed_data: Record<string, unknown> | null;
  ai_response: string | null;
  processed_at: string;
};

type FitnessPlansRow = {
  id: string;
  user_id: string;
  title: string;
  start_date: string;
  end_date: string;
  status: FitnessPlanStatus;
  document_url: string | null;
  structured_data: Record<string, unknown>;
  created_at: string;
};

type FitnessSessionsRow = {
  id: string;
  plan_id: string;
  week_number: number;
  day_of_week: number;
  session_type: SessionType;
  prescribed_exercises: Record<string, unknown>;
  status: SessionStatus;
  actual_notes: string | null;
  scheduled_date: string;
};

type FitnessExercisesRow = {
  id: string;
  name: string;
  category: ExerciseCategory;
  equipment: string | null;
  notes: string | null;
};

type ClientProjectsRow = {
  id: string;
  client_id: string;
  title: string;
  description: string | null;
  pipeline_stage: PipelineStage;
  start_date: string | null;
  target_end_date: string | null;
  budget: number | null;
  status: ProjectStatus;
  created_at: string;
  updated_at: string;
};

type PushSubscriptionsRow = {
  id:         string;
  user_id:    string;
  endpoint:   string;
  p256dh:     string;
  auth:       string;
  user_agent: string | null;
  created_at: string;
};

type DeliverablesRow = {
  id: string;
  milestone_id: string;
  title: string;
  type: DeliverableType;
  status: DeliverableStatus;
  document_url: string | null;
  due_date: string | null;
  created_at: string;
  updated_at: string;
};

// ----------------------------------------------------------------
// Database — satisfies Supabase's GenericSchema constraint.
// ----------------------------------------------------------------
export interface Database {
  public: {
    Tables: {
      users: Tbl<
        UsersRow,
        { id: string; email: string; name?: string; timezone?: string; telegram_chat_id?: string | null; notification_preferences?: Record<string, unknown>; created_at?: string; updated_at?: string },
        { email?: string; name?: string; timezone?: string; telegram_chat_id?: string | null; notification_preferences?: Record<string, unknown>; updated_at?: string }
      >;

      domains: Tbl<
        DomainsRow,
        { id?: string; user_id: string; name: Domain; color?: string; icon?: string; sort_order?: number },
        { name?: Domain; color?: string; icon?: string; sort_order?: number }
      >;

      clients: Tbl<
        ClientsRow,
        { id?: string; user_id: string; name: string; company?: string | null; email: string; phone?: string | null; pipeline_stage?: PipelineStage; notes?: string | null; created_at?: string; updated_at?: string },
        { name?: string; company?: string | null; email?: string; phone?: string | null; pipeline_stage?: PipelineStage; notes?: string | null; updated_at?: string }
      >;

      projects: Tbl<
        ProjectsRow,
        { id?: string; user_id: string; domain_id: string; client_id?: string | null; title: string; description?: string | null; status?: ProjectStatus; start_date?: string | null; target_end_date?: string | null; created_at?: string; updated_at?: string },
        { domain_id?: string; client_id?: string | null; title?: string; description?: string | null; status?: ProjectStatus; start_date?: string | null; target_end_date?: string | null; updated_at?: string }
      >;

      milestones: Tbl<
        MilestonesRow,
        { id?: string; project_id: string; title: string; description?: string | null; due_date?: string | null; status?: MilestoneStatus; sort_order?: number },
        { title?: string; description?: string | null; due_date?: string | null; status?: MilestoneStatus; sort_order?: number }
      >;

      tasks: Tbl<
        TasksRow,
        { id?: string; user_id: string; domain_id: string; project_id?: string | null; milestone_id?: string | null; title: string; description?: string | null; priority?: Priority; status?: TaskStatus; due_date?: string | null; due_time?: string | null; recurrence_rule?: string | null; escalation_count?: number; completed_at?: string | null; created_at?: string; created_via?: CreatedVia },
        { domain_id?: string; project_id?: string | null; milestone_id?: string | null; title?: string; description?: string | null; priority?: Priority; status?: TaskStatus; due_date?: string | null; due_time?: string | null; recurrence_rule?: string | null; escalation_count?: number; completed_at?: string | null; created_via?: CreatedVia }
      >;

      daily_briefings: Tbl<
        DailyBriefingsRow,
        { id?: string; user_id: string; date: string; generated_at?: string; content?: Record<string, unknown>; summary_text?: string; tasks_snapshot?: Record<string, unknown> },
        { content?: Record<string, unknown>; summary_text?: string; tasks_snapshot?: Record<string, unknown> }
      >;

      documents: Tbl<
        DocumentsRow,
        { id?: string; user_id: string; domain_id: string; project_id?: string | null; title: string; file_type?: FileType; storage_path: string; document_type?: DocumentType; ai_summary?: string | null; uploaded_at?: string; updated_at?: string },
        { title?: string; file_type?: FileType; storage_path?: string; document_type?: DocumentType; ai_summary?: string | null; updated_at?: string }
      >;

      calendar_events: Tbl<
        CalendarEventsRow,
        { id?: string; user_id: string; domain_id: string; google_event_id?: string | null; title: string; description?: string | null; start_time: string; end_time: string; all_day?: boolean; location?: string | null; source?: "lifeos" | "google"; synced_at?: string | null },
        { google_event_id?: string | null; title?: string; description?: string | null; start_time?: string; end_time?: string; all_day?: boolean; location?: string | null; source?: "lifeos" | "google"; synced_at?: string | null }
      >;

      google_tokens: Tbl<
        GoogleTokensRow,
        { user_id: string; access_token: string; refresh_token: string; token_expiry: string; calendar_id?: string; corporate_event_id?: string | null; created_at?: string; updated_at?: string },
        { access_token?: string; refresh_token?: string; token_expiry?: string; calendar_id?: string; corporate_event_id?: string | null; updated_at?: string }
      >;

      telegram_messages: Tbl<
        TelegramMessagesRow,
        { id?: string; user_id: string; chat_id: string; message_text: string; parsed_intent?: string | null; parsed_data?: Record<string, unknown> | null; ai_response?: string | null; processed_at?: string },
        { parsed_intent?: string | null; parsed_data?: Record<string, unknown> | null; ai_response?: string | null }
      >;

      fitness_plans: Tbl<
        FitnessPlansRow,
        { id?: string; user_id: string; title: string; start_date: string; end_date: string; status?: FitnessPlanStatus; document_url?: string | null; structured_data?: Record<string, unknown>; created_at?: string },
        { title?: string; start_date?: string; end_date?: string; status?: FitnessPlanStatus; document_url?: string | null; structured_data?: Record<string, unknown> }
      >;

      fitness_sessions: Tbl<
        FitnessSessionsRow,
        { id?: string; plan_id: string; week_number: number; day_of_week: number; session_type: SessionType; prescribed_exercises?: Record<string, unknown>; status?: SessionStatus; actual_notes?: string | null; scheduled_date: string },
        { prescribed_exercises?: Record<string, unknown>; status?: SessionStatus; actual_notes?: string | null; scheduled_date?: string }
      >;

      fitness_exercises: Tbl<
        FitnessExercisesRow,
        { id?: string; name: string; category: ExerciseCategory; equipment?: string | null; notes?: string | null },
        { name?: string; category?: ExerciseCategory; equipment?: string | null; notes?: string | null }
      >;

      client_projects: Tbl<
        ClientProjectsRow,
        { id?: string; client_id: string; title: string; description?: string | null; pipeline_stage?: PipelineStage; start_date?: string | null; target_end_date?: string | null; budget?: number | null; status?: ProjectStatus; created_at?: string; updated_at?: string },
        { title?: string; description?: string | null; pipeline_stage?: PipelineStage; start_date?: string | null; target_end_date?: string | null; budget?: number | null; status?: ProjectStatus; updated_at?: string }
      >;

      push_subscriptions: Tbl<
        PushSubscriptionsRow,
        { id?: string; user_id: string; endpoint: string; p256dh: string; auth: string; user_agent?: string | null; created_at?: string },
        { user_agent?: string | null }
      >;

      deliverables: Tbl<
        DeliverablesRow,
        { id?: string; milestone_id: string; title: string; type?: DeliverableType; status?: DeliverableStatus; document_url?: string | null; due_date?: string | null; created_at?: string; updated_at?: string },
        { title?: string; type?: DeliverableType; status?: DeliverableStatus; document_url?: string | null; due_date?: string | null; updated_at?: string }
      >;
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
}

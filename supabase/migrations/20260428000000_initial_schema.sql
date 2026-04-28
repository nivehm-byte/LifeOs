-- =============================================================
-- LifeOS — Initial Schema Migration
-- =============================================================

-- ----------------------------------------------------------------
-- Extensions
-- ----------------------------------------------------------------
create extension if not exists "uuid-ossp";
create extension if not exists "pg_trgm";    -- for future text search on titles/notes


-- ----------------------------------------------------------------
-- updated_at helper
-- Attach to any table with an updated_at column via trigger.
-- ----------------------------------------------------------------
create or replace function public.handle_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;


-- ================================================================
-- USERS
-- Mirrors auth.users; created automatically on first login.
-- ================================================================
create table public.users (
  id                        uuid        primary key references auth.users (id) on delete cascade,
  email                     text        not null unique,
  name                      text        not null default '',
  timezone                  text        not null default 'Africa/Johannesburg',
  telegram_chat_id          text,
  notification_preferences  jsonb       not null default '{}'::jsonb,
  created_at                timestamptz not null default now(),
  updated_at                timestamptz not null default now()
);

create trigger users_updated_at
  before update on public.users
  for each row execute function public.handle_updated_at();


-- ================================================================
-- DOMAINS
-- The four life areas. Pre-seeded per user on signup.
-- ================================================================
create table public.domains (
  id          uuid        primary key default uuid_generate_v4(),
  user_id     uuid        not null references public.users (id) on delete cascade,
  name        text        not null check (name in ('fitness', 'personal', 'consulting', 'corporate')),
  color       text        not null default '#D4A96A',
  icon        text        not null default '●',
  sort_order  int         not null default 0,

  unique (user_id, name)
);


-- ================================================================
-- CLIENTS  (consulting domain)
-- Defined before projects so projects.client_id can reference it.
-- ================================================================
create table public.clients (
  id             uuid        primary key default uuid_generate_v4(),
  user_id        uuid        not null references public.users (id) on delete cascade,
  name           text        not null,
  company        text,
  email          text        not null,
  phone          text,
  pipeline_stage text        not null default 'discovery'
                             check (pipeline_stage in (
                               'discovery', 'proposal', 'contract',
                               'active', 'delivery', 'closed'
                             )),
  notes          text,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

create trigger clients_updated_at
  before update on public.clients
  for each row execute function public.handle_updated_at();


-- ================================================================
-- PROJECTS
-- Generic project container across all domains.
-- Consulting projects carry an optional client_id.
-- ================================================================
create table public.projects (
  id              uuid        primary key default uuid_generate_v4(),
  user_id         uuid        not null references public.users (id) on delete cascade,
  domain_id       uuid        not null references public.domains (id) on delete restrict,
  client_id       uuid        references public.clients (id) on delete set null,
  title           text        not null,
  description     text,
  status          text        not null default 'active'
                              check (status in ('active', 'paused', 'completed', 'archived')),
  start_date      date,
  target_end_date date,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create trigger projects_updated_at
  before update on public.projects
  for each row execute function public.handle_updated_at();


-- ================================================================
-- MILESTONES
-- Checkpoints within a project.
-- ================================================================
create table public.milestones (
  id          uuid        primary key default uuid_generate_v4(),
  project_id  uuid        not null references public.projects (id) on delete cascade,
  title       text        not null,
  description text,
  due_date    date,
  status      text        not null default 'upcoming'
              check (status in ('upcoming', 'in-progress', 'completed', 'overdue')),
  sort_order  int         not null default 0
);


-- ================================================================
-- TASKS
-- The atomic unit. Belongs to a domain; optionally to a project
-- and/or milestone.
-- ================================================================
create table public.tasks (
  id               uuid        primary key default uuid_generate_v4(),
  user_id          uuid        not null references public.users (id) on delete cascade,
  domain_id        uuid        not null references public.domains (id) on delete restrict,
  project_id       uuid        references public.projects (id) on delete set null,
  milestone_id     uuid        references public.milestones (id) on delete set null,
  title            text        not null,
  description      text,
  priority         text        not null default 'medium'
                   check (priority in ('low', 'medium', 'high', 'urgent')),
  status           text        not null default 'todo'
                   check (status in ('todo', 'in-progress', 'completed', 'cancelled')),
  due_date         date,
  due_time         time,
  recurrence_rule  text,                                  -- RRULE format
  escalation_count int         not null default 0,
  completed_at     timestamptz,
  created_at       timestamptz not null default now(),
  created_via      text        not null default 'web'
                   check (created_via in ('web', 'telegram', 'calendar', 'auto'))
);


-- ================================================================
-- DAILY BRIEFINGS
-- One row per day; generated by cron at 05:30 SAST.
-- ================================================================
create table public.daily_briefings (
  id              uuid        primary key default uuid_generate_v4(),
  user_id         uuid        not null references public.users (id) on delete cascade,
  date            date        not null,
  generated_at    timestamptz not null default now(),
  content         jsonb       not null default '{}'::jsonb,   -- structured briefing data
  summary_text    text        not null default '',            -- AI prose summary
  tasks_snapshot  jsonb       not null default '{}'::jsonb,   -- snapshot of tasks at generation time

  unique (user_id, date)
);


-- ================================================================
-- DOCUMENTS
-- Files stored in Supabase Storage; metadata lives here.
-- ================================================================
create table public.documents (
  id             uuid        primary key default uuid_generate_v4(),
  user_id        uuid        not null references public.users (id) on delete cascade,
  domain_id      uuid        not null references public.domains (id) on delete restrict,
  project_id     uuid        references public.projects (id) on delete set null,
  title          text        not null,
  file_type      text        not null default 'other'
                 check (file_type in ('pdf', 'docx', 'md', 'image', 'other')),
  storage_path   text        not null,
  document_type  text        not null default 'other'
                 check (document_type in (
                   'proposal', 'contract', 'invoice',
                   'training-plan', 'deliverable', 'notes', 'other'
                 )),
  ai_summary     text,
  uploaded_at    timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

create trigger documents_updated_at
  before update on public.documents
  for each row execute function public.handle_updated_at();


-- ================================================================
-- CALENDAR EVENTS
-- Synced from / pushed to Google Calendar.
-- ================================================================
create table public.calendar_events (
  id              uuid        primary key default uuid_generate_v4(),
  user_id         uuid        not null references public.users (id) on delete cascade,
  domain_id       uuid        not null references public.domains (id) on delete restrict,
  google_event_id text,                                         -- null for locally-created events
  title           text        not null,
  description     text,
  start_time      timestamptz not null,
  end_time        timestamptz not null,
  all_day         boolean     not null default false,
  location        text,
  synced_at       timestamptz,

  check (end_time >= start_time)
);


-- ================================================================
-- TELEGRAM MESSAGES
-- Audit log of every bot message and its parsed result.
-- ================================================================
create table public.telegram_messages (
  id            uuid        primary key default uuid_generate_v4(),
  user_id       uuid        not null references public.users (id) on delete cascade,
  chat_id       text        not null,
  message_text  text        not null,
  parsed_intent text        check (parsed_intent in (
                              'create-task', 'update-task', 'query',
                              'adjust-plan', 'status-update', 'general'
                            )),
  parsed_data   jsonb,
  ai_response   text,
  processed_at  timestamptz not null default now()
);


-- ================================================================
-- FITNESS PLANS
-- Uploaded training documents parsed into structured data.
-- ================================================================
create table public.fitness_plans (
  id              uuid        primary key default uuid_generate_v4(),
  user_id         uuid        not null references public.users (id) on delete cascade,
  title           text        not null,
  start_date      date        not null,
  end_date        date        not null,
  status          text        not null default 'active'
                  check (status in ('active', 'completed', 'paused')),
  document_url    text,                                          -- Supabase storage URL
  structured_data jsonb       not null default '{}'::jsonb,      -- parsed plan (exercises, weeks)
  created_at      timestamptz not null default now(),

  check (end_date >= start_date)
);


-- ================================================================
-- FITNESS SESSIONS
-- Individual training days derived from the plan.
-- ================================================================
create table public.fitness_sessions (
  id                   uuid   primary key default uuid_generate_v4(),
  plan_id              uuid   not null references public.fitness_plans (id) on delete cascade,
  week_number          int    not null check (week_number >= 1),
  day_of_week          int    not null check (day_of_week between 0 and 6),   -- 0 = Sunday
  session_type         text   not null check (session_type in ('gym', 'run')),
  prescribed_exercises jsonb  not null default '[]'::jsonb,
  status               text   not null default 'upcoming'
                       check (status in ('upcoming', 'completed', 'skipped')),
  actual_notes         text,
  scheduled_date       date   not null
);


-- ================================================================
-- FITNESS EXERCISES
-- Reference pool of known exercises (not per-user).
-- ================================================================
create table public.fitness_exercises (
  id        uuid  primary key default uuid_generate_v4(),
  name      text  not null unique,
  category  text  not null check (category in ('strength', 'cardio', 'mobility')),
  equipment text,
  notes     text
);


-- ================================================================
-- CLIENT PROJECTS  (consulting-specific)
-- More granular than the generic projects table; tracks budget,
-- pipeline stage, and deliverables separately.
-- ================================================================
create table public.client_projects (
  id              uuid        primary key default uuid_generate_v4(),
  client_id       uuid        not null references public.clients (id) on delete cascade,
  title           text        not null,
  description     text,
  pipeline_stage  text        not null default 'discovery'
                  check (pipeline_stage in (
                    'discovery', 'proposal', 'contract',
                    'active', 'delivery', 'closed'
                  )),
  start_date      date,
  target_end_date date,
  budget          numeric(12,2),
  status          text        not null default 'active'
                  check (status in ('active', 'paused', 'completed')),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create trigger client_projects_updated_at
  before update on public.client_projects
  for each row execute function public.handle_updated_at();


-- ================================================================
-- DELIVERABLES  (consulting-specific)
-- Tied to client project milestones.
-- ================================================================
create table public.deliverables (
  id            uuid        primary key default uuid_generate_v4(),
  milestone_id  uuid        not null references public.milestones (id) on delete cascade,
  title         text        not null,
  type          text        not null default 'other'
                check (type in (
                  'proposal', 'contract', 'design',
                  'development', 'report', 'invoice'
                )),
  status        text        not null default 'draft'
                check (status in ('draft', 'in-review', 'approved', 'delivered')),
  document_url  text,
  due_date      date,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create trigger deliverables_updated_at
  before update on public.deliverables
  for each row execute function public.handle_updated_at();


-- ================================================================
-- INDEXES
-- Covering the most common query shapes.
-- ================================================================

-- users
create index idx_users_email on public.users (email);

-- domains
create index idx_domains_user_id     on public.domains (user_id);
create index idx_domains_user_name   on public.domains (user_id, name);

-- clients
create index idx_clients_user_id        on public.clients (user_id);
create index idx_clients_pipeline_stage on public.clients (user_id, pipeline_stage);

-- projects
create index idx_projects_user_id        on public.projects (user_id);
create index idx_projects_domain_id      on public.projects (domain_id);
create index idx_projects_client_id      on public.projects (client_id);
create index idx_projects_status         on public.projects (user_id, status);

-- milestones
create index idx_milestones_project_id on public.milestones (project_id);
create index idx_milestones_due_date   on public.milestones (due_date);
create index idx_milestones_status     on public.milestones (status);

-- tasks  (most heavily queried table)
create index idx_tasks_user_id          on public.tasks (user_id);
create index idx_tasks_domain_id        on public.tasks (domain_id);
create index idx_tasks_project_id       on public.tasks (project_id);
create index idx_tasks_milestone_id     on public.tasks (milestone_id);
create index idx_tasks_due_date         on public.tasks (due_date);
create index idx_tasks_status           on public.tasks (status);
create index idx_tasks_user_due_status  on public.tasks (user_id, due_date, status);   -- briefing query
create index idx_tasks_escalation       on public.tasks (user_id, escalation_count)
  where escalation_count > 0;

-- daily_briefings
create index idx_briefings_user_date on public.daily_briefings (user_id, date desc);

-- documents
create index idx_documents_user_id    on public.documents (user_id);
create index idx_documents_domain_id  on public.documents (domain_id);
create index idx_documents_project_id on public.documents (project_id);
create index idx_documents_type       on public.documents (document_type);

-- calendar_events
create index idx_cal_user_id     on public.calendar_events (user_id);
create index idx_cal_domain_id   on public.calendar_events (domain_id);
create index idx_cal_start_time  on public.calendar_events (user_id, start_time);
create index idx_cal_google_id   on public.calendar_events (google_event_id)
  where google_event_id is not null;

-- telegram_messages
create index idx_telegram_user_id    on public.telegram_messages (user_id);
create index idx_telegram_processed  on public.telegram_messages (processed_at desc);

-- fitness_plans
create index idx_fitness_plans_user_id on public.fitness_plans (user_id);
create index idx_fitness_plans_status  on public.fitness_plans (user_id, status);

-- fitness_sessions
create index idx_fitness_sessions_plan_id        on public.fitness_sessions (plan_id);
create index idx_fitness_sessions_scheduled_date on public.fitness_sessions (scheduled_date);
create index idx_fitness_sessions_status         on public.fitness_sessions (status);

-- client_projects
create index idx_client_projects_client_id      on public.client_projects (client_id);
create index idx_client_projects_pipeline_stage on public.client_projects (pipeline_stage);

-- deliverables
create index idx_deliverables_milestone_id on public.deliverables (milestone_id);
create index idx_deliverables_status       on public.deliverables (status);
create index idx_deliverables_due_date     on public.deliverables (due_date);


-- ================================================================
-- ROW LEVEL SECURITY
-- Single-user app: every row is owned by the authenticated user.
-- auth.uid() must match user_id on all owned tables.
-- ================================================================

alter table public.users             enable row level security;
alter table public.domains           enable row level security;
alter table public.clients           enable row level security;
alter table public.projects          enable row level security;
alter table public.milestones        enable row level security;
alter table public.tasks             enable row level security;
alter table public.daily_briefings   enable row level security;
alter table public.documents         enable row level security;
alter table public.calendar_events   enable row level security;
alter table public.telegram_messages enable row level security;
alter table public.fitness_plans     enable row level security;
alter table public.fitness_sessions  enable row level security;
alter table public.fitness_exercises enable row level security;
alter table public.client_projects   enable row level security;
alter table public.deliverables      enable row level security;


-- ----------------------------------------------------------------
-- Reusable helper: is the caller the owner of a given user_id?
-- Used in policy expressions below.
-- ----------------------------------------------------------------
create or replace function public.is_owner(row_user_id uuid)
returns boolean
language sql
stable
as $$
  select auth.uid() = row_user_id;
$$;


-- ----------------------------------------------------------------
-- users
-- ----------------------------------------------------------------
create policy "users: own row only"
  on public.users
  for all
  using (is_owner(id))
  with check (is_owner(id));


-- ----------------------------------------------------------------
-- domains
-- ----------------------------------------------------------------
create policy "domains: own rows only"
  on public.domains
  for all
  using (is_owner(user_id))
  with check (is_owner(user_id));


-- ----------------------------------------------------------------
-- clients
-- ----------------------------------------------------------------
create policy "clients: own rows only"
  on public.clients
  for all
  using (is_owner(user_id))
  with check (is_owner(user_id));


-- ----------------------------------------------------------------
-- projects
-- ----------------------------------------------------------------
create policy "projects: own rows only"
  on public.projects
  for all
  using (is_owner(user_id))
  with check (is_owner(user_id));


-- ----------------------------------------------------------------
-- milestones
-- Access is inherited from the parent project's user_id.
-- ----------------------------------------------------------------
create policy "milestones: via project ownership"
  on public.milestones
  for all
  using (
    exists (
      select 1 from public.projects p
      where p.id = milestones.project_id
        and is_owner(p.user_id)
    )
  )
  with check (
    exists (
      select 1 from public.projects p
      where p.id = milestones.project_id
        and is_owner(p.user_id)
    )
  );


-- ----------------------------------------------------------------
-- tasks
-- ----------------------------------------------------------------
create policy "tasks: own rows only"
  on public.tasks
  for all
  using (is_owner(user_id))
  with check (is_owner(user_id));


-- ----------------------------------------------------------------
-- daily_briefings
-- ----------------------------------------------------------------
create policy "briefings: own rows only"
  on public.daily_briefings
  for all
  using (is_owner(user_id))
  with check (is_owner(user_id));


-- ----------------------------------------------------------------
-- documents
-- ----------------------------------------------------------------
create policy "documents: own rows only"
  on public.documents
  for all
  using (is_owner(user_id))
  with check (is_owner(user_id));


-- ----------------------------------------------------------------
-- calendar_events
-- ----------------------------------------------------------------
create policy "calendar_events: own rows only"
  on public.calendar_events
  for all
  using (is_owner(user_id))
  with check (is_owner(user_id));


-- ----------------------------------------------------------------
-- telegram_messages
-- ----------------------------------------------------------------
create policy "telegram_messages: own rows only"
  on public.telegram_messages
  for all
  using (is_owner(user_id))
  with check (is_owner(user_id));


-- ----------------------------------------------------------------
-- fitness_plans
-- ----------------------------------------------------------------
create policy "fitness_plans: own rows only"
  on public.fitness_plans
  for all
  using (is_owner(user_id))
  with check (is_owner(user_id));


-- ----------------------------------------------------------------
-- fitness_sessions
-- Access inherited from the parent plan's user_id.
-- ----------------------------------------------------------------
create policy "fitness_sessions: via plan ownership"
  on public.fitness_sessions
  for all
  using (
    exists (
      select 1 from public.fitness_plans fp
      where fp.id = fitness_sessions.plan_id
        and is_owner(fp.user_id)
    )
  )
  with check (
    exists (
      select 1 from public.fitness_plans fp
      where fp.id = fitness_sessions.plan_id
        and is_owner(fp.user_id)
    )
  );


-- ----------------------------------------------------------------
-- fitness_exercises
-- Reference table — any authenticated user can read.
-- Only the service role (cron/AI layer) may write.
-- ----------------------------------------------------------------
create policy "fitness_exercises: authenticated read"
  on public.fitness_exercises
  for select
  using (auth.role() = 'authenticated');


-- ----------------------------------------------------------------
-- client_projects
-- Access inherited from the parent client's user_id.
-- ----------------------------------------------------------------
create policy "client_projects: via client ownership"
  on public.client_projects
  for all
  using (
    exists (
      select 1 from public.clients c
      where c.id = client_projects.client_id
        and is_owner(c.user_id)
    )
  )
  with check (
    exists (
      select 1 from public.clients c
      where c.id = client_projects.client_id
        and is_owner(c.user_id)
    )
  );


-- ----------------------------------------------------------------
-- deliverables
-- Access inherited via milestone → project → user_id.
-- ----------------------------------------------------------------
create policy "deliverables: via milestone ownership"
  on public.deliverables
  for all
  using (
    exists (
      select 1
      from public.milestones m
      join public.projects p on p.id = m.project_id
      where m.id = deliverables.milestone_id
        and is_owner(p.user_id)
    )
  )
  with check (
    exists (
      select 1
      from public.milestones m
      join public.projects p on p.id = m.project_id
      where m.id = deliverables.milestone_id
        and is_owner(p.user_id)
    )
  );


-- ================================================================
-- SEED — Default domains for the first (and only) user.
-- Called from the auth.users on-insert trigger set up in Supabase
-- Dashboard → Database → Functions, or via a serverless function.
--
-- Uncomment and run manually after creating your auth user, or
-- wire it into an on-signup trigger.
-- ================================================================

/*
insert into public.domains (user_id, name, color, icon, sort_order) values
  ('<YOUR_USER_ID>', 'fitness',    '#7DB87A', '🏋️', 0),
  ('<YOUR_USER_ID>', 'personal',   '#7BA8C4', '🏠', 1),
  ('<YOUR_USER_ID>', 'consulting', '#D4845A', '💼', 2),
  ('<YOUR_USER_ID>', 'corporate',  '#9B8EC4', '🏢', 3);
*/

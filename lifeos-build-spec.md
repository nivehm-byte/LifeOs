# LifeOS — Full Build Specification

## Overview

LifeOS is a personal operating system web app for managing four life domains through a single dashboard. Its primary function is generating a daily morning briefing with tasks, schedule, and priorities — and allowing the user to check items off throughout the day.

**Owner:** Niveh (solo user, Durban-based freelance creative + corporate employee)

---

## Core Concept

LifeOS captures, organizes, and surfaces information across four distinct life domains:

1. **Fitness** — gym workouts and running programs
2. **Personal** — social events, chores, errands, life admin
3. **Consulting** — client project management for nivehs.studio
4. **Corporate** — blocked 7:30am–3:30pm, with manually added overflow tasks/events

The app's north star feature is the **Daily Briefing** — an auto-generated morning summary delivered via push notification and rendered as the dashboard's primary view.

---

## Tech Stack

| Layer | Technology | Reason |
|---|---|---|
| Frontend | Next.js 14+ (App Router) | Full-stack, responsive, PWA-capable |
| Hosting | Vercel | Free tier generous, scales easily |
| Database | Supabase (PostgreSQL) | Managed DB + file storage + auth, free tier |
| File Storage | Supabase Storage | Documents, contracts, training plans |
| Calendar Sync | Google Calendar API | Bi-directional sync |
| Quick Input | Telegram Bot API | Conversational bot for rapid capture |
| AI — Light Tasks | Gemini 2.0 Flash API | Parsing, categorization, briefing generation |
| AI — Heavy Tasks | Claude Sonnet API (Anthropic) | Document reasoning, content generation, workout plan adjustments |
| Push Notifications | Web Push API (via service worker) | Morning briefing alerts, deadline reminders |
| Auth | Supabase Auth | Single-user, but proper auth for security |

---

## Domain Details

### 1. Fitness Domain

**How it works:**
- Niveh builds his own training plans and uploads them as structured documents
- The document contains: current weight, goals, run types (progressive, easy, long run), workout exercise pool (KB swings, ski-erg, KB cleans, etc.), and an 8-week plan structure
- The AI layer (Claude Sonnet) reads and understands the plan structure
- Daily briefing pulls the relevant session for that day
- Adjustments happen via Telegram: "sick this week, push all training forward one week" or "increase mileage by 10km this week"
- Claude Sonnet processes the adjustment, modifies the plan document, and the briefing updates accordingly

**Data model:**
- `fitness_plans` — id, title, start_date, end_date, status (active/completed/paused), document_url (Supabase storage), structured_data (JSONB — parsed plan)
- `fitness_sessions` — id, plan_id, week_number, day_of_week, session_type (gym/run), prescribed_exercises (JSONB), status (upcoming/completed/skipped), actual_notes
- `fitness_exercises` — id, name, category (strength/cardio/mobility), equipment, notes (reference table for the exercise pool)

**AI behavior:**
- On plan upload: Claude Sonnet parses the document into structured_data and generates fitness_sessions for the full plan
- On adjustment request: Claude Sonnet reads the current plan state, applies the modification logically (e.g., shifting weeks, swapping exercises, adjusting volume), updates both the structured_data and the readable document
- Constraints: AI never changes the fundamental program design — only executes adjustments within the user's framework

---

### 2. Personal Domain

**Scope:** Social events, chores, errands, house maintenance, general life admin

**Data model:**
- Uses the shared `tasks` and `projects` tables (see Core Data Model below)
- Domain tag: `personal`
- Supports recurring tasks (weekly chores, monthly admin)
- No specialized sub-system needed — this is the simplest domain

---

### 3. Consulting Domain (nivehs.studio)

**Client pipeline stages:**
1. Discovery — initial call, notes captured
2. Proposal — draft and send project proposal (budget, timeline, deliverables)
3. Contract — send agreement, await signature
4. Active — work in progress, milestones tracked
5. Delivery — final deliverables handed over
6. Closed — project complete, invoice paid

**Data model:**
- `clients` — id, name, contact_email, contact_phone, company, notes, pipeline_stage, created_at
- `client_projects` — id, client_id, title, description, pipeline_stage, start_date, target_end_date, budget, status (active/paused/completed)
- `milestones` — id, project_id, title, due_date, status, description
- `deliverables` — id, milestone_id, title, type (proposal/contract/design/development/report/invoice), status (draft/in-review/approved/delivered), document_url, due_date

**Document storage structure (Supabase Storage):**
```
/consulting/
  /{client-slug}/
    /proposals/
    /contracts/
    /deliverables/
    /invoices/
    /notes/
```

**Automation:**
- Moving a project to a new pipeline stage auto-generates a task checklist:
  - Discovery → Proposal: "Draft proposal", "Review proposal", "Send proposal to client"
  - Proposal → Contract: "Draft contract", "Send contract", "Follow up if unsigned in 5 days"
  - Contract → Active: "Upload signed contract", "Set milestone dates", "Create project timeline"
  - Active → Delivery: "Final review of deliverables", "Send deliverables to client", "Send final invoice"
- Overdue milestones escalate in the daily briefing
- The AI can summarize project status from documents and task completion data

---

### 4. Corporate Domain

**Simple implementation:**
- Time block: 7:30am–3:30pm automatically blocked on all weekdays
- Manually added tasks for after-hours work, special events (conferences, golf days, etc.)
- These manual events sync to Google Calendar
- Domain tag: `corporate`
- No deep integration with work systems

---

## Core Data Model

### Users
```
users
  id: uuid (PK)
  email: text
  name: text
  timezone: text (default: 'Africa/Johannesburg')
  telegram_chat_id: text (for bot integration)
  notification_preferences: JSONB
  created_at: timestamp
```

### Domains
```
domains
  id: uuid (PK)
  user_id: uuid (FK → users)
  name: text (fitness/personal/consulting/corporate)
  color: text (hex — for UI distinction)
  icon: text
  sort_order: int
```

### Projects
```
projects
  id: uuid (PK)
  user_id: uuid (FK → users)
  domain_id: uuid (FK → domains)
  client_id: uuid (FK → clients, nullable)
  title: text
  description: text
  status: text (active/paused/completed/archived)
  start_date: date
  target_end_date: date
  created_at: timestamp
  updated_at: timestamp
```

### Milestones
```
milestones
  id: uuid (PK)
  project_id: uuid (FK → projects)
  title: text
  description: text
  due_date: date
  status: text (upcoming/in-progress/completed/overdue)
  sort_order: int
```

### Tasks
```
tasks
  id: uuid (PK)
  user_id: uuid (FK → users)
  domain_id: uuid (FK → domains)
  project_id: uuid (FK → projects, nullable)
  milestone_id: uuid (FK → milestones, nullable)
  title: text
  description: text
  priority: text (low/medium/high/urgent)
  status: text (todo/in-progress/completed/cancelled)
  due_date: date
  due_time: time (nullable)
  recurrence_rule: text (nullable — RRULE format for recurring tasks)
  escalation_count: int (default 0 — increments each day overdue)
  completed_at: timestamp
  created_at: timestamp
  created_via: text (web/telegram/calendar/auto)
```

### Daily Briefings
```
daily_briefings
  id: uuid (PK)
  user_id: uuid (FK → users)
  date: date
  generated_at: timestamp
  content: JSONB (structured briefing data)
  summary_text: text (AI-generated natural language summary)
  tasks_snapshot: JSONB (snapshot of tasks for that day)
```

### Documents
```
documents
  id: uuid (PK)
  user_id: uuid (FK → users)
  domain_id: uuid (FK → domains)
  project_id: uuid (FK → projects, nullable)
  title: text
  file_type: text (pdf/docx/md/image/other)
  storage_path: text (Supabase storage path)
  document_type: text (proposal/contract/invoice/training-plan/deliverable/notes/other)
  ai_summary: text (nullable — AI-generated summary of contents)
  uploaded_at: timestamp
  updated_at: timestamp
```

### Clients (Consulting-specific)
```
clients
  id: uuid (PK)
  user_id: uuid (FK → users)
  name: text
  company: text (nullable)
  email: text
  phone: text (nullable)
  pipeline_stage: text (discovery/proposal/contract/active/delivery/closed)
  notes: text
  created_at: timestamp
  updated_at: timestamp
```

### Calendar Events (synced)
```
calendar_events
  id: uuid (PK)
  user_id: uuid (FK → users)
  domain_id: uuid (FK → domains)
  google_event_id: text (for sync)
  title: text
  description: text
  start_time: timestamp
  end_time: timestamp
  all_day: boolean
  location: text (nullable)
  synced_at: timestamp
```

### Telegram Messages (log)
```
telegram_messages
  id: uuid (PK)
  user_id: uuid (FK → users)
  chat_id: text
  message_text: text
  parsed_intent: text (create-task/update-task/query/adjust-plan/status-update)
  parsed_data: JSONB
  ai_response: text
  processed_at: timestamp
```

---

## Feature Specifications

### 1. Daily Briefing (North Star Feature)

**Generation time:** 5:30am SAST (configurable)

**Structure:**
```
DAILY BRIEFING — [Day], [Date]

SCHEDULE
──────────
5:45 AM   🏋️ Gym — Push Day (Week 4/8)
7:30 AM   💼 Corporate block
3:30 PM   — End corporate —
4:00 PM   📞 Client call: [Client Name]
6:30 PM   🍽️ Dinner with [Name]

PRIORITY TASKS
──────────
🔴 [Overdue] Pay electricity bill (Personal) — 2 days overdue
🟡 [Due Fri] Client deliverable: Homepage wireframes (Consulting)
⚪ Grocery shopping (Personal)
⚪ Review PR for [corporate project] (Corporate)

UPCOMING (Next 7 Days)
──────────
Mon: Client milestone review — [Client]
Thu: 5K race
Sat: Monthly budget review

ACTIVE PROJECTS STATUS
──────────
[Client A] Rebrand — Active, 3/5 milestones complete, next due May 5
8-Week Strength — Week 4/8, on track
Kitchen renovation — Paused
```

**AI generation flow:**
1. Cron job triggers at 5:30am
2. System queries: today's calendar events, tasks due today + overdue, upcoming 7-day deadlines, active projects with milestone status, today's fitness session
3. Gemini Flash structures the data into the briefing format
4. Store in `daily_briefings` table
5. Push notification sent to user's device

**Interaction:**
- Tasks can be checked off directly from the briefing view
- Unchecked tasks roll to the next day with escalation_count + 1
- Escalation increases visual priority (color coding shifts toward red)

---

### 2. Telegram Bot (Conversational)

**Bot commands and conversational flows:**

Quick task creation:
- "Add task: buy groceries by Friday" → creates task in Personal domain, due Friday
- "New consulting task for [Client]: send invoice by end of week" → creates task in Consulting domain

Status queries:
- "What's my week looking like?" → AI summarizes the week's schedule and tasks
- "How's the [Client] project going?" → AI reads project status, milestones, recent task completion
- "What's overdue?" → Lists all overdue tasks across domains

Fitness adjustments:
- "Sick this week, push training forward one week" → Claude Sonnet adjusts plan
- "Increase mileage by 10km this week" → Claude Sonnet modifies running plan
- "Skip tomorrow's session" → Marks session as skipped, adjusts plan if needed

Project updates:
- "Move [Client] to contract stage" → Updates pipeline, generates stage tasks
- "Completed the wireframes for [Client]" → Marks deliverable as delivered

General conversation:
- "Summarize my consulting workload" → AI aggregates across all active clients
- "What should I focus on today?" → AI prioritizes based on deadlines and escalation

**AI routing logic:**
- Message received → Gemini Flash classifies intent (create-task, query, adjust-plan, update-status, general)
- Simple operations (create task, mark complete, status query): Gemini Flash handles end-to-end
- Complex operations (fitness plan adjustment, project summary from documents, content generation): routed to Claude Sonnet
- All messages and parsed data logged in `telegram_messages` table

---

### 3. Google Calendar Sync

**Bi-directional sync:**

LifeOS → Google Calendar:
- When a task with a due_time is created, a calendar event is created
- When a consulting meeting is scheduled, it syncs to Google Calendar
- Corporate block (7:30–3:30 weekdays) is maintained as a recurring event
- Fitness sessions appear as calendar events on training days

Google Calendar → LifeOS:
- Events created directly in Google Calendar are pulled into LifeOS
- Categorization: AI (Gemini Flash) attempts to auto-tag the domain based on event title/description
- Unknown events default to Personal domain, user can recategorize

**Sync frequency:** Every 15 minutes via cron, plus webhook for real-time updates if available

**Conflict handling:** Google Calendar is the source of truth for time/scheduling. LifeOS is the source of truth for tasks and project data.

---

### 4. Document Management

**Storage:** Supabase Storage with organized bucket structure

**Upload flow:**
1. User uploads via web UI (drag-and-drop) or Telegram (send file to bot)
2. File stored in Supabase Storage under domain/project path
3. AI generates summary (stored in `documents.ai_summary`)
4. For fitness plans: Claude Sonnet additionally parses into structured data for `fitness_plans.structured_data`

**Document types by domain:**
- Fitness: training plans, progress logs
- Personal: general documents
- Consulting: proposals, contracts, invoices, deliverables, meeting notes
- Corporate: overflow project docs

**AI interaction with documents:**
- Claude Sonnet can read document content when queried ("What's in the [Client] contract?")
- Claude Sonnet can modify fitness plan documents based on adjustment requests
- Gemini Flash can reference document metadata (titles, types, dates) for quick queries

---

### 5. Dashboard UI

**Primary views:**

**Today (Default — the Daily Briefing)**
- Morning briefing content rendered as interactive cards
- Check off tasks, tap to expand details
- Quick-add task button with domain selector

**Calendar**
- Weekly/monthly view showing all domains color-coded
- Drag-and-drop rescheduling
- Click to add events

**Projects**
- List of active projects across all domains
- Click into project → see milestones, deliverables, tasks, documents
- Consulting projects show pipeline stage and client info

**Clients** (Consulting sub-view)
- Kanban board of pipeline stages
- Drag clients between stages (triggers auto-task generation)
- Click into client → see all projects, documents, communication log

**Fitness**
- Current plan overview (week-by-week)
- Today's session detail
- Progress tracking (completed sessions, adjustments made)

**Documents**
- File browser organized by domain → project
- Upload interface
- AI summary preview on hover/tap

**Design direction:**
- Warm, minimal aesthetic aligned with nivehs.studio brand sensibility
- Dark mode default: near-black canvas (#0F0C09), warm gold (#D4A96A) accents
- Clean typography: DM Serif Display for headings, Inter for body
- Domain color coding: each domain gets a distinct warm-toned color
- Mobile-first responsive design (phone and iPad are primary devices)

---

## API Architecture

### Internal API Routes (Next.js API Routes)

```
/api/auth/*           — Supabase auth handlers
/api/tasks/*          — CRUD for tasks
/api/projects/*       — CRUD for projects
/api/milestones/*     — CRUD for milestones
/api/clients/*        — CRUD for clients (consulting)
/api/documents/*      — Upload, retrieve, list documents
/api/fitness/*        — Plan management, session tracking
/api/briefing/*       — Generate and retrieve daily briefings
/api/calendar/*       — Google Calendar sync operations
/api/telegram/webhook — Incoming Telegram messages
/api/ai/parse         — Gemini Flash: message parsing, categorization
/api/ai/reason        — Claude Sonnet: document reasoning, plan adjustments
/api/ai/briefing      — Gemini Flash: briefing generation
/api/notifications/*  — Push notification management
```

### External API Integrations

**Google Calendar API**
- OAuth 2.0 for authentication
- `events.list` — pull events
- `events.insert` / `events.update` — push events
- `events.watch` — webhook for real-time sync

**Telegram Bot API**
- Webhook mode (not polling) for efficiency
- `sendMessage` — bot responses
- `getFile` — retrieve uploaded documents
- Inline keyboard for quick actions (domain selection, confirmation)

**Gemini 2.0 Flash API**
- Endpoint: `generativelanguage.googleapis.com`
- Used for: message parsing, task categorization, briefing generation, simple queries
- System prompt includes: domain definitions, task schema, current date/context

**Claude Sonnet API (Anthropic)**
- Endpoint: `api.anthropic.com/v1/messages`
- Used for: document reasoning, fitness plan adjustments, project summaries, content generation
- System prompt includes: user's fitness plan context, consulting workflow rules, document structure

---

## Build Phases

### Phase 1 — Core MVP (Weeks 1–3)
- [ ] Next.js project setup with Supabase integration
- [ ] Auth (single user)
- [ ] Database schema (all tables)
- [ ] Domain, project, task CRUD
- [ ] Daily briefing generation (Gemini Flash)
- [ ] Dashboard UI: Today view, task management
- [ ] PWA configuration (add to home screen)
- [ ] Push notifications for morning briefing
- [ ] Deploy to Vercel

### Phase 2 — Intelligence Layer (Weeks 4–5)
- [ ] Telegram bot setup (webhook, conversational flow)
- [ ] AI message parsing and routing (Gemini Flash)
- [ ] Claude Sonnet integration for document reasoning
- [ ] Fitness plan upload and parsing
- [ ] Fitness plan adjustment via Telegram
- [ ] Document upload and storage (Supabase Storage)

### Phase 3 — Calendar & Consulting (Weeks 6–7)
- [ ] Google Calendar OAuth setup
- [ ] Bi-directional calendar sync
- [ ] Consulting client pipeline (kanban UI)
- [ ] Auto-task generation on pipeline stage change
- [ ] Document browser UI
- [ ] Project detail views with milestones and deliverables

### Phase 4 — Polish & Automation (Week 8)
- [ ] Recurring task engine (RRULE processing)
- [ ] Task escalation logic (overdue handling)
- [ ] Calendar view UI
- [ ] Fitness progress view
- [ ] Notification preferences
- [ ] Performance optimization, error handling, edge cases

---

## Environment Variables Required

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

# Google Calendar
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
GOOGLE_REDIRECT_URI=

# Telegram
TELEGRAM_BOT_TOKEN=

# AI APIs
GEMINI_API_KEY=
ANTHROPIC_API_KEY=

# Push Notifications
NEXT_PUBLIC_VAPID_PUBLIC_KEY=
VAPID_PRIVATE_KEY=

# App
NEXT_PUBLIC_APP_URL=
CRON_SECRET= (for securing cron endpoints)
```

---

## Key Design Principles

1. **Mobile-first** — phone and iPad are primary devices; desktop is secondary
2. **Speed of input** — Telegram for quick capture, web for detailed management
3. **AI as executor, not designer** — the user sets the strategy, AI handles adjustments and summaries
4. **Domain separation** — every item belongs to a domain; the UI always shows which "hat" you're wearing
5. **Morning briefing as habit** — if the briefing isn't useful and reliable, the whole system fails
6. **Living documents** — files aren't static storage; the AI reads, understands, and can modify them
7. **Escalation by default** — overdue tasks get louder, not quieter

---

## Claude Code Instructions

When building this project in Claude Code:

1. Start with Phase 1 — get the core CRUD and briefing working before adding AI
2. Use the Supabase JavaScript client (`@supabase/supabase-js`) for all DB operations
3. Use Next.js App Router with server components where possible, client components for interactive elements
4. Style with Tailwind CSS, dark mode default, using the color palette defined above
5. Create a `/lib/ai/router.ts` that handles the Gemini/Claude routing logic — all AI calls go through this
6. The Telegram webhook should validate updates and queue processing — don't block the webhook response
7. For Google Calendar, use the `googleapis` npm package
8. All dates/times should be handled in `Africa/Johannesburg` timezone
9. Use Supabase Row Level Security (RLS) even for single-user — good practice for security

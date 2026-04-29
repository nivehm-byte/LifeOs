# LifeOS — Phase 1 Build Log

Everything completed in the initial build session. Covers scaffold through first successful login.

---

## 1. Project Scaffold

**Stack:** Next.js 14 (App Router) · TypeScript · Tailwind CSS · Supabase (`@supabase/ssr`) · next-pwa v5

- Initialised project, installed all dependencies
- Configured dark mode by default (`class="dark"` on `<html>`)
- Set up brand tokens in `tailwind.config.ts`:
  - Background: `#0F0C09` (`canvas`)
  - Accent: `#D4A96A`
  - Domain colours: fitness green, personal blue, consulting orange, corporate purple
  - Status colours: urgent red, high orange, medium gold, low green
- Fonts: Inter (body) + DM Serif Display (headings) via `next/font/google`
- PWA: `next.config.js` (CommonJS, required by next-pwa v5) with `withPWA` wrapper, runtime caching for fonts/images/briefing API
- `public/manifest.json` with brand colours and 8 icon size declarations
- `src/middleware.ts` — session refresh + auth guard (redirects unauthenticated users to `/login`)

**Key files:**
```
next.config.js
tailwind.config.ts
public/manifest.json
src/middleware.ts
src/lib/supabase/server.ts     — createClient() + createServiceClient()
src/lib/supabase/client.ts     — createBrowserClient()
src/lib/supabase/middleware.ts — updateSession()
src/types/database.ts          — full typed Database interface
```

---

## 2. Database Schema

Single migration (`supabase/migrations/20260428000000_initial_schema.sql`) covering 15 tables:

| Table | Purpose |
|---|---|
| `users` | Single user, stores notification_preferences JSONB |
| `domains` | 4 life domains: fitness, personal, consulting, corporate |
| `clients` | Consulting clients with pipeline stage |
| `projects` | Cross-domain projects, optional client link |
| `milestones` | Ordered milestones per project |
| `tasks` | Core task entity with priority, escalation, recurrence |
| `daily_briefings` | Generated briefing JSON + AI summary (Phase 2) |
| `documents` | File metadata for Supabase Storage |
| `calendar_events` | Google Calendar sync target |
| `telegram_messages` | Incoming Telegram bot messages |
| `fitness_plans` | Structured training plans |
| `fitness_sessions` | Individual sessions with prescribed exercises |
| `fitness_exercises` | Exercise library |
| `client_projects` | Client-facing project view |
| `deliverables` | Milestone deliverables |

**Also in this migration:**
- `handle_updated_at()` trigger on 6 tables
- `is_owner(uuid)` RLS helper function
- 41 indexes including partial indexes
- RLS policies on every table

**Subsequent migrations:**
- `20260428000001_escalation_rpc.sql` — `increment_overdue_escalation()` PostgreSQL function (batch UPDATE, `security definer`)
- `20260428000002_push_subscriptions.sql` — `push_subscriptions` table for Web Push endpoints

---

## 3. Utility Layer

```
src/lib/utils/date.ts    — nowInSAST(), todayInSAST(), addDays(), formatSASTDate()
src/lib/utils/domain.ts  — DOMAIN_HEX, DOMAIN_ORDER, DOMAIN_ICON, DOMAIN_LABEL, withAlpha(), PRIORITY_HEX
src/lib/utils/api.ts     — ok(), err(), handleError() (handles ZodError.issues)
```

**SAST timezone:** All date operations use `Africa/Johannesburg` (UTC+2). Dates are never processed as UTC.

**Domain colour system:** Dynamic Tailwind classes get purged at build time. All domain/priority colours use `DOMAIN_HEX` map + inline styles, never `bg-domain-${name}`.

---

## 4. Task Management

**Schema validation:** `src/lib/tasks/schema.ts` — Zod schemas for create/update/filter/reschedule

**Queries:** `src/lib/tasks/queries.ts`
- `TaskWithDomain` type: task row joined with `domain.name/color/icon`
- `getTodayTasks()` — due today + overdue, ordered by escalation then priority
- `getUpcomingTasks(days)` — next N days
- `listTasks(filters)` — full filter set with pagination

**Server actions:** `src/lib/tasks/actions.ts`
- `createTaskAction`, `markTaskComplete`, `markTaskIncomplete`
- `changePriority`, `rescheduleTask`, `cancelTask`, `incrementEscalation`
- All call `revalidatePath("/today")` + `revalidateTag("tasks")`

**API routes:**
- `GET/POST /api/tasks`
- `GET/PATCH/DELETE /api/tasks/[id]`
- `POST /api/tasks/escalate` — cron-protected, calls `increment_overdue_escalation()` RPC

---

## 5. Projects & Milestones

**Queries:** `src/lib/projects/queries.ts`
- `ProjectWithMeta` — row + domain + client + computed milestone stats
- `getActiveProjectsSummary()` — for the briefing: active/paused projects with overdue milestone count

**Server actions:** `src/lib/projects/actions.ts`, `src/lib/milestones/actions.ts`
- Full CRUD for both
- `reorderMilestones()` — bulk sort_order update
- `syncOverdueStatuses()` — marks past-due milestones as "overdue"

**API routes:**
- `GET/POST /api/projects`
- `GET/PATCH/DELETE /api/projects/[id]`
- `GET/POST /api/projects/[id]/milestones`
- `GET/PATCH/DELETE /api/milestones/[id]` — dual-mode PATCH: `{ order: [...] }` triggers bulk reorder

---

## 6. Calendar Queries

```
src/lib/calendar/queries.ts
  getTodayEvents()      — events with start_time in today's SAST window
  getUpcomingEvents(7)  — next 7 days
```

Both use SAST-aware ISO strings: `.gte("start_time", "${today}T00:00:00+02:00")`

---

## 7. Today Dashboard

**Page:** `src/app/(app)/today/page.tsx` — `force-dynamic`, parallel `Promise.all` with `.catch(() => [])` fallbacks

**Components:**
| Component | Role |
|---|---|
| `TodayHeader` | Date heading, task count, gear icon → `/settings/notifications` |
| `ScheduleSection` | Today's calendar events with domain colour and time |
| `OverdueBanner` | Red-flagged overdue tasks sorted by escalation count |
| `DomainTaskSection` | Tasks grouped by domain with colour-coded header |
| `UpcomingSection` | 7-day lookahead, merged tasks + events grouped by date |
| `ProjectsStatus` | Active project health: milestone progress, overdue count |
| `QuickAddButton` | Floating action button (FAB) |
| `QuickAddModal` | Bottom-sheet task creation form |
| `TaskCard` | Optimistic checkbox, priority dot, escalation badge |

**Escalation urgency tiers in TaskCard:**
- `escalation_count = 0` — normal
- `escalation_count 1–2` — amber `#E0975C` left border + pill badge
- `escalation_count 3+` — red `#E05C5C` left border + pill badge

---

## 8. Daily Briefing Generator

**`POST /api/briefing/generate`** — cron-protected, runs at 5:15am SAST

```
src/lib/briefing/types.ts   — BriefingContent, BriefingTasksSnapshot interfaces
src/lib/briefing/gather.ts  — gatherBriefingData(userId): parallel fetch of all 6 data sources
src/lib/briefing/store.ts   — storeBriefing(): upserts to daily_briefings on (user_id, date)
```

**Content structure stored in `daily_briefings.content`:**
- `schedule` — today's events
- `tasks` — today / overdue / upcoming buckets
- `projects` — active project health
- `fitness` — today's scheduled session

**`tasks_snapshot`** stores flat metrics: total open, by domain, by priority.

---

## 9. Web Push Notifications

**Service worker:** `worker/index.ts` — push event handler + notificationclick handler, injected by next-pwa via `customWorkerDir: "worker"`

**Library:** `web-push` (VAPID)

```
src/lib/push/send.ts     — sendPushToUser(): sends to all subscriptions, auto-removes 410 Gone
src/lib/push/actions.ts  — server actions: getNotificationPrefs, updateNotificationPrefs,
                            saveSubscription, removeSubscription, getBriefingPushTarget
```

**API routes:**
- `POST/DELETE /api/push/subscribe` — save/remove browser subscription
- `POST /api/push/briefing?slot=HHMM` — cron-protected, checks user's preferred time slot
- `POST /api/push/test` — sends immediate test notification

**Notification preferences** stored in `users.notification_preferences` JSONB:
```json
{ "push_enabled": true, "briefing_time": "05:30" }
```

**Settings page:** `src/app/(app)/settings/notifications/page.tsx`
- Toggle switch to subscribe/unsubscribe
- 5 time slot presets: 5:30 / 6:00 / 6:30 / 7:00 / 7:30 SAST
- "Send test" button
- Graceful degradation for denied/unsupported browsers

---

## 10. Vercel Configuration

**`vercel.json`:**

```
Security headers on all routes:  X-Frame-Options, X-Content-Type-Options, Referrer-Policy, Permissions-Policy
/sw.js:                          Cache-Control: no-cache + Service-Worker-Allowed: /
/workbox-*.js:                   Cache-Control: immutable
/api/*:                          Cache-Control: no-store
```

**Cron schedule (all times SAST = UTC+2):**

| Time (SAST) | UTC | Endpoint |
|---|---|---|
| 5:15 am | 3:15 | `/api/briefing/generate` |
| 5:20 am | 3:20 | `/api/tasks/escalate` |
| 5:30 am | 3:30 | `/api/push/briefing?slot=0530` |
| 6:00 am | 4:00 | `/api/push/briefing?slot=0600` |
| 6:30 am | 4:30 | `/api/push/briefing?slot=0630` |
| 7:00 am | 5:00 | `/api/push/briefing?slot=0700` |
| 7:30 am | 5:30 | `/api/push/briefing?slot=0730` |

All cron endpoints validate `x-cron-secret` header against `CRON_SECRET` env var.

---

## 11. Environment Variables

Full reference in `.env.example`. Required before deployment:

| Variable | Purpose |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon key (browser-safe) |
| `SUPABASE_SERVICE_ROLE_KEY` | Service role key (server-only, bypasses RLS) |
| `NEXT_PUBLIC_VAPID_PUBLIC_KEY` | VAPID public key for push (browser-safe) |
| `VAPID_PRIVATE_KEY` | VAPID private key (server-only) |
| `VAPID_SUBJECT` | Contact mailto: for push |
| `CRON_SECRET` | Shared secret for cron endpoint auth |
| `NEXT_PUBLIC_APP_URL` | Production domain |
| `GOOGLE_CLIENT_ID/SECRET` | Google Calendar OAuth (Phase 3) |
| `TELEGRAM_BOT_TOKEN` | Telegram bot (Phase 3) |
| `GEMINI_API_KEY` | AI summarisation (Phase 2) |
| `ANTHROPIC_API_KEY` | Telegram NLP (Phase 3) |

Generate VAPID keys: `npx web-push generate-vapid-keys`  
Generate CRON_SECRET: `openssl rand -hex 32`

---

## 12. Authentication

**Flow:** Email OTP (8-digit code, no redirect required)

**Login page:** `src/app/login/page.tsx`
- Default mode: **Email code** — enter email → receive 8-digit OTP → enter code → signed in
- Toggle mode: **Password** — standard email + password
- `signInWithOtp()` + `verifyOtp({ type: "email" })`
- `signInWithPassword()` for password mode

**Callback page:** `src/app/auth/callback/page.tsx`
- Client component handling both PKCE (`?code=`) and implicit (`#access_token=`) flows
- 5-second timeout fallback

**Supabase configuration required:**
- Authentication → Settings → **Disable "Enable email confirmations"**
- Authentication → Email Templates → Magic Link → body uses `{{ .Token }}`
- Authentication → URL Configuration → Site URL + Redirect URLs set to production domain

---

## 13. Bugs Fixed During Build

| Bug | Fix |
|---|---|
| `@apply dark` in globals.css | `dark` is a variant not a utility — removed, use `class="dark"` on `<html>` |
| Circular `Database` type resolving to `never` | Rewrote all row types as standalone objects, added `Tbl<Row, Ins, Upd>` helper |
| Supabase `GenericTable` constraint | Added `Relationships: []` to every table via `Tbl` wrapper |
| `ZodError.errors` → `.issues` | Zod v3 uses `.issues` |
| `MapIterator` downlevel iteration | `[...map.entries()]` → `Array.from(map.entries())` |
| next-pwa requires CommonJS | `next.config.mjs` → `next.config.js` |
| Dynamic Tailwind classes purged | All domain/priority colours use inline styles via `DOMAIN_HEX` map |
| `react/no-unescaped-entities` | `'` → `&apos;` in JSX text content |
| Auth callback 404 | Added `/auth/callback/page.tsx` as client component |
| OTP "Token has expired" | Removed `shouldCreateUser: false`; disabled email confirmations in Supabase |
| OTP input too short | Updated `maxLength` and `pattern` from 6 to 8 digits |

---

## 14. Repository

**GitHub:** https://github.com/nivehm-byte/LifeOs  
**Deployment:** Vercel (auto-deploys on push to `main`)  
**Branch:** `main`

---

## Phase 2 — Planned Next

- AI summarisation of daily briefing via Gemini (populate `summary_text` in `daily_briefings`)
- Google Calendar sync
- Telegram bot for natural-language task capture
- Fitness plan upload + session tracking UI
- Projects and clients UI pages

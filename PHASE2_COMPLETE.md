# LifeOS — Phase 2 Build Log

Everything completed in the Phase 2 build session. Covers AI routing, Telegram bot, fitness plan module, and daily briefing AI summary.

---

## 1. AI Routing Module

**File:** `src/lib/ai/router.ts` (complete rewrite of the Phase 1 skeleton)

Central AI module — all AI calls in the app go through here. Adds retry logic, cost logging, and lazy client initialisation on every function.

### Exported functions

| Function | Model | Purpose |
|---|---|---|
| `parseMessage(text, options?)` | Gemini Flash | Classify natural-language into a structured `ParsedIntent` with JSON output mode |
| `generateBriefing(data)` | Gemini Flash | Generate a conversational morning briefing from `BriefingContent` |
| `reasonAboutDocument(document, query)` | Claude Sonnet | Answer questions about a document's text content |
| `parseFitnessPlan(content)` | Claude Sonnet | Parse a training plan document into structured `FitnessPlanData` JSON |
| `adjustFitnessPlan(plan, instruction, startDate)` | Claude Sonnet | Apply a natural-language adjustment to a fitness plan |

### Retry logic

`withRetry<T>(fn, operation, maxAttempts=3, baseDelayMs=1000)` — exponential backoff (1s → 2s → 4s). Retries on: network errors, fetch failures, timeout, 429/rate limit/quota, 500/502/503, overloaded. Non-retryable errors (400, 401) throw immediately.

### Cost logging

Every call emits a structured JSON log line to stdout:
```json
{
  "event": "ai_usage",
  "model": "gemini-2.0-flash",
  "operation": "parse-message",
  "input_tokens": 312,
  "output_tokens": 48,
  "cost_usd": 0.0000379,
  "timestamp": "2026-04-29T03:30:00.000Z"
}
```

Model cost rates (USD/million tokens):

| Model | Input | Output |
|---|---|---|
| `gemini-2.0-flash` | $0.075 | $0.30 |
| `claude-sonnet-4-6` | $3.00 | $15.00 |
| `claude-haiku-4-5-20251001` | $0.80 | $4.00 |

### Key types exported

```typescript
export interface ParsedIntent {
  intent: AIIntent;
  data: Record<string, unknown>;
  reply?: string;
}

export interface DomainInfo {
  id: string; name: string; color: string; icon: string;
}

export interface DocumentInput {
  title: string; content: string; file_type?: string;
}
```

`AIIntent` union (in `src/types/index.ts`):
```typescript
"create-task" | "update-task" | "query" | "adjust-plan" |
"adjust-fitness-plan" | "status-update" | "general"
```

---

## 2. Telegram Bot Integration

**Webhook:** `POST /api/telegram/webhook`

### Setup (one-time)

1. Create bot via `@BotFather → /newbot`, copy token
2. Generate webhook secret: `openssl rand -hex 32`
3. Set env vars `TELEGRAM_BOT_TOKEN` and `TELEGRAM_WEBHOOK_SECRET` in Vercel
4. Create Supabase Storage bucket named `documents` (private)
5. Register the webhook:
   ```bash
   curl -X POST https://api.telegram.org/bot<TOKEN>/setWebhook \
     -H 'Content-Type: application/json' \
     -d '{"url":"https://<domain>/api/telegram/webhook","secret_token":"<SECRET>"}'
   ```

### Files

| File | Purpose |
|---|---|
| `src/lib/telegram/types.ts` | Telegram Update/Message/Document types + `IntentType`, `ParsedIntent`, `DomainRow` |
| `src/lib/telegram/client.ts` | `sendMessage`, `getFileInfo`, `downloadFile` |
| `src/lib/telegram/parser.ts` | Thin wrapper — delegates to `router.parseMessage` with domain context |
| `src/lib/telegram/executor.ts` | Intent switch: calls DB/AI and returns a reply string |
| `src/app/api/telegram/webhook/route.ts` | Entry point — auth, user lookup, message routing |

### Intent handling

The executor covers all 7 intents:

| Intent | What it does |
|---|---|
| `create-task` | Inserts task with `created_via: "telegram"`, replies with domain emoji + due date |
| `query` | Subtypes: `today`, `upcoming`, `overdue`, `projects`. Returns bullet list. |
| `status-update` | Fuzzy title match → updates `status` (+ `completed_at` if done) |
| `update-task` | Fuzzy title match → updates arbitrary fields via `TaskUpdate` cast |
| `adjust-plan` | Fuzzy title match on projects → updates `ProjectUpdate` fields |
| `adjust-fitness-plan` | Calls `adjustFitnessPlan` via AI, re-syncs sessions (see §4) |
| `general` | Returns `parsed.reply` from the AI or a fallback help string |

### Document upload

When a document is sent:
1. File is downloaded from Telegram API
2. Uploaded to Supabase Storage (`documents` bucket) at `{userId}/{timestamp}-{filename}`
3. `documents` table record created

**Fitness plan detection:** if the caption contains any of `"training plan"`, `"fitness plan"`, `"workout plan"`, `"gym plan"`, `"running plan"`, or `"training programme"`, the document is routed through `parseFitnessPlan` instead of the generic document flow (see §4).

### User registration

First message from a new chat auto-sets `users.telegram_chat_id`. Subsequent messages from unknown chat IDs are silently ignored once a chat ID is registered — no information leakage.

### Auth

Incoming requests are validated against `X-Telegram-Bot-Api-Secret-Token` header. Returns 401 if missing or wrong.

---

## 3. Daily Briefing — AI Summary

**Files changed:** `src/app/api/briefing/generate/route.ts`, `src/lib/briefing/store.ts`

`storeBriefing` now accepts a 5th `summaryText: string = ""` parameter and writes it to `daily_briefings.summary_text`.

The generate route calls `generateBriefing(content)` after gathering data and passes the result to `storeBriefing`. AI failure is non-fatal — structured data is always stored, `summary_text` degrades to `""` if Gemini is unavailable.

```
5:15 AM  →  /api/briefing/generate  →  gatherBriefingData() + generateBriefing()
                                       → storeBriefing(userId, date, content, snapshot, summary)
5:30 AM  →  /api/push/briefing       →  fetches summary_text from daily_briefings
                                       → uses first sentence as push notification body
```

**Push notification improvement:** the push body was previously a static string. It now pulls `summary_text` from the briefing generated 15 minutes earlier and uses the first sentence (capped at 120 chars). Falls back to `"Open LifeOS to see your day."` if the summary is absent.

**Briefing prompt** (in `src/lib/ai/router.ts`): prose-only, no bullets, max 200 words, opens directly with urgent content, names tasks/projects/clients by name, never uses filler openers.

---

## 4. Fitness Plan Module

### Types — `src/lib/fitness/types.ts`

```typescript
interface PlanExercise {
  name: string;
  category: "strength" | "cardio" | "mobility";
  sets?: number;
  reps?: string;          // "8-12" or "10"
  weight_kg?: number;
  distance_km?: number;
  duration_min?: number;
  rest_seconds?: number;
  notes?: string;
}

interface PlanSession {
  day_of_week: number;    // 0=Sun … 6=Sat
  day_label?: string;
  session_type: "gym" | "run";
  title?: string;
  exercises: PlanExercise[];
  notes?: string;
}

interface PlanWeek {
  week_number: number;
  theme?: string;
  sessions: PlanSession[];
}

interface FitnessPlanData {
  meta: { title, total_weeks, sessions_per_week, goal?, notes? };
  weeks: PlanWeek[];
}

interface AdjustmentResult {
  plan: FitnessPlanData;
  summary: string;
  new_start_date: string | null;
}
```

`FitnessPlanData` is stored as JSONB in `fitness_plans.structured_data`.

### Sessions utility — `src/lib/fitness/sessions.ts`

**`calcScheduledDate(startDate, weekNumber, dayOfWeek)`**
Backs up to the Sunday of `startDate`'s calendar week, then adds `(week_number - 1) * 7 + day_of_week` days. `day_of_week` follows JS convention: 0 = Sunday.

**`syncSessionsFromPlan(planId, startDate, planData)`**
Deletes all non-completed sessions for the plan, then inserts fresh rows for every session in every week. Completed sessions are preserved. Safe to call after every upload or adjustment.

**`renderPlanMarkdown(plan, startDate)`**
Returns a human-readable markdown string of the full plan — used in Telegram responses and the adjustment summary.

### API routes

| Route | Method | Purpose |
|---|---|---|
| `/api/fitness/upload` | POST | `multipart/form-data`: `file` + `start_date` (required) + `title` (optional). Parses → stores file → creates plan → syncs sessions. Pauses any existing active plan. |
| `/api/fitness/plans` | GET | Returns active plan meta, today's session, and count of remaining sessions this week. |
| `/api/fitness/plans/[id]/adjust` | POST | Body: `{ instruction: string }`. Applies adjustment via Claude Sonnet, updates `structured_data`, re-syncs upcoming sessions. |

**File format support:** `.txt` and `.md` are decoded as UTF-8. PDF returns 415 with a clear error.

### Telegram flow

**Upload:** Send a document with caption containing a fitness keyword → bot replies with plan title, week/session count, and a preview of Week 1.

**Adjust:** Send a natural-language instruction → routed as `adjust-fitness-plan` → Claude Sonnet modifies the JSON → sessions re-synced → bot replies with the updated plan in markdown.

**Examples supported by the adjuster:**
- `"push training forward one week"` → shifts `start_date` + 7 days
- `"skip week 3"` → empties week 3's sessions array
- `"deload week 8"` → sets theme to Deload, halves sets
- `"change Monday sets to 5×5 from week 4 onwards"` → updates matching sessions
- `"swap Tuesday and Thursday for week 2"` → exchanges `day_of_week` values

### Briefing integration

No changes required — `gatherBriefingData` in `src/lib/briefing/gather.ts` already queries:
1. Active plan from `fitness_plans` (status = `'active'`)
2. Today's session from `fitness_sessions` (matching `scheduled_date = today`)

The session's `prescribed_exercises` JSONB and `session_type` are included in `BriefingContent.fitness.session` and surfaced in the AI summary.

---

## 5. Database Migration

**`supabase/migrations/20260429000000_auto_create_user.sql`**

**Problem fixed:** Supabase Auth creates an `auth.users` row on sign-up, but nothing created the corresponding `public.users` row. Every app query that looked up the user returned null — causing the Telegram bot to reply "LifeOS user not found."

**Fix:**
```sql
-- Trigger fires on every auth.users INSERT
create or replace function public.handle_new_auth_user()
returns trigger language plpgsql security definer as $$
begin
  insert into public.users (id, email, name)
  values (new.id, new.email,
    coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)))
  on conflict (id) do nothing;
  return new;
end; $$;

create or replace trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_auth_user();

-- Backfill for existing accounts
insert into public.users (id, email, name)
select au.id, au.email, coalesce(au.raw_user_meta_data->>'full_name', split_part(au.email, '@', 1))
from auth.users au
where not exists (select 1 from public.users pu where pu.id = au.id);
```

---

## 6. Bugs Fixed During Phase 2

| Bug | Fix |
|---|---|
| `adjust-fitness-plan` silently downgraded to `general` | Added it to `VALID_INTENTS` in `src/lib/ai/router.ts` |
| `public.users` empty → Telegram bot returned "user not found" | Migration `20260429000000_auto_create_user.sql` adds trigger + backfill |
| OTP UI said "6-digit code" but Supabase sends 8 digits | Updated placeholder, instruction text, and comments in login page |
| Nested Supabase select (`.select("*, domain:domains(name)")`) collapsed to `never` type | Removed join from select, resolved domain from already-loaded `domainList` |
| `Record<string, unknown>` rejected by Supabase `.update()` type | Cast via `d.changes as TaskUpdate` / `d.changes as ProjectUpdate` |

---

## 7. Environment Variables Added in Phase 2

| Variable | Purpose |
|---|---|
| `TELEGRAM_BOT_TOKEN` | Bot token from @BotFather |
| `TELEGRAM_WEBHOOK_SECRET` | Shared secret set in `setWebhook` and validated on every incoming request |
| `GEMINI_API_KEY` | Gemini Flash — `parseMessage`, `generateBriefing` |
| `ANTHROPIC_API_KEY` | Claude Sonnet — `reasonAboutDocument`, `parseFitnessPlan`, `adjustFitnessPlan` |

All existing env vars from Phase 1 remain required.

---

## 8. Repository

**GitHub:** https://github.com/nivehm-byte/LifeOs
**Branch:** `main`
**Phase 2 commits:** `c83ad68` → `95e2939`

---

## Phase 3 — Planned Next

- Google Calendar sync (OAuth + webhook for event changes)
- Projects and clients UI pages
- Fitness session tracking UI (log completed sessions, actual notes)
- Document viewer with `reasonAboutDocument` Q&A interface

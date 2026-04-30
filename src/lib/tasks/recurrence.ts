import { createServiceClient } from "@/lib/supabase/server";
import { todayInSAST } from "@/lib/utils/date";
import type { Priority, TaskStatus, CreatedVia } from "@/types/database";

// ── RRULE parser ─────────────────────────────────────────────────────────────
// Supports: FREQ=DAILY|WEEKLY|MONTHLY with INTERVAL, BYDAY, BYMONTHDAY.
// No external dependency — covers every pattern documented in the spec.

const WEEKDAY: Record<string, number> = {
  SU: 0, MO: 1, TU: 2, WE: 3, TH: 4, FR: 5, SA: 6,
};

type Freq = "DAILY" | "WEEKLY" | "MONTHLY";

interface ParsedRule {
  freq:         Freq;
  interval:     number;
  byday:        number[];   // weekday numbers (0=Sun … 6=Sat)
  bymonthday:   number | null;
}

export function parseRRule(raw: string): ParsedRule {
  const parts: Record<string, string> = {};
  for (const seg of raw.replace(/^RRULE:/i, "").split(";")) {
    const eq = seg.indexOf("=");
    if (eq !== -1) parts[seg.slice(0, eq).toUpperCase()] = seg.slice(eq + 1);
  }

  const freq = parts["FREQ"]?.toUpperCase() as Freq;
  if (!["DAILY", "WEEKLY", "MONTHLY"].includes(freq)) {
    throw new Error(`Unsupported FREQ: ${parts["FREQ"] ?? "(none)"}`);
  }

  const interval = parts["INTERVAL"] ? Math.max(1, parseInt(parts["INTERVAL"], 10)) : 1;

  const byday = parts["BYDAY"]
    ? parts["BYDAY"].split(",").map((d) => WEEKDAY[d.toUpperCase().slice(-2)]).filter((n) => n !== undefined)
    : [];

  const bymonthday = parts["BYMONTHDAY"] ? parseInt(parts["BYMONTHDAY"], 10) : null;

  return { freq, interval, byday, bymonthday };
}

// ── Occurrence expansion ──────────────────────────────────────────────────────
// Returns all dates in [from, to] (inclusive) that match the rule.
// dtstart is the anchor; occurrences always fall on rule-valid dates >= dtstart.

export function expandOccurrences(
  rule:    ParsedRule,
  dtstart: Date,
  from:    Date,
  to:      Date,
): Date[] {
  const results: Date[] = [];
  const MAX = 3650; // safety cap — ~10 years of daily tasks

  if (rule.freq === "DAILY") {
    // Advance dtstart to the first occurrence >= from
    const diff = Math.ceil((from.getTime() - dtstart.getTime()) / 86_400_000);
    const stepsNeeded = diff > 0 ? Math.ceil(diff / rule.interval) * rule.interval : 0;
    let cur = addDays(dtstart, stepsNeeded);
    let iter = 0;

    while (cur <= to && iter++ < MAX) {
      if (cur >= from) results.push(new Date(cur));
      cur = addDays(cur, rule.interval);
    }
    return results;
  }

  if (rule.freq === "WEEKLY") {
    // Default to same weekday as dtstart when BYDAY is absent
    const targetDays = rule.byday.length > 0 ? [...rule.byday].sort((a, b) => a - b) : [dtstart.getDay()];

    // Walk week-by-week starting from the ISO week that contains dtstart.
    // Advance by interval weeks at a time.
    const weekStart = startOfWeek(dtstart); // Sunday of dtstart's week
    let weekCur = new Date(weekStart);
    let iter = 0;

    while (weekCur <= to && iter++ < MAX) {
      for (const wd of targetDays) {
        const candidate = addDays(weekCur, wd); // Sun=0 offset from weekStart
        if (candidate >= dtstart && candidate >= from && candidate <= to) {
          results.push(new Date(candidate));
        }
      }
      weekCur = addDays(weekCur, 7 * rule.interval);
    }
    return results;
  }

  if (rule.freq === "MONTHLY") {
    const dom = rule.bymonthday ?? dtstart.getDate();
    // First candidate: same month as dtstart
    let cur = clampToMonth(dtstart.getFullYear(), dtstart.getMonth(), dom);
    // Advance if before dtstart
    if (cur < dtstart) cur = clampToMonth(cur.getFullYear(), cur.getMonth() + rule.interval, dom);
    let iter = 0;

    while (cur <= to && iter++ < MAX) {
      if (cur >= from) results.push(new Date(cur));
      cur = clampToMonth(cur.getFullYear(), cur.getMonth() + rule.interval, dom);
    }
    return results;
  }

  return results;
}

// ── Date helpers ──────────────────────────────────────────────────────────────

function addDays(d: Date, n: number): Date {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
}

function startOfWeek(d: Date): Date {
  return addDays(d, -d.getDay()); // back to Sunday
}

function clampToMonth(year: number, month: number, day: number): Date {
  // JS Date auto-rolls: new Date(2026, 1, 31) → March 3 — avoid by clamping
  const lastDay = new Date(year, month + 1, 0).getDate();
  return new Date(year, month, Math.min(day, lastDay));
}

function toDateStr(d: Date): string {
  return d.toISOString().slice(0, 10); // "YYYY-MM-DD"
}

function parseLocalDate(s: string): Date {
  // Parse "YYYY-MM-DD" as local midnight to avoid UTC offset surprises
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, m - 1, d);
}

// ── Core processing ───────────────────────────────────────────────────────────
// Called by the daily cron. Processes every active template task across all
// users and generates instances for the next HORIZON_DAYS days.

const HORIZON_DAYS = 14;

export async function processAllRecurringTasks(): Promise<{
  templates: number;
  generated: number;
}> {
  const supabase = createServiceClient();
  const today    = todayInSAST();
  const from     = parseLocalDate(today);
  const to       = addDays(from, HORIZON_DAYS);

  // Template tasks: have recurrence_rule, no parent, not yet cancelled
  const { data: templates, error } = await supabase
    .from("tasks")
    .select("*")
    .not("recurrence_rule", "is", null)
    .is("recurrence_parent_id", null)
    .not("due_date", "is", null)
    .in("status", ["todo", "in-progress"]);

  if (error) throw new Error(`Fetch templates failed: ${error.message}`);
  if (!templates?.length) return { templates: 0, generated: 0 };

  let totalGenerated = 0;

  for (const template of templates) {
    try {
      totalGenerated += await processTemplate(supabase, template, from, to);
    } catch (err) {
      // Log but continue — one bad template shouldn't block others
      console.error(`Recurrence: skipped template ${template.id}:`, err);
    }
  }

  return { templates: templates.length, generated: totalGenerated };
}

type SupabaseClient = ReturnType<typeof createServiceClient>;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function processTemplate(supabase: SupabaseClient, template: any, from: Date, to: Date): Promise<number> {
  let rule: ParsedRule;
  try {
    rule = parseRRule(template.recurrence_rule as string);
  } catch {
    return 0; // unsupported or malformed rule — skip silently
  }

  const dtstart = parseLocalDate(template.due_date as string);
  const occurrences = expandOccurrences(rule, dtstart, from, to);
  if (!occurrences.length) return 0;

  // Collect dates already covered: the template's own date + all existing instances
  const { data: existing } = await supabase
    .from("tasks")
    .select("due_date")
    .eq("recurrence_parent_id", template.id);

  const alreadyExists = new Set<string>([
    template.due_date as string,
    ...(existing ?? []).map((r: { due_date: string | null }) => r.due_date).filter(Boolean) as string[],
  ]);

  const toInsert = occurrences
    .map(toDateStr)
    .filter((d) => !alreadyExists.has(d))
    .map((dateStr) => ({
      user_id:              template.user_id              as string,
      domain_id:            template.domain_id            as string,
      project_id:           template.project_id           as string | null,
      milestone_id:         template.milestone_id         as string | null,
      title:                template.title                as string,
      description:          template.description          as string | null,
      priority:             template.priority             as Priority,
      status:               "todo"                        as TaskStatus,
      due_date:             dateStr,
      due_time:             template.due_time             as string | null,
      recurrence_rule:      null,
      recurrence_parent_id: template.id                   as string,
      escalation_count:     0,
      created_via:          "auto"                        as CreatedVia,
    }));

  if (!toInsert.length) return 0;

  const { error } = await supabase.from("tasks").insert(toInsert);
  if (error) throw new Error(`Insert failed: ${error.message}`);

  return toInsert.length;
}

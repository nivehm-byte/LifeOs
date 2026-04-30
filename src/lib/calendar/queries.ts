import { createClient } from "@/lib/supabase/server";
import { todayInSAST, addDays } from "@/lib/utils/date";
import type { Database } from "@/types/database";

type CalendarEventRow = Database["public"]["Tables"]["calendar_events"]["Row"];
type DomainRow        = Database["public"]["Tables"]["domains"]["Row"];

export type CalendarEventWithDomain = CalendarEventRow & {
  domain: Pick<DomainRow, "name" | "color" | "icon">;
};

// ----------------------------------------------------------------
// getTodayEvents
// Fetches events whose start_time falls within today in SAST (UTC+2).
// PostgreSQL correctly compares timestamptz against tz-aware strings.
// ----------------------------------------------------------------
export async function getTodayEvents(): Promise<CalendarEventWithDomain[]> {
  const supabase  = createClient();
  const today     = todayInSAST();

  const { data, error } = await supabase
    .from("calendar_events")
    .select(`*, domain:domains (name, color, icon)`)
    .gte("start_time", `${today}T00:00:00+02:00`)
    .lt( "start_time", `${addDays(today, 1)}T00:00:00+02:00`)
    .order("start_time", { ascending: true });

  if (error) throw new Error(error.message);
  return (data ?? []) as unknown as CalendarEventWithDomain[];
}

// ----------------------------------------------------------------
// getEventsByRange
// Events where start_time falls in [from, to) in SAST.
// `from` and `to` are "YYYY-MM-DD" date strings.
// ----------------------------------------------------------------
export async function getEventsByRange(from: string, to: string): Promise<CalendarEventWithDomain[]> {
  const supabase = createClient();

  const { data, error } = await supabase
    .from("calendar_events")
    .select(`*, domain:domains (name, color, icon)`)
    .gte("start_time", `${from}T00:00:00+02:00`)
    .lt( "start_time", `${to}T00:00:00+02:00`)
    .order("start_time", { ascending: true });

  if (error) throw new Error(error.message);
  return (data ?? []) as unknown as CalendarEventWithDomain[];
}

// ----------------------------------------------------------------
// getUpcomingEvents
// Events in the next N days — used by the upcoming section.
// ----------------------------------------------------------------
export async function getUpcomingEvents(days = 7): Promise<CalendarEventWithDomain[]> {
  const supabase  = createClient();
  const tomorrow  = addDays(todayInSAST(), 1);
  const until     = addDays(todayInSAST(), days);

  const { data, error } = await supabase
    .from("calendar_events")
    .select(`*, domain:domains (name, color, icon)`)
    .gte("start_time", `${tomorrow}T00:00:00+02:00`)
    .lt( "start_time", `${until}T00:00:00+02:00`)
    .order("start_time", { ascending: true });

  if (error) throw new Error(error.message);
  return (data ?? []) as unknown as CalendarEventWithDomain[];
}

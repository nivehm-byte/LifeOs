import { google } from "googleapis";
import { GoogleGenerativeAI } from "@google/generative-ai";
import {
  getAuthorizedClient,
  getStoredTokenRow,
  setCorporateEventId,
} from "./google";
import { createServiceClient } from "@/lib/supabase/server";

// ── Corporate block constants ────────────────────────────────────
// 7:30–15:30 SAST (Africa/Johannesburg) weekdays, managed by LifeOS
const CORP_TITLE     = "Corporate Work Block";
const CORP_START     = "07:30:00";
const CORP_END       = "15:30:00";
const CORP_TZ        = "Africa/Johannesburg";
const CORP_RRULE     = "RRULE:FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR";
const CORP_COLOR_ID  = "9"; // Blueberry

// ── Domain helper ────────────────────────────────────────────────

type DomainInfo = { id: string; name: string };

// Uses Gemini Flash to map an event title+description to the best domain.
// Falls back to 'personal' if Gemini is unavailable or returns an unknown name.
async function categorizeDomain(
  title: string,
  description: string | null | undefined,
  domains: DomainInfo[],
): Promise<string> {
  const personalId = domains.find((d) => d.name === "personal")?.id ?? domains[0]?.id;
  if (!process.env.GEMINI_API_KEY || domains.length === 0) return personalId;

  try {
    const gemini = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    const model = gemini.getGenerativeModel({
      model: "gemini-2.0-flash",
      generationConfig: {
        responseMimeType: "application/json",
        temperature: 0.1,
        maxOutputTokens: 64,
      },
    });

    const domainNames = domains.map((d) => d.name).join(", ");
    const prompt = `Categorize this calendar event into exactly one domain.

Available domains: ${domainNames}

Event title: ${title}
Event description: ${description ?? "none"}

Domain hints:
- fitness: gym, workout, run, training, sport, exercise, physio
- corporate: work meeting, standup, corporate, office, board, HR, team, company
- consulting: client call, proposal, invoice, freelance, strategy session, pitch
- personal: birthday, dinner, family, social, travel, hobby, appointment, doctor

Return EXACTLY: {"domain":"<domain_name>"}`;

    const result = await model.generateContent(prompt);
    const raw = JSON.parse(result.response.text()) as { domain: string };
    return domains.find((d) => d.name === raw.domain)?.id ?? personalId;
  } catch {
    return personalId;
  }
}

// ── Corporate block ──────────────────────────────────────────────

// Creates the recurring corporate block in Google Calendar if it doesn't
// already exist (or if the user deleted it). Idempotent.
export async function ensureCorporateBlock(userId: string): Promise<void> {
  const authClient = await getAuthorizedClient(userId);
  const tokenRow   = await getStoredTokenRow(userId);
  const calendar   = google.calendar({ version: "v3", auth: authClient });

  // If we already know the event ID, verify it still exists
  if (tokenRow?.corporate_event_id) {
    try {
      await calendar.events.get({
        calendarId: "primary",
        eventId:    tokenRow.corporate_event_id,
      });
      return; // Event still alive — nothing to do
    } catch {
      // Event was deleted by the user; fall through to recreate
    }
  }

  const startDate = new Date().toISOString().split("T")[0];

  const { data } = await calendar.events.insert({
    calendarId: "primary",
    requestBody: {
      summary:     CORP_TITLE,
      description: "Daily corporate work block — managed by LifeOS",
      start: { dateTime: `${startDate}T${CORP_START}`, timeZone: CORP_TZ },
      end:   { dateTime: `${startDate}T${CORP_END}`,   timeZone: CORP_TZ },
      recurrence: [CORP_RRULE],
      colorId: CORP_COLOR_ID,
    },
  });

  if (data.id) await setCorporateEventId(userId, data.id);
}

// ── Sync FROM Google ─────────────────────────────────────────────

export type SyncFromResult = { inserted: number; updated: number };

// Fetches events from Google Calendar (yesterday → +14 days), upserts into
// calendar_events. New events are categorized by Gemini. Existing events are
// updated (title/times/location) but keep their existing domain.
export async function syncFromGoogle(userId: string): Promise<SyncFromResult> {
  const authClient = await getAuthorizedClient(userId);
  const tokenRow   = await getStoredTokenRow(userId);
  const calendar   = google.calendar({ version: "v3", auth: authClient });
  const supabase   = createServiceClient();

  const { data: domainsData } = await supabase
    .from("domains")
    .select("id, name")
    .eq("user_id", userId);
  const domains: DomainInfo[] = (domainsData ?? []) as DomainInfo[];
  const corporateDomainId = domains.find((d) => d.name === "corporate")?.id;

  const timeMin = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const timeMax = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString();

  const { data: listData } = await calendar.events.list({
    calendarId:  "primary",
    timeMin,
    timeMax,
    singleEvents: true,   // expand recurring events into individual instances
    orderBy:      "startTime",
    maxResults:   250,
  });

  const googleEvents = listData.items ?? [];
  let inserted = 0;
  let updated  = 0;

  for (const gEvent of googleEvents) {
    if (!gEvent.id || gEvent.status === "cancelled") continue;

    const startRaw = gEvent.start?.dateTime ?? gEvent.start?.date;
    const endRaw   = gEvent.end?.dateTime   ?? gEvent.end?.date;
    if (!startRaw || !endRaw) continue;

    const allDay    = !gEvent.start?.dateTime;
    // Ensure all timestamps carry timezone info for Postgres timestamptz
    const startTime = allDay ? `${startRaw}T00:00:00+02:00` : startRaw;
    const endTime   = allDay ? `${endRaw}T00:00:00+02:00`   : endRaw;

    // Detect recurring corporate block instances by prefix match on the event ID
    const isCorporate =
      !!tokenRow?.corporate_event_id &&
      (gEvent.id === tokenRow.corporate_event_id ||
        gEvent.id.startsWith(`${tokenRow.corporate_event_id}_`));

    // Check if we already have this event in the DB
    const { data: existing } = await supabase
      .from("calendar_events")
      .select("id, domain_id")
      .eq("google_event_id", gEvent.id)
      .maybeSingle();

    let domainId: string;
    if (isCorporate && corporateDomainId) {
      domainId = corporateDomainId;
    } else if (existing) {
      domainId = existing.domain_id; // Preserve hand-picked or previously categorized domain
    } else {
      domainId = await categorizeDomain(gEvent.summary ?? "Untitled", gEvent.description, domains);
    }

    if (existing) {
      await supabase
        .from("calendar_events")
        .update({
          title:       gEvent.summary ?? "Untitled",
          description: gEvent.description ?? null,
          start_time:  startTime,
          end_time:    endTime,
          all_day:     allDay,
          location:    gEvent.location ?? null,
          synced_at:   new Date().toISOString(),
        })
        .eq("id", existing.id);
      updated++;
    } else {
      await supabase.from("calendar_events").insert({
        user_id:         userId,
        domain_id:       domainId,
        google_event_id: gEvent.id,
        title:           gEvent.summary ?? "Untitled",
        description:     gEvent.description ?? null,
        start_time:      startTime,
        end_time:        endTime,
        all_day:         allDay,
        location:        gEvent.location ?? null,
        source:          isCorporate ? "lifeos" : "google",
        synced_at:       new Date().toISOString(),
      });
      inserted++;
    }
  }

  return { inserted, updated };
}

// ── Sync TO Google ───────────────────────────────────────────────

export type SyncToResult = { pushed: number };

// Pushes any LifeOS-created events that don't yet have a google_event_id
// to Google Calendar, then stores the returned Google event ID.
export async function syncToGoogle(userId: string): Promise<SyncToResult> {
  const authClient = await getAuthorizedClient(userId);
  const calendar   = google.calendar({ version: "v3", auth: authClient });
  const supabase   = createServiceClient();

  const { data: localEvents } = await supabase
    .from("calendar_events")
    .select("*")
    .eq("user_id", userId)
    .eq("source", "lifeos")
    .is("google_event_id", null);

  let pushed = 0;

  for (const event of localEvents ?? []) {
    const startDate = event.start_time.split("T")[0];
    const endDate   = event.end_time.split("T")[0];

    const { data: gEvent } = await calendar.events.insert({
      calendarId: "primary",
      requestBody: {
        summary:     event.title,
        description: event.description ?? undefined,
        location:    event.location    ?? undefined,
        start: event.all_day
          ? { date: startDate }
          : { dateTime: event.start_time, timeZone: CORP_TZ },
        end: event.all_day
          ? { date: endDate }
          : { dateTime: event.end_time, timeZone: CORP_TZ },
      },
    });

    if (gEvent?.id) {
      await supabase
        .from("calendar_events")
        .update({ google_event_id: gEvent.id, synced_at: new Date().toISOString() })
        .eq("id", event.id);
      pushed++;
    }
  }

  return { pushed };
}

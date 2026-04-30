// Pure date-math helpers for the calendar grid.
// No server imports — safe in "use client" components.

export const DAY_ABBRS  = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] as const;
export const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
] as const;

// ── Primitive helpers ─────────────────────────────────────────────

export function toDateStr(d: Date): string {
  return (
    d.getFullYear() +
    "-" + String(d.getMonth() + 1).padStart(2, "0") +
    "-" + String(d.getDate()).padStart(2, "0")
  );
}

export function shiftDays(d: Date, n: number): Date {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
}

// Parses "YYYY-MM-DD" as local midnight (avoids UTC-offset shift).
export function parseLocalDate(s: string): Date {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, m - 1, d);
}

// ── Week helpers ──────────────────────────────────────────────────

/** Monday of the ISO week that contains `d`. */
export function mondayOf(d: Date): Date {
  const r = new Date(d);
  r.setHours(0, 0, 0, 0);
  const day = r.getDay(); // 0 = Sun
  r.setDate(r.getDate() + (day === 0 ? -6 : 1 - day));
  return r;
}

/** Seven Date objects Mon → Sun for the week containing `anchor`. */
export function weekDays(anchor: Date): Date[] {
  const mon = mondayOf(anchor);
  return Array.from({ length: 7 }, (_, i) => shiftDays(mon, i));
}

/** [from, to) date strings covering the 7-day week. */
export function weekRange(anchor: Date): { from: string; to: string } {
  const days = weekDays(anchor);
  return {
    from: toDateStr(days[0]),
    to:   toDateStr(shiftDays(days[6], 1)), // exclusive: day after Sunday
  };
}

/** Human-readable header: "28 Apr – 4 May 2026" */
export function weekLabel(anchor: Date): string {
  const days = weekDays(anchor);
  const mon  = days[0];
  const sun  = days[6];
  const monStr = mon.getDate() + " " + MONTH_NAMES[mon.getMonth()].slice(0, 3);
  const sunStr = sun.getDate() + " " + MONTH_NAMES[sun.getMonth()].slice(0, 3) + " " + sun.getFullYear();
  return `${monStr} – ${sunStr}`;
}

// ── Month helpers ─────────────────────────────────────────────────

/**
 * Up to 6 rows × 7 columns of Date objects for a complete month grid.
 * Rows start on Monday; may include trailing days from adjacent months.
 */
export function monthGrid(anchor: Date): Date[][] {
  const year     = anchor.getFullYear();
  const month    = anchor.getMonth();
  const firstDay = new Date(year, month, 1);
  const lastDay  = new Date(year, month + 1, 0);
  const start    = mondayOf(firstDay);

  const weeks: Date[][] = [];
  const cur = new Date(start);

  for (let w = 0; w < 6; w++) {
    const week: Date[] = [];
    for (let d = 0; d < 7; d++) {
      week.push(new Date(cur));
      cur.setDate(cur.getDate() + 1);
    }
    weeks.push(week);
    if (w >= 3 && cur > lastDay) break;
  }
  return weeks;
}

/** [from, to) date strings covering the full month grid (may include adj-month days). */
export function monthRange(anchor: Date): { from: string; to: string } {
  const grid = monthGrid(anchor);
  const all  = grid.flat();
  return {
    from: toDateStr(all[0]),
    to:   toDateStr(shiftDays(all[all.length - 1], 1)),
  };
}

// ── Event time formatting ─────────────────────────────────────────

/** Formats a UTC ISO string as "HH:MM" in SAST (Africa/Johannesburg). */
export function formatEventTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("en-ZA", {
    timeZone: "Africa/Johannesburg",
    hour:     "2-digit",
    minute:   "2-digit",
    hour12:   false,
  });
}

/**
 * Returns the SAST date string ("YYYY-MM-DD") for a UTC ISO timestamp.
 * Uses "sv" locale which always emits ISO-format dates.
 */
export function sastDateOf(iso: string): string {
  return new Date(iso).toLocaleDateString("sv", {
    timeZone: "Africa/Johannesburg",
  });
}

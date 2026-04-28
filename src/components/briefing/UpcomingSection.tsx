import { SectionLabel } from "./ScheduleSection";
import { DOMAIN_HEX, PRIORITY_HEX, DOMAIN_ICON } from "@/lib/utils/domain";
import type { TaskWithDomain } from "@/lib/tasks/queries";
import type { CalendarEventWithDomain } from "@/lib/calendar/queries";
import type { Domain } from "@/types/database";

interface Props {
  tasks:  TaskWithDomain[];
  events: CalendarEventWithDomain[];
  today?: string;
}

type UpcomingItem =
  | { kind: "task";  date: string; task:  TaskWithDomain }
  | { kind: "event"; date: string; event: CalendarEventWithDomain };

const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function dayLabel(dateStr: string): string {
  const d    = new Date(dateStr + "T12:00:00+02:00");
  const diff = Math.round(
    (d.getTime() - new Date().setHours(12, 0, 0, 0)) / 86400000
  );
  if (diff === 1) return "Tomorrow";
  return `${DAY_LABELS[d.getDay()]} ${d.getDate()}`;
}

export function UpcomingSection({ tasks, events }: Props) {
  // Merge tasks + events into a single timeline, group by date
  const items: UpcomingItem[] = [
    ...tasks.map((t) => ({ kind: "task"  as const, date: t.due_date!, task:  t })),
    ...events.map((e) => ({ kind: "event" as const, date: e.start_time.slice(0, 10), event: e })),
  ].sort((a, b) => a.date.localeCompare(b.date));

  // Group by date
  const byDate = new Map<string, UpcomingItem[]>();
  for (const item of items) {
    if (!byDate.has(item.date)) byDate.set(item.date, []);
    byDate.get(item.date)!.push(item);
  }

  if (byDate.size === 0) return null;

  return (
    <section>
      <SectionLabel>Upcoming — Next 7 Days</SectionLabel>
      <div className="mt-3 space-y-4">
        {Array.from(byDate.entries()).map(([date, dayItems]) => (
          <div key={date} className="flex gap-4">
            {/* Day label */}
            <div className="w-20 flex-shrink-0 pt-0.5">
              <p className="text-xs font-semibold text-text-secondary">{dayLabel(date)}</p>
              <p className="text-[10px] text-text-muted mt-0.5">
                {new Date(date + "T12:00:00+02:00").toLocaleDateString("en-ZA", {
                  month: "short",
                  day:   "numeric",
                })}
              </p>
            </div>

            {/* Items */}
            <div className="flex-1 space-y-1.5">
              {dayItems.map((item: UpcomingItem, i: number) => (
                <UpcomingRow key={i} item={item} />
              ))}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function UpcomingRow({ item }: { item: UpcomingItem }) {
  if (item.kind === "task") {
    const { task } = item;
    const domainHex  = DOMAIN_HEX[task.domain.name as Domain];
    const priorityHex = PRIORITY_HEX[task.priority];

    return (
      <div className="flex items-center gap-2.5 py-1.5 px-3 rounded-lg bg-surface">
        <span
          className="w-1.5 h-1.5 rounded-full flex-shrink-0"
          style={{ backgroundColor: priorityHex }}
        />
        <span className="flex-1 text-sm text-text-primary truncate">{task.title}</span>
        <span className="text-[10px] flex-shrink-0" style={{ color: domainHex }}>
          {DOMAIN_ICON[task.domain.name as Domain]}
        </span>
      </div>
    );
  }

  const { event } = item;
  const domainHex = DOMAIN_HEX[event.domain.name as Domain];

  return (
    <div className="flex items-center gap-2.5 py-1.5 px-3 rounded-lg bg-surface">
      <span
        className="w-1.5 h-1.5 rounded-full flex-shrink-0"
        style={{ backgroundColor: domainHex }}
      />
      <span className="flex-1 text-sm text-text-primary truncate">{event.title}</span>
      <span className="text-[10px] text-text-muted flex-shrink-0">
        {!event.all_day &&
          new Date(event.start_time).toLocaleTimeString("en-ZA", {
            hour:   "2-digit",
            minute: "2-digit",
            hour12: false,
            timeZone: "Africa/Johannesburg",
          })}
      </span>
    </div>
  );
}

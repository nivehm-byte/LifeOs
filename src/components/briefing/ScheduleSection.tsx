import { formatSASTTime } from "@/lib/utils/date";
import { DOMAIN_HEX, withAlpha } from "@/lib/utils/domain";
import type { CalendarEventWithDomain } from "@/lib/calendar/queries";
import type { Domain } from "@/types/database";

interface Props {
  events: CalendarEventWithDomain[];
}

export function ScheduleSection({ events }: Props) {
  return (
    <section>
      <SectionLabel>Schedule</SectionLabel>
      <div className="mt-3 space-y-px">
        {events.map((event) => (
          <ScheduleItem key={event.id} event={event} />
        ))}
      </div>
    </section>
  );
}

function ScheduleItem({ event }: { event: CalendarEventWithDomain }) {
  const domain     = event.domain.name as Domain;
  const domainHex  = DOMAIN_HEX[domain];
  const startTime  = formatSASTTime(new Date(event.start_time));
  const endTime    = formatSASTTime(new Date(event.end_time));
  const isCorporate = domain === "corporate";

  return (
    <div
      className="flex items-start gap-4 py-3 px-3 rounded-lg"
      style={{ backgroundColor: withAlpha(domainHex, 0.06) }}
    >
      {/* Time */}
      <div className="w-16 flex-shrink-0 pt-0.5">
        <span className="text-sm font-medium tabular-nums text-text-secondary">
          {startTime}
        </span>
      </div>

      {/* Domain dot */}
      <div className="flex-shrink-0 mt-1.5">
        <span
          className="block w-2 h-2 rounded-full"
          style={{ backgroundColor: domainHex }}
        />
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <p
          className="text-sm font-medium leading-snug truncate"
          style={{ color: isCorporate ? "#A89880" : "#F0E6D3" }}
        >
          {event.title}
        </p>
        {!event.all_day && (
          <p className="text-xs text-text-muted mt-0.5">
            {startTime} – {endTime}
          </p>
        )}
        {event.location && (
          <p className="text-xs text-text-muted mt-0.5 truncate">
            {event.location}
          </p>
        )}
      </div>
    </div>
  );
}

export function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3">
      <span className="text-xs font-semibold tracking-[0.15em] uppercase text-text-muted">
        {children}
      </span>
      <div className="flex-1 h-px bg-surface-raised" />
    </div>
  );
}

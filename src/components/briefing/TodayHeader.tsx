import Link              from "next/link";
import { formatSASTDate } from "@/lib/utils/date";

interface Props {
  date:      string; // YYYY-MM-DD
  taskCount: number;
}

export function TodayHeader({ date, taskCount }: Props) {
  const formatted = formatSASTDate(new Date(date + "T12:00:00+02:00"));

  return (
    <header className="pt-2">
      {/* Eyebrow row */}
      <div className="flex items-center justify-between mb-2">
        <p className="text-xs font-medium tracking-[0.2em] uppercase text-text-muted">
          Daily Briefing
        </p>
        <Link
          href="/settings/notifications"
          aria-label="Notification settings"
          className="text-text-muted hover:text-text-secondary transition-colors"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="3"/>
            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
          </svg>
        </Link>
      </div>

      {/* Date heading */}
      <h1 className="font-heading text-4xl leading-tight text-text-primary">
        {formatted}
      </h1>

      {/* Task count pill */}
      {taskCount > 0 && (
        <div className="mt-3 inline-flex items-center gap-1.5">
          <span
            className="w-1.5 h-1.5 rounded-full"
            style={{ backgroundColor: "#D4A96A" }}
          />
          <span className="text-sm text-text-secondary">
            {taskCount} {taskCount === 1 ? "task" : "tasks"} today
          </span>
        </div>
      )}

      {/* Divider */}
      <div className="mt-5 h-px bg-surface-raised" />
    </header>
  );
}

import { SectionLabel } from "./ScheduleSection";
import { DOMAIN_HEX, withAlpha } from "@/lib/utils/domain";
import type { Domain } from "@/types/database";

type ProjectSummary = Awaited<ReturnType<typeof import("@/lib/projects/queries").getActiveProjectsSummary>>[number];

interface Props {
  projects: ProjectSummary[];
}

export function ProjectsStatus({ projects }: Props) {
  if (projects.length === 0) return null;

  return (
    <section>
      <SectionLabel>Active Projects</SectionLabel>
      <div className="mt-3 space-y-2">
        {projects.map((p) => (
          <ProjectRow key={p.id} project={p} />
        ))}
      </div>
    </section>
  );
}

function ProjectRow({ project }: { project: ProjectSummary }) {
  const domain    = project.domain?.name as Domain | undefined;
  const hex       = domain ? DOMAIN_HEX[domain] : "#D4A96A";
  const pct       = project.milestones_total > 0
    ? (project.milestones_completed / project.milestones_total) * 100
    : 0;
  const isPaused  = project.status === "paused";

  return (
    <div
      className="px-4 py-3 rounded-xl"
      style={{ backgroundColor: withAlpha(hex, 0.06), border: `1px solid ${withAlpha(hex, 0.12)}` }}
    >
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-text-primary truncate">{project.title}</p>
          {project.client && (
            <p className="text-xs text-text-muted mt-0.5 truncate">{project.client.name}</p>
          )}
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          {isPaused && (
            <span className="text-[10px] px-1.5 py-0.5 rounded text-text-muted bg-surface-overlay">
              Paused
            </span>
          )}
          {project.overdue_count > 0 && (
            <span className="text-[10px] px-1.5 py-0.5 rounded text-status-urgent bg-status-urgent/10">
              {project.overdue_count} overdue
            </span>
          )}
        </div>
      </div>

      {/* Progress bar */}
      {project.milestones_total > 0 && (
        <div className="space-y-1">
          <div className="h-1 rounded-full bg-surface-overlay overflow-hidden">
            <div
              className="h-1 rounded-full transition-all"
              style={{ width: `${pct}%`, backgroundColor: hex }}
            />
          </div>
          <div className="flex justify-between">
            <p className="text-[10px] text-text-muted">
              {project.milestones_completed}/{project.milestones_total} milestones
            </p>
            {project.next_milestone_due && (
              <p className="text-[10px] text-text-muted">
                Next:{" "}
                {new Date(project.next_milestone_due + "T12:00:00+02:00").toLocaleDateString(
                  "en-ZA",
                  { month: "short", day: "numeric" }
                )}
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

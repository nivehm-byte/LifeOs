import { TaskCard } from "./TaskCard";
import { DOMAIN_HEX, DOMAIN_LABEL, DOMAIN_ICON, withAlpha } from "@/lib/utils/domain";
import type { TaskWithDomain } from "@/lib/tasks/queries";
import type { Domain } from "@/types/database";

interface Props {
  domain: Domain;
  tasks:  TaskWithDomain[];
}

const PRIORITY_RANK = { urgent: 4, high: 3, medium: 2, low: 1 } as const;

export function DomainTaskSection({ domain, tasks }: Props) {
  if (tasks.length === 0) return null;

  const hex = DOMAIN_HEX[domain];
  const sorted = [...tasks].sort(
    (a, b) => PRIORITY_RANK[b.priority] - PRIORITY_RANK[a.priority]
  );

  return (
    <section>
      {/* Domain group header */}
      <div className="flex items-center gap-2.5 mb-2">
        <span className="text-base">{DOMAIN_ICON[domain]}</span>
        <span
          className="text-xs font-semibold tracking-[0.15em] uppercase"
          style={{ color: hex }}
        >
          {DOMAIN_LABEL[domain]}
        </span>
        <span
          className="text-xs tabular-nums px-1.5 py-0.5 rounded-full"
          style={{ backgroundColor: withAlpha(hex, 0.15), color: hex }}
        >
          {tasks.length}
        </span>
        <div
          className="flex-1 h-px"
          style={{ backgroundColor: withAlpha(hex, 0.2) }}
        />
      </div>

      {/* Task list */}
      <div
        className="rounded-xl overflow-hidden"
        style={{
          backgroundColor: withAlpha(hex, 0.05),
          border: `1px solid ${withAlpha(hex, 0.15)}`,
        }}
      >
        {sorted.map((task) => (
          <TaskCard key={task.id} task={task} />
        ))}
      </div>
    </section>
  );
}

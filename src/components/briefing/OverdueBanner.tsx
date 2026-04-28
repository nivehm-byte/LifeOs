import { TaskCard } from "./TaskCard";
import type { TaskWithDomain } from "@/lib/tasks/queries";

interface Props {
  tasks: TaskWithDomain[];
}

export function OverdueBanner({ tasks }: Props) {
  if (tasks.length === 0) return null;

  return (
    <section>
      <div className="flex items-center gap-3 mb-3">
        {/* Red dot */}
        <span className="w-2 h-2 rounded-full bg-status-urgent flex-shrink-0" />
        <span className="text-xs font-semibold tracking-[0.15em] uppercase text-status-urgent">
          Overdue · {tasks.length}
        </span>
        <div className="flex-1 h-px" style={{ backgroundColor: "#E05C5C26" }} />
      </div>

      <div
        className="rounded-xl overflow-hidden"
        style={{ backgroundColor: "#E05C5C0D", border: "1px solid #E05C5C26" }}
      >
        <div className="divide-y" style={{ borderColor: "#E05C5C1A" }}>
          {tasks
            .sort((a, b) => b.escalation_count - a.escalation_count)
            .map((task) => (
              <TaskCard key={task.id} task={task} overdue />
            ))}
        </div>
      </div>
    </section>
  );
}

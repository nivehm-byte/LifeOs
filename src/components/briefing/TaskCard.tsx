"use client";

import { useState, useTransition } from "react";
import { markTaskComplete, markTaskIncomplete } from "@/lib/tasks/actions";
import { DOMAIN_HEX, PRIORITY_HEX, DOMAIN_LABEL, withAlpha } from "@/lib/utils/domain";
import type { TaskWithDomain } from "@/lib/tasks/queries";
import type { Domain } from "@/types/database";

interface Props {
  task:    TaskWithDomain;
  overdue?: boolean;
}

const PRIORITY_DOT_LABEL = { urgent: "!!!", high: "!!", medium: "!", low: "" } as const;

// 0 = normal, 1 = amber (1-2 days), 2 = red (3+ days)
function escalationTier(count: number): 0 | 1 | 2 {
  if (count >= 3) return 2;
  if (count >= 1) return 1;
  return 0;
}

const ESCALATION_HEX = { 0: null, 1: "#E0975C", 2: "#E05C5C" } as const;
const ESCALATION_LABEL = { 0: null, 1: "overdue", 2: "overdue" } as const;

export function TaskCard({ task, overdue = false }: Props) {
  const [done, setDone]     = useState(task.status === "completed");
  const [isPending, start]  = useTransition();

  const domain     = task.domain.name as Domain;
  const domainHex  = DOMAIN_HEX[domain];
  const priorityHex = PRIORITY_HEX[task.priority];
  const tier        = overdue ? escalationTier(task.escalation_count) : 0;
  const urgencyHex  = ESCALATION_HEX[tier];

  function toggle() {
    const next = !done;
    setDone(next); // optimistic
    start(async () => {
      try {
        if (next) await markTaskComplete(task.id);
        else      await markTaskIncomplete(task.id);
      } catch {
        setDone(!next); // revert on error
      }
    });
  }

  return (
    <div
      className="flex items-center gap-3 px-4 py-3.5 transition-opacity"
      style={{
        opacity:     done || isPending ? 0.5 : 1,
        borderLeft:  urgencyHex && !done ? `3px solid ${urgencyHex}` : undefined,
        paddingLeft: urgencyHex && !done ? "13px" : undefined, // 16 - 3
      }}
    >
      {/* Checkbox */}
      <button
        onClick={toggle}
        disabled={isPending}
        aria-label={done ? "Mark incomplete" : "Mark complete"}
        className="flex-shrink-0 w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/50"
        style={{
          borderColor:     done ? domainHex : "#6B5C4A",
          backgroundColor: done ? withAlpha(domainHex, 0.25) : "transparent",
        }}
      >
        {done && (
          <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
            <polyline
              points="1.5,5 4,7.5 8.5,2.5"
              stroke={domainHex}
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        )}
      </button>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <p
          className="text-sm text-text-primary leading-snug"
          style={{ textDecoration: done ? "line-through" : "none", color: done ? "#6B5C4A" : "#F0E6D3" }}
        >
          {task.title}
        </p>

        <div className="flex items-center gap-2 mt-0.5 flex-wrap">
          {/* Domain badge */}
          <span
            className="text-[10px] font-medium"
            style={{ color: domainHex }}
          >
            {DOMAIN_LABEL[domain]}
          </span>

          {/* Overdue escalation badge */}
          {overdue && tier > 0 && urgencyHex && (
            <span
              className="text-[10px] font-semibold px-1.5 py-px rounded-full"
              style={{
                color:           urgencyHex,
                backgroundColor: withAlpha(urgencyHex, 0.15),
              }}
            >
              {task.escalation_count}d {ESCALATION_LABEL[tier]}
            </span>
          )}

          {/* Due time */}
          {task.due_time && (
            <span className="text-[10px] text-text-muted">
              {task.due_time.slice(0, 5)}
            </span>
          )}
        </div>
      </div>

      {/* Priority indicator */}
      {task.priority !== "low" && !done && (
        <div className="flex-shrink-0 flex flex-col items-center gap-0.5">
          <span
            className="w-1.5 h-1.5 rounded-full"
            style={{ backgroundColor: priorityHex }}
          />
          <span className="text-[9px] font-bold" style={{ color: priorityHex }}>
            {PRIORITY_DOT_LABEL[task.priority]}
          </span>
        </div>
      )}
    </div>
  );
}

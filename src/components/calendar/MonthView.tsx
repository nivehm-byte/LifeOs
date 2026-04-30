"use client";

import { useState } from "react";
import { toDateStr, DAY_ABBRS, sastDateOf } from "@/lib/utils/calendar";
import type { TaskWithDomain }          from "@/lib/tasks/queries";
import type { CalendarEventWithDomain } from "@/lib/calendar/queries";

interface MonthViewProps {
  weeks:       Date[][];
  tasks:       TaskWithDomain[];
  events:      CalendarEventWithDomain[];
  today:       string;
  anchorMonth: number; // 0-based month to grey out adjacent-month days
  onCellClick: (dateStr: string) => void;
  draggingId:  string | null;
  onDragStart: (e: React.DragEvent, taskId: string) => void;
  onDragEnd:   () => void;
  onTaskDrop:  (taskId: string, dateStr: string) => void;
}

export function MonthView({
  weeks, tasks, events, today, anchorMonth,
  onCellClick, draggingId, onDragStart, onDragEnd, onTaskDrop,
}: MonthViewProps) {
  return (
    <div>
      {/* Day-of-week headers */}
      <div className="grid grid-cols-7 mb-1">
        {DAY_ABBRS.map((d) => (
          <div key={d} className="text-center py-1.5">
            <span
              className="text-[9px] font-semibold tracking-widest uppercase"
              style={{ color: "#6B5C4A" }}
            >
              {d.slice(0, 1)}
            </span>
          </div>
        ))}
      </div>

      {/* Weeks */}
      <div className="space-y-px">
        {weeks.map((week, wi) => (
          <div key={wi} className="grid grid-cols-7 gap-px">
            {week.map((day) => {
              const dateStr      = toDateStr(day);
              const isToday      = dateStr === today;
              const isThisMonth  = day.getMonth() === anchorMonth;
              const dayTasks     = tasks
                .filter((t) => t.due_date === dateStr && t.status !== "cancelled")
                .sort((a, b) => {
                  const o = { urgent: 0, high: 1, medium: 2, low: 3 };
                  return (o[a.priority] ?? 2) - (o[b.priority] ?? 2);
                });
              const dayEvents = events.filter((e) => sastDateOf(e.start_time) === dateStr);
              const allItems  = [
                ...dayEvents.map((e) => ({ type: "event" as const, color: e.domain.color, title: e.title, id: e.id, task: null })),
                ...dayTasks.map( (t) => ({ type: "task"  as const, color: t.domain.color, title: t.title, id: t.id, task: t  })),
              ];
              const visible  = allItems.slice(0, 3);
              const overflow = allItems.length - visible.length;

              return (
                <MonthCell
                  key={dateStr}
                  day={day}
                  dateStr={dateStr}
                  isToday={isToday}
                  isThisMonth={isThisMonth}
                  items={visible}
                  overflow={overflow}
                  draggingId={draggingId}
                  onCellClick={onCellClick}
                  onDragStart={onDragStart}
                  onDragEnd={onDragEnd}
                  onTaskDrop={onTaskDrop}
                />
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Month cell ────────────────────────────────────────────────────

type CellItem = {
  type:  "event" | "task";
  color: string;
  title: string;
  id:    string;
  task:  TaskWithDomain | null;
};

interface MonthCellProps {
  day:         Date;
  dateStr:     string;
  isToday:     boolean;
  isThisMonth: boolean;
  items:       CellItem[];
  overflow:    number;
  draggingId:  string | null;
  onCellClick: (dateStr: string) => void;
  onDragStart: (e: React.DragEvent, taskId: string) => void;
  onDragEnd:   () => void;
  onTaskDrop:  (taskId: string, dateStr: string) => void;
}

function MonthCell({
  day, dateStr, isToday, isThisMonth, items, overflow, draggingId,
  onCellClick, onDragStart, onDragEnd, onTaskDrop,
}: MonthCellProps) {
  const [isDropTarget, setIsDropTarget] = useState(false);

  return (
    <div
      className="rounded-lg overflow-hidden transition-colors"
      style={{
        backgroundColor: isDropTarget ? "#D4A96A0A" : "#13110E",
        border:          `1px solid ${isDropTarget ? "#D4A96A30" : "#1E1A14"}`,
        minHeight:       "72px",
      }}
      onDragOver={(e) => { e.preventDefault(); setIsDropTarget(true); }}
      onDragLeave={() => setIsDropTarget(false)}
      onDrop={(e) => {
        e.preventDefault();
        setIsDropTarget(false);
        const id = e.dataTransfer.getData("taskId");
        if (id) onTaskDrop(id, dateStr);
      }}
    >
      {/* Date number */}
      <button
        onClick={() => onCellClick(dateStr)}
        className="w-full flex items-center justify-between px-2 pt-1.5 pb-1 group"
      >
        <span
          className="w-6 h-6 flex items-center justify-center rounded-full text-xs font-semibold transition-colors"
          style={{
            backgroundColor: isToday ? "#D4A96A" : "transparent",
            color: isToday
              ? "#0F0C09"
              : isThisMonth
              ? "#C8B89A"
              : "#3D3328",
          }}
        >
          {day.getDate()}
        </span>
        <span
          className="text-[9px] opacity-0 group-hover:opacity-100 transition-opacity"
          style={{ color: "#D4A96A" }}
        >
          +
        </span>
      </button>

      {/* Item dots/pills */}
      <div className="px-1.5 pb-1.5 space-y-0.5">
        {items.map((item) =>
          item.type === "task" && item.task ? (
            <DraggableTaskDot
              key={item.id}
              task={item.task}
              isDragging={draggingId === item.id}
              onDragStart={onDragStart}
              onDragEnd={onDragEnd}
            />
          ) : (
            <EventDot key={item.id} color={item.color} title={item.title} />
          )
        )}
        {overflow > 0 && (
          <p
            className="text-[9px] font-medium px-1"
            style={{ color: "#6B5C4A" }}
          >
            +{overflow} more
          </p>
        )}
      </div>
    </div>
  );
}

// ── Dot components ────────────────────────────────────────────────

function EventDot({ color, title }: { color: string; title: string }) {
  return (
    <div
      className="w-full flex items-center gap-1 rounded px-1 py-0.5 overflow-hidden"
      style={{ backgroundColor: `${color}18` }}
      title={title}
    >
      <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: color }} />
      <span className="text-[9px] truncate leading-tight" style={{ color: "#A89880" }}>
        {title}
      </span>
    </div>
  );
}

interface DraggableTaskDotProps {
  task:        TaskWithDomain;
  isDragging:  boolean;
  onDragStart: (e: React.DragEvent, taskId: string) => void;
  onDragEnd:   () => void;
}

function DraggableTaskDot({ task, isDragging, onDragStart, onDragEnd }: DraggableTaskDotProps) {
  const done = task.status === "completed";
  return (
    <div
      draggable
      onDragStart={(e) => onDragStart(e, task.id)}
      onDragEnd={onDragEnd}
      className="w-full flex items-center gap-1 rounded px-1 py-0.5 overflow-hidden cursor-grab active:cursor-grabbing"
      style={{
        backgroundColor: `${task.domain.color}14`,
        opacity:         isDragging ? 0.35 : 1,
      }}
      title={task.title}
    >
      <span
        className="w-1.5 h-1.5 rounded-full shrink-0"
        style={{ backgroundColor: done ? "transparent" : task.domain.color }}
      />
      <span
        className="text-[9px] truncate leading-tight"
        style={{
          color:          done ? "#6B5C4A" : "#A89880",
          textDecoration: done ? "line-through" : "none",
        }}
      >
        {task.title}
      </span>
    </div>
  );
}

"use client";

import { useState } from "react";
import {
  toDateStr,
  DAY_ABBRS,
  formatEventTime,
  sastDateOf,
} from "@/lib/utils/calendar";
import type { TaskWithDomain }          from "@/lib/tasks/queries";
import type { CalendarEventWithDomain } from "@/lib/calendar/queries";

const PRIORITY_COLOR: Record<string, string> = {
  low:    "#7DB87A",
  medium: "#D4A96A",
  high:   "#E0975C",
  urgent: "#E05C5C",
};

interface WeekViewProps {
  days:          Date[];
  tasks:         TaskWithDomain[];
  events:        CalendarEventWithDomain[];
  today:         string;
  onCellClick:   (dateStr: string) => void;
  draggingId:    string | null;
  onDragStart:   (e: React.DragEvent, taskId: string) => void;
  onDragEnd:     () => void;
  onTaskDrop:    (taskId: string, dateStr: string) => void;
}

export function WeekView({
  days, tasks, events, today,
  onCellClick, draggingId, onDragStart, onDragEnd, onTaskDrop,
}: WeekViewProps) {
  return (
    <div className="-mx-4 overflow-x-auto pb-1">
      <div className="flex gap-px px-4" style={{ minWidth: "max-content" }}>
        {days.map((day, i) => {
          const dateStr  = toDateStr(day);
          const isToday  = dateStr === today;
          const dayTasks = tasks
            .filter((t) => t.due_date === dateStr && t.status !== "cancelled")
            .sort((a, b) => {
              const order = { urgent: 0, high: 1, medium: 2, low: 3 };
              return (order[a.priority] ?? 2) - (order[b.priority] ?? 2);
            });
          const dayEvents = events
            .filter((e) => sastDateOf(e.start_time) === dateStr)
            .sort((a, b) => a.start_time.localeCompare(b.start_time));

          return (
            <DayColumn
              key={dateStr}
              day={day}
              dayAbbr={DAY_ABBRS[i]}
              dateStr={dateStr}
              isToday={isToday}
              tasks={dayTasks}
              events={dayEvents}
              draggingId={draggingId}
              onCellClick={onCellClick}
              onDragStart={onDragStart}
              onDragEnd={onDragEnd}
              onTaskDrop={onTaskDrop}
            />
          );
        })}
      </div>
    </div>
  );
}

// ── Day column ────────────────────────────────────────────────────

interface DayColProps {
  day:         Date;
  dayAbbr:     string;
  dateStr:     string;
  isToday:     boolean;
  tasks:       TaskWithDomain[];
  events:      CalendarEventWithDomain[];
  draggingId:  string | null;
  onCellClick: (dateStr: string) => void;
  onDragStart: (e: React.DragEvent, taskId: string) => void;
  onDragEnd:   () => void;
  onTaskDrop:  (taskId: string, dateStr: string) => void;
}

function DayColumn({
  day, dayAbbr, dateStr, isToday, tasks, events,
  draggingId, onCellClick, onDragStart, onDragEnd, onTaskDrop,
}: DayColProps) {
  const [isDropTarget, setIsDropTarget] = useState(false);
  const isEmpty = tasks.length === 0 && events.length === 0;

  return (
    <div style={{ width: "110px" }}>
      {/* Clickable header — opens add modal */}
      <button
        onClick={() => onCellClick(dateStr)}
        className="w-full flex flex-col items-center gap-1 py-2.5 rounded-t-xl transition-colors hover:bg-surface-raised group"
        style={{ backgroundColor: "#1A1510" }}
        title={`Add task on ${dateStr}`}
      >
        <span
          className="text-[9px] font-semibold tracking-widest uppercase"
          style={{ color: isToday ? "#D4A96A" : "#6B5C4A" }}
        >
          {dayAbbr}
        </span>
        <span
          className="w-7 h-7 flex items-center justify-center rounded-full text-sm font-semibold transition-colors"
          style={{
            backgroundColor: isToday ? "#D4A96A" : "transparent",
            color:           isToday ? "#0F0C09" : "#F0E6D3",
          }}
        >
          {day.getDate()}
        </span>
        {/* "+" hint on hover */}
        <span
          className="text-[10px] opacity-0 group-hover:opacity-100 transition-opacity"
          style={{ color: "#D4A96A" }}
        >
          +
        </span>
      </button>

      {/* Items + drop zone */}
      <div
        className="rounded-b-xl p-1.5 space-y-1 transition-colors"
        style={{
          backgroundColor: isDropTarget
            ? "#D4A96A0A"
            : "#13110E",
          border:    `1px solid ${isDropTarget ? "#D4A96A30" : "#1E1A14"}`,
          borderTop: "none",
          minHeight: "160px",
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
        {/* Calendar events */}
        {events.map((ev) => (
          <EventPill key={ev.id} event={ev} />
        ))}

        {/* Task pills */}
        {tasks.map((task) => (
          <TaskPill
            key={task.id}
            task={task}
            isDragging={draggingId === task.id}
            onDragStart={onDragStart}
            onDragEnd={onDragEnd}
          />
        ))}

        {/* Drop hint — only when dragging over an empty or non-source column */}
        {draggingId && isEmpty && (
          <div
            className="w-full rounded-lg border border-dashed flex items-center justify-center py-3"
            style={{ borderColor: "#D4A96A30" }}
          >
            <span className="text-[9px]" style={{ color: "#D4A96A60" }}>drop here</span>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Event pill ────────────────────────────────────────────────────

function EventPill({ event }: { event: CalendarEventWithDomain }) {
  const color = event.domain.color;
  const time  = event.all_day ? null : formatEventTime(event.start_time);

  return (
    <div
      className="w-full rounded-md px-1.5 py-1 overflow-hidden"
      style={{
        backgroundColor: `${color}14`,
        borderLeft:      `2px solid ${color}`,
      }}
    >
      {time && (
        <p className="text-[9px] font-medium mb-0.5 tabular-nums" style={{ color: `${color}CC` }}>
          {time}
        </p>
      )}
      <p
        className="text-[10px] font-medium leading-tight line-clamp-2"
        style={{ color: "#C8B89A" }}
      >
        {event.title}
      </p>
    </div>
  );
}

// ── Task pill ─────────────────────────────────────────────────────

interface TaskPillProps {
  task:        TaskWithDomain;
  isDragging:  boolean;
  onDragStart: (e: React.DragEvent, taskId: string) => void;
  onDragEnd:   () => void;
}

function TaskPill({ task, isDragging, onDragStart, onDragEnd }: TaskPillProps) {
  const color    = task.domain.color;
  const priColor = PRIORITY_COLOR[task.priority] ?? "#D4A96A";
  const done     = task.status === "completed";

  return (
    <div
      draggable
      onDragStart={(e) => onDragStart(e, task.id)}
      onDragEnd={onDragEnd}
      className="w-full rounded-md px-1.5 py-1 cursor-grab active:cursor-grabbing overflow-hidden"
      style={{
        backgroundColor: done ? `${color}08` : `${color}14`,
        borderLeft:      `2px solid ${done ? color + "40" : color}`,
        opacity:         isDragging ? 0.35 : 1,
      }}
      title={task.title}
    >
      <div className="flex items-start gap-1">
        {/* Priority dot */}
        <span
          className="mt-[3px] shrink-0 w-1.5 h-1.5 rounded-full"
          style={{ backgroundColor: done ? "transparent" : priColor }}
        />
        <p
          className="text-[10px] font-medium leading-tight line-clamp-2"
          style={{
            color:          done ? "#6B5C4A" : "#C8B89A",
            textDecoration: done ? "line-through" : "none",
          }}
        >
          {task.title}
        </p>
      </div>
    </div>
  );
}

"use client";

import Link from "next/link";
import type { ClientRow } from "@/lib/clients/queries";
import type { PipelineStage } from "@/types/database";

const STAGE_COLOR: Record<PipelineStage, string> = {
  discovery: "#7BA8C4",
  proposal:  "#D4A96A",
  contract:  "#E0975C",
  active:    "#7DB87A",
  delivery:  "#D4845A",
  closed:    "#A89880",
};

interface Props {
  client:        ClientRow;
  projectCount:  number;
  isDragging:    boolean;
  onDragStart:   (e: React.DragEvent, id: string) => void;
  onDragEnd:     () => void;
}

export function ClientCard({ client, projectCount, isDragging, onDragStart, onDragEnd }: Props) {
  const color = STAGE_COLOR[client.pipeline_stage as PipelineStage];

  return (
    <div
      draggable
      onDragStart={(e) => onDragStart(e, client.id)}
      onDragEnd={onDragEnd}
      className="rounded-xl p-3 cursor-grab active:cursor-grabbing select-none transition-all"
      style={{
        backgroundColor: isDragging ? `${color}18` : "#1A1510",
        border:          `1px solid ${isDragging ? color : "#241E17"}`,
        opacity:          isDragging ? 0.5 : 1,
        transform:        isDragging ? "rotate(2deg) scale(1.02)" : "none",
      }}
    >
      {/* Name + detail link */}
      <div className="flex items-start justify-between gap-2 mb-2">
        <Link
          href={`/clients/${client.id}`}
          className="font-medium text-sm leading-snug hover:underline"
          style={{ color: "#F0E6D3" }}
          onClick={(e) => e.stopPropagation()}
        >
          {client.name}
        </Link>
        {projectCount > 0 && (
          <span
            className="shrink-0 text-[10px] font-semibold px-1.5 py-0.5 rounded-md"
            style={{ backgroundColor: `${color}26`, color }}
          >
            {projectCount}p
          </span>
        )}
      </div>

      {/* Company */}
      {client.company && (
        <p className="text-xs mb-1.5 truncate" style={{ color: "#A89880" }}>
          {client.company}
        </p>
      )}

      {/* Email */}
      <p className="text-[11px] truncate" style={{ color: "#6B5C4A" }}>
        {client.email}
      </p>
    </div>
  );
}

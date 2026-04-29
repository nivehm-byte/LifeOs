"use client";

import { useState, useTransition } from "react";
import { ClientCard } from "./ClientCard";
import { AddClientModal } from "./AddClientModal";
import { moveClientStageAction } from "@/lib/clients/actions";
import type { ClientRow } from "@/lib/clients/queries";
import type { PipelineStage } from "@/types/database";

const STAGES: Array<{ key: PipelineStage; label: string; color: string }> = [
  { key: "discovery", label: "Discovery", color: "#7BA8C4" },
  { key: "proposal",  label: "Proposal",  color: "#D4A96A" },
  { key: "contract",  label: "Contract",  color: "#E0975C" },
  { key: "active",    label: "Active",    color: "#7DB87A" },
  { key: "delivery",  label: "Delivery",  color: "#D4845A" },
  { key: "closed",    label: "Closed",    color: "#A89880" },
];

interface Props {
  initialClients: ClientRow[];
  projectCounts:  Record<string, number>;
}

export function ClientKanban({ initialClients, projectCounts }: Props) {
  const [clients,      setClients]      = useState(initialClients);
  const [dragId,       setDragId]       = useState<string | null>(null);
  const [dropTarget,   setDropTarget]   = useState<PipelineStage | null>(null);
  const [showAdd,      setShowAdd]      = useState(false);
  const [,             startTransition] = useTransition();

  // ── Drag handlers ──────────────────────────────────────────────

  function handleDragStart(e: React.DragEvent, clientId: string) {
    setDragId(clientId);
    e.dataTransfer.effectAllowed = "move";
  }

  function handleDragEnd() {
    setDragId(null);
    setDropTarget(null);
  }

  function handleDragOver(e: React.DragEvent, stage: PipelineStage) {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    setDropTarget(stage);
  }

  function handleDragLeave(e: React.DragEvent) {
    // Only clear when leaving the column itself, not child elements
    if (!e.currentTarget.contains(e.relatedTarget as Node)) {
      setDropTarget(null);
    }
  }

  function handleDrop(e: React.DragEvent, targetStage: PipelineStage) {
    e.preventDefault();
    if (!dragId) return;

    const draggedClient = clients.find((c) => c.id === dragId);
    if (!draggedClient || draggedClient.pipeline_stage === targetStage) {
      setDragId(null);
      setDropTarget(null);
      return;
    }

    // Optimistic update
    setClients((prev) =>
      prev.map((c) =>
        c.id === dragId ? { ...c, pipeline_stage: targetStage } : c,
      ),
    );
    setDragId(null);
    setDropTarget(null);

    startTransition(async () => {
      try {
        await moveClientStageAction(dragId, targetStage);
      } catch {
        // Roll back on failure
        setClients((prev) =>
          prev.map((c) =>
            c.id === dragId
              ? { ...c, pipeline_stage: draggedClient.pipeline_stage }
              : c,
          ),
        );
      }
    });
  }

  // ── Render ─────────────────────────────────────────────────────

  return (
    <>
      {/* Header row */}
      <div className="flex items-center justify-between mb-4">
        <h1 className="font-heading text-2xl text-text-primary">Clients</h1>
        <button
          onClick={() => setShowAdd(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-all active:scale-[0.97]"
          style={{ backgroundColor: "#D4A96A26", color: "#D4A96A", border: "1px solid #D4A96A40" }}
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <line x1="7" y1="1" x2="7" y2="13"/>
            <line x1="1" y1="7" x2="13" y2="7"/>
          </svg>
          Add client
        </button>
      </div>

      {/* Kanban — negative margin to break out of px-4 container */}
      <div className="-mx-4 overflow-x-auto pb-4">
        <div className="flex gap-3 px-4" style={{ minWidth: "max-content" }}>
          {STAGES.map(({ key, label, color }) => {
            const stageClients = clients.filter((c) => c.pipeline_stage === key);
            const isDropTarget = dropTarget === key;

            return (
              <div
                key={key}
                onDragOver={(e) => handleDragOver(e, key)}
                onDragLeave={handleDragLeave}
                onDrop={(e) => handleDrop(e, key)}
                className="flex flex-col rounded-xl transition-all"
                style={{
                  width:           "180px",
                  minHeight:       "240px",
                  backgroundColor: isDropTarget ? `${color}14` : "#1A1510",
                  border:          `1px solid ${isDropTarget ? color : "#241E17"}`,
                  padding:         "10px",
                }}
              >
                {/* Column header */}
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <span
                      className="w-2 h-2 rounded-full"
                      style={{ backgroundColor: color }}
                    />
                    <span className="text-xs font-semibold tracking-wide uppercase" style={{ color }}>
                      {label}
                    </span>
                  </div>
                  {stageClients.length > 0 && (
                    <span className="text-xs tabular-nums" style={{ color: "#6B5C4A" }}>
                      {stageClients.length}
                    </span>
                  )}
                </div>

                {/* Cards */}
                <div className="flex flex-col gap-2 flex-1">
                  {stageClients.map((client) => (
                    <ClientCard
                      key={client.id}
                      client={client}
                      projectCount={projectCounts[client.id] ?? 0}
                      isDragging={dragId === client.id}
                      onDragStart={handleDragStart}
                      onDragEnd={handleDragEnd}
                    />
                  ))}

                  {/* Drop zone hint */}
                  {isDropTarget && dragId && stageClients.every((c) => c.id !== dragId) && (
                    <div
                      className="rounded-lg border-2 border-dashed h-16 flex items-center justify-center"
                      style={{ borderColor: `${color}60` }}
                    >
                      <span className="text-xs" style={{ color: `${color}80` }}>
                        Drop here
                      </span>
                    </div>
                  )}

                  {/* Empty column placeholder */}
                  {stageClients.length === 0 && !isDropTarget && (
                    <div className="flex-1 flex items-center justify-center">
                      <span className="text-xs" style={{ color: "#6B5C4A" }}>—</span>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {showAdd && <AddClientModal onClose={() => setShowAdd(false)} />}
    </>
  );
}

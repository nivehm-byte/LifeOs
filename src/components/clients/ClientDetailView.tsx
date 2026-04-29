"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { deleteClientAction } from "@/lib/clients/actions";
import { useRouter } from "next/navigation";
import type { ClientDetail } from "@/lib/clients/queries";
import type { PipelineStage, DeliverableStatus, MilestoneStatus } from "@/types/database";

const STAGE_COLOR: Record<PipelineStage, string> = {
  discovery: "#7BA8C4",
  proposal:  "#D4A96A",
  contract:  "#E0975C",
  active:    "#7DB87A",
  delivery:  "#D4845A",
  closed:    "#A89880",
};

const STAGE_LABEL: Record<PipelineStage, string> = {
  discovery: "Discovery",
  proposal:  "Proposal",
  contract:  "Contract",
  active:    "Active",
  delivery:  "Delivery",
  closed:    "Closed",
};

const MILESTONE_COLORS: Record<MilestoneStatus, string> = {
  upcoming:      "#7BA8C4",
  "in-progress": "#D4A96A",
  completed:     "#7DB87A",
  overdue:       "#E05C5C",
};

const DELIVERABLE_COLORS: Record<DeliverableStatus, string> = {
  draft:       "#6B5C4A",
  "in-review": "#D4A96A",
  approved:    "#7DB87A",
  delivered:   "#7DB87A",
};

type ActiveTab = "projects" | "documents";

export function ClientDetailView({ client }: { client: ClientDetail }) {
  const router                 = useRouter();
  const [tab,      setTab]     = useState<ActiveTab>("projects");
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [,         start]      = useTransition();
  const stageColor             = STAGE_COLOR[client.pipeline_stage as PipelineStage];

  function toggleProject(id: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) { next.delete(id); } else { next.add(id); }
      return next;
    });
  }

  function handleDelete() {
    if (!confirm(`Delete ${client.name}? This removes all linked projects and deliverables.`)) return;
    start(async () => {
      await deleteClientAction(client.id);
      router.push("/clients");
    });
  }

  const allDocuments = client.projects.flatMap((p) => p.documents);
  const totalProjects    = client.projects.length;
  const openMilestones   = client.projects
    .flatMap((p) => p.milestones)
    .filter((m) => m.status !== "completed").length;

  return (
    <div className="space-y-6">
      {/* ── Back link ─────────────────────────────────────────── */}
      <Link
        href="/clients"
        className="inline-flex items-center gap-1.5 text-sm transition-colors"
        style={{ color: "#6B5C4A" }}
      >
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="9 11 5 7 9 3"/>
        </svg>
        All clients
      </Link>

      {/* ── Client header ──────────────────────────────────────── */}
      <div
        className="rounded-2xl p-5"
        style={{ backgroundColor: "#1A1510", border: `1px solid ${stageColor}40` }}
      >
        <div className="flex items-start justify-between gap-3 mb-4">
          <div>
            <h1 className="font-heading text-2xl text-text-primary leading-tight">
              {client.name}
            </h1>
            {client.company && (
              <p className="text-sm mt-0.5" style={{ color: "#A89880" }}>
                {client.company}
              </p>
            )}
          </div>
          <span
            className="shrink-0 text-xs font-semibold px-2.5 py-1 rounded-lg"
            style={{ backgroundColor: `${stageColor}26`, color: stageColor }}
          >
            {STAGE_LABEL[client.pipeline_stage as PipelineStage]}
          </span>
        </div>

        {/* Contact */}
        <div className="flex flex-col gap-1.5 mb-4">
          <a
            href={`mailto:${client.email}`}
            className="text-sm transition-colors hover:underline"
            style={{ color: "#A89880" }}
          >
            {client.email}
          </a>
          {client.phone && (
            <a
              href={`tel:${client.phone}`}
              className="text-sm"
              style={{ color: "#A89880" }}
            >
              {client.phone}
            </a>
          )}
        </div>

        {/* Stats row */}
        <div className="flex gap-4 mb-4">
          <Stat label="Projects"   value={totalProjects} />
          <Stat label="Open items" value={openMilestones} />
          <Stat label="Documents"  value={allDocuments.length} />
        </div>

        {/* Notes */}
        {client.notes && (
          <p className="text-sm leading-relaxed" style={{ color: "#A89880" }}>
            {client.notes}
          </p>
        )}
      </div>

      {/* ── Tabs ───────────────────────────────────────────────── */}
      <div className="flex gap-1 p-1 rounded-xl" style={{ backgroundColor: "#1A1510", border: "1px solid #241E17" }}>
        {(["projects", "documents"] as ActiveTab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className="flex-1 py-2 text-sm font-medium rounded-lg capitalize transition-all"
            style={{
              backgroundColor: tab === t ? "#241E17" : "transparent",
              color:           tab === t ? "#F0E6D3"  : "#6B5C4A",
            }}
          >
            {t}
            {t === "documents" && allDocuments.length > 0 && (
              <span className="ml-1.5 text-xs tabular-nums opacity-60">
                ({allDocuments.length})
              </span>
            )}
          </button>
        ))}
      </div>

      {/* ── Projects tab ───────────────────────────────────────── */}
      {tab === "projects" && (
        <div className="space-y-3">
          {client.projects.length === 0 ? (
            <p className="text-center py-10 text-sm" style={{ color: "#6B5C4A" }}>
              No projects yet. Link a project from the Projects tab.
            </p>
          ) : (
            client.projects.map((project) => {
              const isOpen     = expanded.has(project.id);
              const milestones = project.milestones;
              const completed  = milestones.filter((m) => m.status === "completed").length;

              return (
                <div
                  key={project.id}
                  className="rounded-xl overflow-hidden"
                  style={{ backgroundColor: "#1A1510", border: "1px solid #241E17" }}
                >
                  {/* Project row */}
                  <button
                    onClick={() => toggleProject(project.id)}
                    className="w-full flex items-center justify-between px-4 py-3.5 text-left transition-colors hover:bg-surface-raised/40"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <svg
                        width="14"
                        height="14"
                        viewBox="0 0 14 14"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.8"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        className="shrink-0 transition-transform"
                        style={{
                          color:     "#6B5C4A",
                          transform: isOpen ? "rotate(90deg)" : "none",
                        }}
                      >
                        <polyline points="5 3 9 7 5 11"/>
                      </svg>
                      <span className="font-medium text-sm truncate" style={{ color: "#F0E6D3" }}>
                        {project.title}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 shrink-0 ml-2">
                      {milestones.length > 0 && (
                        <span className="text-xs tabular-nums" style={{ color: "#6B5C4A" }}>
                          {completed}/{milestones.length}
                        </span>
                      )}
                      <StatusPill status={project.status} />
                    </div>
                  </button>

                  {/* Milestones */}
                  {isOpen && (
                    <div className="px-4 pb-3 space-y-2 border-t" style={{ borderColor: "#241E17" }}>
                      {milestones.length === 0 ? (
                        <p className="pt-3 text-xs" style={{ color: "#6B5C4A" }}>No milestones</p>
                      ) : (
                        milestones.map((ms) => (
                          <div key={ms.id} className="pt-3">
                            {/* Milestone header */}
                            <div className="flex items-center justify-between mb-1.5">
                              <div className="flex items-center gap-2">
                                <span
                                  className="w-1.5 h-1.5 rounded-full"
                                  style={{ backgroundColor: MILESTONE_COLORS[ms.status as MilestoneStatus] }}
                                />
                                <span className="text-sm font-medium" style={{ color: "#F0E6D3" }}>
                                  {ms.title}
                                </span>
                              </div>
                              {ms.due_date && (
                                <span className="text-[11px]" style={{ color: "#6B5C4A" }}>
                                  {new Date(ms.due_date).toLocaleDateString("en-ZA", { day: "numeric", month: "short" })}
                                </span>
                              )}
                            </div>

                            {/* Deliverables */}
                            {ms.deliverables.length > 0 && (
                              <div className="pl-3.5 space-y-1 border-l" style={{ borderColor: "#241E17" }}>
                                {ms.deliverables.map((d) => (
                                  <div
                                    key={d.id}
                                    className="flex items-center justify-between py-0.5"
                                  >
                                    <span className="text-xs truncate" style={{ color: "#A89880" }}>
                                      {d.title}
                                    </span>
                                    <span
                                      className="shrink-0 text-[10px] font-medium px-1.5 py-0.5 rounded ml-2"
                                      style={{
                                        backgroundColor: `${DELIVERABLE_COLORS[d.status as DeliverableStatus]}22`,
                                        color:            DELIVERABLE_COLORS[d.status as DeliverableStatus],
                                      }}
                                    >
                                      {d.status}
                                    </span>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        ))
                      )}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      )}

      {/* ── Documents tab ──────────────────────────────────────── */}
      {tab === "documents" && (
        <div className="space-y-2">
          {allDocuments.length === 0 ? (
            <p className="text-center py-10 text-sm" style={{ color: "#6B5C4A" }}>
              No documents uploaded yet.
            </p>
          ) : (
            allDocuments.map((doc) => (
              <div
                key={doc.id}
                className="flex items-center justify-between px-4 py-3 rounded-xl"
                style={{ backgroundColor: "#1A1510", border: "1px solid #241E17" }}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <DocIcon fileType={doc.file_type} />
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate" style={{ color: "#F0E6D3" }}>
                      {doc.title}
                    </p>
                    <p className="text-[11px] capitalize" style={{ color: "#6B5C4A" }}>
                      {doc.document_type} · {doc.file_type}
                    </p>
                  </div>
                </div>
                <span className="text-[11px] tabular-nums shrink-0 ml-2" style={{ color: "#6B5C4A" }}>
                  {new Date(doc.uploaded_at).toLocaleDateString("en-ZA", { day: "numeric", month: "short" })}
                </span>
              </div>
            ))
          )}
        </div>
      )}

      {/* ── Danger zone ────────────────────────────────────────── */}
      <div className="pt-4 border-t" style={{ borderColor: "#241E17" }}>
        <button
          onClick={handleDelete}
          className="text-xs transition-colors hover:underline"
          style={{ color: "#6B5C4A" }}
        >
          Delete client
        </button>
      </div>
    </div>
  );
}

// ── Small helpers ────────────────────────────────────────────────

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <p className="text-lg font-semibold tabular-nums" style={{ color: "#F0E6D3" }}>{value}</p>
      <p className="text-[11px]" style={{ color: "#6B5C4A" }}>{label}</p>
    </div>
  );
}

function StatusPill({ status }: { status: string }) {
  const colors: Record<string, string> = {
    active:    "#7DB87A",
    paused:    "#D4A96A",
    completed: "#A89880",
    archived:  "#6B5C4A",
  };
  const color = colors[status] ?? "#6B5C4A";
  return (
    <span
      className="text-[10px] font-semibold px-1.5 py-0.5 rounded capitalize"
      style={{ backgroundColor: `${color}22`, color }}
    >
      {status}
    </span>
  );
}

function DocIcon({ fileType }: { fileType: string }) {
  return (
    <div
      className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
      style={{ backgroundColor: "#241E17" }}
    >
      <span className="text-xs font-bold uppercase" style={{ color: "#6B5C4A" }}>
        {fileType.slice(0, 3)}
      </span>
    </div>
  );
}

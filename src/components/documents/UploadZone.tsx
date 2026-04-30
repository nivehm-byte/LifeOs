"use client";

import { useRef, useState, useTransition } from "react";
import type { DomainInfo, ProjectInfo, DocumentWithRelations } from "@/lib/documents/tree";
import type { DocumentType } from "@/types/database";

const DOC_TYPES: { value: DocumentType; label: string }[] = [
  { value: "other",          label: "Document"      },
  { value: "proposal",       label: "Proposal"      },
  { value: "contract",       label: "Contract"      },
  { value: "invoice",        label: "Invoice"       },
  { value: "training-plan",  label: "Training Plan" },
  { value: "deliverable",    label: "Deliverable"   },
  { value: "notes",          label: "Notes"         },
];

const ACCEPTED = ".pdf,.doc,.docx,.md,.txt,.png,.jpg,.jpeg,.gif,.webp";
const MAX_BYTES = 50 * 1024 * 1024; // 50 MB

interface Props {
  domains:   DomainInfo[];
  onUploaded: (doc: DocumentWithRelations) => void;
  onClose:   () => void;
}

export function UploadZone({ domains, onUploaded, onClose }: Props) {
  const inputRef          = useRef<HTMLInputElement>(null);
  const [dragging,        setDragging]       = useState(false);
  const [file,            setFile]           = useState<File | null>(null);
  const [domainId,        setDomainId]       = useState(domains[0]?.id ?? "");
  const [projects,        setProjects]       = useState<ProjectInfo[]>([]);
  const [projectId,       setProjectId]      = useState("");
  const [docType,         setDocType]        = useState<DocumentType>("other");
  const [title,           setTitle]          = useState("");
  const [loadingProjects, setLoadingProjects] = useState(false);
  const [error,           setError]          = useState<string | null>(null);
  const [isPending,       startTransition]   = useTransition();

  function pickFile(f: File) {
    if (f.size > MAX_BYTES) { setError(`File too large (max 50 MB)`); return; }
    setFile(f);
    if (!title) setTitle(f.name.replace(/\.[^.]+$/, ""));
    setError(null);
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragging(false);
    const f = e.dataTransfer.files[0];
    if (f) pickFile(f);
  }

  async function onDomainChange(id: string) {
    setDomainId(id);
    setProjectId("");
    setProjects([]);
    setLoadingProjects(true);
    try {
      const res  = await fetch(`/api/projects?domain_id=${id}&status=active`);
      const json = await res.json() as { data?: ProjectInfo[] };
      setProjects(json.data ?? []);
    } catch {
      // non-fatal — project select stays empty
    } finally {
      setLoadingProjects(false);
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!file)     { setError("Choose a file first"); return; }
    if (!domainId) { setError("Select a domain");     return; }
    setError(null);

    startTransition(async () => {
      try {
        const fd = new FormData();
        fd.append("file",          file);
        fd.append("domain_id",     domainId);
        fd.append("document_type", docType);
        if (projectId) fd.append("project_id", projectId);
        if (title.trim()) fd.append("title", title.trim());

        const res  = await fetch("/api/documents/upload", { method: "POST", body: fd });
        const json = await res.json() as { ok?: boolean; document?: DocumentWithRelations; error?: string };

        if (!res.ok || !json.document) {
          setError(json.error ?? "Upload failed");
          return;
        }

        // Attach domain info so the browser can render without refetch
        const domain = domains.find((d) => d.id === domainId)!;
        const project = projects.find((p) => p.id === projectId) ?? null;
        onUploaded({
          ...json.document,
          domain,
          project,
          client_name: null,
        } as DocumentWithRelations);
        onClose();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Upload failed");
      }
    });
  }

  return (
    <>
      <div className="fixed inset-0 z-50 bg-canvas/80 backdrop-blur-sm" onClick={onClose} aria-hidden />

      <div
        className="fixed bottom-0 left-0 right-0 z-50 max-w-2xl mx-auto rounded-t-2xl shadow-2xl max-h-[90vh] flex flex-col"
        style={{ backgroundColor: "#1A1510", border: "1px solid #241E17" }}
        role="dialog"
        aria-modal
        aria-label="Upload document"
      >
        <div className="flex justify-center pt-3 pb-1 shrink-0">
          <div className="w-10 h-1 rounded-full bg-surface-overlay" />
        </div>

        <form onSubmit={handleSubmit} className="overflow-y-auto px-5 pb-8 pt-2 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-heading text-xl text-text-primary">Upload Document</h2>
            <button type="button" onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-lg text-text-muted hover:text-text-secondary">
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
                <line x1="3" y1="3" x2="13" y2="13"/><line x1="13" y1="3" x2="3" y2="13"/>
              </svg>
            </button>
          </div>

          {/* Drop zone */}
          <div
            onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
            onDragLeave={() => setDragging(false)}
            onDrop={handleDrop}
            onClick={() => inputRef.current?.click()}
            className="cursor-pointer rounded-xl border-2 border-dashed flex flex-col items-center justify-center py-8 gap-2 transition-all"
            style={{
              borderColor:     dragging ? "#D4A96A" : "#241E17",
              backgroundColor: dragging ? "#D4A96A14" : "#241E17",
            }}
          >
            {file ? (
              <>
                <span className="text-2xl">📄</span>
                <p className="text-sm font-medium text-center px-4" style={{ color: "#F0E6D3" }}>
                  {file.name}
                </p>
                <p className="text-xs" style={{ color: "#6B5C4A" }}>
                  {(file.size / 1024).toFixed(0)} KB
                </p>
              </>
            ) : (
              <>
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#6B5C4A" strokeWidth="1.5" strokeLinecap="round">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                  <polyline points="17 8 12 3 7 8"/>
                  <line x1="12" y1="3" x2="12" y2="15"/>
                </svg>
                <p className="text-sm" style={{ color: "#A89880" }}>
                  Drop a file or <span style={{ color: "#D4A96A" }}>browse</span>
                </p>
                <p className="text-xs" style={{ color: "#6B5C4A" }}>PDF, Word, Markdown, images · up to 50 MB</p>
              </>
            )}
            <input ref={inputRef} type="file" accept={ACCEPTED} className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) pickFile(f); }} />
          </div>

          {/* Title */}
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Title (optional — defaults to filename)"
            className="w-full bg-transparent border-b border-surface-raised focus:border-accent/40 outline-none text-text-primary placeholder-text-muted py-2 text-sm transition-colors"
          />

          {/* Domain */}
          <div className="space-y-2">
            <label className="text-[10px] font-semibold tracking-widest uppercase text-text-muted">Domain</label>
            <div className="grid grid-cols-2 gap-2">
              {domains.map((d) => {
                const selected = d.id === domainId;
                return (
                  <button
                    key={d.id}
                    type="button"
                    onClick={() => onDomainChange(d.id)}
                    className="flex items-center gap-2 px-3 py-2.5 rounded-xl text-sm transition-all"
                    style={{
                      backgroundColor: selected ? `${d.color}22` : "#241E17",
                      border:          `1px solid ${selected ? `${d.color}60` : "#2E271E"}`,
                      color:           selected ? d.color         : "#6B5C4A",
                    }}
                  >
                    <span>{d.icon}</span>
                    <span className="capitalize font-medium">{d.name}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Project (lazy loaded) */}
          {(projects.length > 0 || loadingProjects) && (
            <div className="space-y-2">
              <label className="text-[10px] font-semibold tracking-widest uppercase text-text-muted">Project (optional)</label>
              <select
                value={projectId}
                onChange={(e) => setProjectId(e.target.value)}
                className="w-full bg-surface-raised rounded-xl px-3 py-2.5 text-sm outline-none"
                style={{ color: "#F0E6D3", border: "1px solid #2E271E" }}
                disabled={loadingProjects}
              >
                <option value="">— No project —</option>
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>{p.title}</option>
                ))}
              </select>
            </div>
          )}

          {/* Document type */}
          <div className="space-y-2">
            <label className="text-[10px] font-semibold tracking-widest uppercase text-text-muted">Type</label>
            <div className="flex flex-wrap gap-1.5">
              {DOC_TYPES.map((t) => {
                const selected = t.value === docType;
                return (
                  <button
                    key={t.value}
                    type="button"
                    onClick={() => setDocType(t.value)}
                    className="px-3 py-1.5 rounded-lg text-xs font-medium transition-all"
                    style={{
                      backgroundColor: selected ? "#D4A96A22" : "#241E17",
                      border:          `1px solid ${selected ? "#D4A96A60" : "#2E271E"}`,
                      color:           selected ? "#D4A96A"   : "#6B5C4A",
                    }}
                  >
                    {t.label}
                  </button>
                );
              })}
            </div>
          </div>

          {error && <p className="text-xs text-status-urgent">{error}</p>}

          <button
            type="submit"
            disabled={isPending || !file}
            className="w-full py-3.5 rounded-xl font-medium text-sm transition-all active:scale-[0.98] disabled:opacity-40"
            style={{ backgroundColor: "#D4A96A", color: "#0F0C09" }}
          >
            {isPending ? "Uploading…" : "Upload"}
          </button>
        </form>
      </div>
    </>
  );
}

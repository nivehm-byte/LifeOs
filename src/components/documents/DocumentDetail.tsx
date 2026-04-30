"use client";

import { useState, useTransition, useEffect } from "react";
import type { DocumentWithRelations } from "@/lib/documents/tree";
import type { FileType, DocumentType } from "@/types/database";

const FILE_LABELS: Record<FileType, string> = {
  pdf:   "PDF",
  docx:  "Word document",
  md:    "Markdown",
  image: "Image",
  other: "File",
};

const DOC_TYPE_LABEL: Record<DocumentType, string> = {
  proposal:       "Proposal",
  contract:       "Contract",
  invoice:        "Invoice",
  "training-plan": "Training Plan",
  deliverable:    "Deliverable",
  notes:          "Notes",
  other:          "Document",
};

interface Props {
  doc:     DocumentWithRelations;
  onClose: () => void;
  onDelete: (id: string) => void;
}

export function DocumentDetail({ doc, onClose, onDelete }: Props) {
  const [signedUrl,   setSignedUrl]   = useState<string | null>(null);
  const [urlLoading,  setUrlLoading]  = useState(false);
  const [isPending,   startTransition] = useTransition();
  const [confirmDel,  setConfirmDel]  = useState(false);

  const color    = doc.domain.color;
  const uploaded = new Date(doc.uploaded_at).toLocaleDateString("en-ZA", {
    weekday: "short", day: "numeric", month: "long", year: "numeric",
  });

  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = ""; };
  }, []);

  async function fetchSignedUrl() {
    setUrlLoading(true);
    try {
      const res  = await fetch(`/api/documents/${doc.id}`);
      const json = await res.json() as { url?: string };
      if (json.url) {
        setSignedUrl(json.url);
        window.open(json.url, "_blank", "noopener");
      }
    } catch {
      // silent — button stays enabled for retry
    } finally {
      setUrlLoading(false);
    }
  }

  function handleDelete() {
    if (!confirmDel) { setConfirmDel(true); return; }
    startTransition(async () => {
      await fetch(`/api/documents/${doc.id}`, { method: "DELETE" });
      onDelete(doc.id);
      onClose();
    });
  }

  return (
    <>
      <div
        className="fixed inset-0 z-50 bg-canvas/80 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden
      />

      <div
        className="fixed bottom-0 left-0 right-0 z-50 max-w-2xl mx-auto rounded-t-2xl shadow-2xl max-h-[90vh] flex flex-col"
        style={{ backgroundColor: "#1A1510", border: "1px solid #241E17" }}
        role="dialog"
        aria-modal
        aria-label={doc.title}
      >
        {/* Drag handle */}
        <div className="flex justify-center pt-3 pb-1 shrink-0">
          <div className="w-10 h-1 rounded-full bg-surface-overlay" />
        </div>

        <div className="overflow-y-auto px-5 pb-8 pt-3 space-y-5">
          {/* Header */}
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-3 min-w-0">
              {/* Icon */}
              <div
                className="shrink-0 w-11 h-11 rounded-xl flex items-center justify-center mt-0.5"
                style={{ backgroundColor: `${color}22` }}
              >
                <span className="text-[11px] font-black" style={{ color }}>
                  {FILE_LABELS[doc.file_type].slice(0, 3).toUpperCase()}
                </span>
              </div>
              <div className="min-w-0">
                <h2
                  className="font-heading text-lg leading-snug"
                  style={{ color: "#F0E6D3" }}
                >
                  {doc.title}
                </h2>
                <p className="text-xs mt-0.5" style={{ color: "#6B5C4A" }}>
                  {DOC_TYPE_LABEL[doc.document_type]} · {FILE_LABELS[doc.file_type]}
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="shrink-0 w-8 h-8 flex items-center justify-center rounded-lg text-text-muted hover:text-text-secondary transition-colors mt-0.5"
            >
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
                <line x1="3" y1="3" x2="13" y2="13"/>
                <line x1="13" y1="3" x2="3" y2="13"/>
              </svg>
            </button>
          </div>

          {/* Meta */}
          <div
            className="rounded-xl px-4 py-3 space-y-2"
            style={{ backgroundColor: "#241E17" }}
          >
            <MetaRow label="Domain"   value={doc.domain.name} color={color} />
            {doc.project && (
              <MetaRow
                label="Project"
                value={doc.client_name ? `${doc.client_name} / ${doc.project.title}` : doc.project.title}
              />
            )}
            <MetaRow label="Uploaded" value={uploaded} />
          </div>

          {/* AI Summary */}
          <div>
            <p
              className="text-[10px] font-semibold tracking-widest uppercase mb-2"
              style={{ color: "#6B5C4A" }}
            >
              AI Summary
            </p>
            {doc.ai_summary ? (
              <p className="text-sm leading-relaxed" style={{ color: "#A89880" }}>
                {doc.ai_summary}
              </p>
            ) : (
              <p className="text-sm italic" style={{ color: "#6B5C4A" }}>
                Summary not available for this file type. Upload a .txt or .md file to get an AI-generated summary.
              </p>
            )}
          </div>

          {/* Actions */}
          <div className="flex gap-3">
            <button
              onClick={signedUrl ? () => window.open(signedUrl, "_blank", "noopener") : fetchSignedUrl}
              disabled={urlLoading}
              className="flex-1 py-3 rounded-xl font-medium text-sm transition-all active:scale-[0.98] disabled:opacity-40"
              style={{ backgroundColor: "#D4A96A", color: "#0F0C09" }}
            >
              {urlLoading ? "Opening…" : "View file"}
            </button>

            <button
              onClick={handleDelete}
              disabled={isPending}
              className="px-4 py-3 rounded-xl font-medium text-sm transition-all active:scale-[0.98] disabled:opacity-40"
              style={{
                backgroundColor: confirmDel ? "#E05C5C22" : "#241E17",
                color:           confirmDel ? "#E05C5C"   : "#6B5C4A",
                border:          `1px solid ${confirmDel ? "#E05C5C40" : "#2E271E"}`,
              }}
            >
              {confirmDel ? "Confirm delete" : "Delete"}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

function MetaRow({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <span className="text-xs" style={{ color: "#6B5C4A" }}>{label}</span>
      <span
        className="text-xs font-medium capitalize text-right"
        style={{ color: color ?? "#A89880" }}
      >
        {value}
      </span>
    </div>
  );
}

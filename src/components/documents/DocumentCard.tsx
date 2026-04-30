"use client";

import type { DocumentWithRelations } from "@/lib/documents/tree";
import type { FileType, DocumentType } from "@/types/database";

const FILE_ICONS: Record<FileType, string> = {
  pdf:   "PDF",
  docx:  "DOC",
  md:    "MD",
  image: "IMG",
  other: "TXT",
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
  doc:      DocumentWithRelations;
  onClick:  (doc: DocumentWithRelations) => void;
}

export function DocumentCard({ doc, onClick }: Props) {
  const iconLabel = FILE_ICONS[doc.file_type];
  const typeLabel = DOC_TYPE_LABEL[doc.document_type];
  const color     = doc.domain.color;
  const uploaded  = new Date(doc.uploaded_at).toLocaleDateString("en-ZA", {
    day:   "numeric",
    month: "short",
    year:  "2-digit",
  });

  return (
    <button
      onClick={() => onClick(doc)}
      className="w-full text-left flex items-start gap-3 px-4 py-3.5 rounded-xl transition-all active:scale-[0.98] group"
      style={{ backgroundColor: "#1A1510", border: "1px solid #241E17" }}
    >
      {/* File type badge */}
      <div
        className="shrink-0 w-10 h-10 rounded-lg flex items-center justify-center"
        style={{ backgroundColor: `${color}22` }}
      >
        <span className="text-[10px] font-black tracking-wide" style={{ color }}>
          {iconLabel}
        </span>
      </div>

      {/* Body */}
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2 mb-0.5">
          <p
            className="font-medium text-sm leading-snug truncate group-hover:underline"
            style={{ color: "#F0E6D3" }}
          >
            {doc.title}
          </p>
          <span className="shrink-0 text-[10px] tabular-nums" style={{ color: "#6B5C4A" }}>
            {uploaded}
          </span>
        </div>

        <p className="text-[11px] mb-1" style={{ color: "#6B5C4A" }}>
          {typeLabel}
          {doc.project && (
            <> · {doc.client_name ? `${doc.client_name} / ${doc.project.title}` : doc.project.title}</>
          )}
        </p>

        {/* AI summary preview */}
        {doc.ai_summary ? (
          <p
            className="text-xs leading-relaxed line-clamp-2"
            style={{ color: "#A89880" }}
          >
            {doc.ai_summary}
          </p>
        ) : (
          <p className="text-xs italic" style={{ color: "#6B5C4A" }}>
            No summary yet
          </p>
        )}
      </div>
    </button>
  );
}

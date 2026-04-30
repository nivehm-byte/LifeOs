"use client";

import { useState } from "react";
import { DocumentCard }   from "./DocumentCard";
import { DocumentDetail } from "./DocumentDetail";
import { UploadZone }     from "./UploadZone";
import { buildTree }      from "@/lib/documents/tree";
import type { DocumentWithRelations, DomainInfo } from "@/lib/documents/tree";

interface Props {
  initialDocs: DocumentWithRelations[];
  domains:     DomainInfo[];
}

export function DocumentBrowser({ initialDocs, domains }: Props) {
  const [docs,       setDocs]       = useState(initialDocs);
  const [selected,   setSelected]   = useState<DocumentWithRelations | null>(null);
  const [showUpload, setShowUpload] = useState(false);
  const [search,     setSearch]     = useState("");
  const [expanded,   setExpanded]   = useState<Set<string>>(new Set());

  // ── Filtering ────────────────────────────────────────────────
  const q = search.trim().toLowerCase();
  const filtered = q
    ? docs.filter(
        (d) =>
          d.title.toLowerCase().includes(q) ||
          d.domain.name.toLowerCase().includes(q) ||
          d.project?.title.toLowerCase().includes(q) ||
          d.client_name?.toLowerCase().includes(q) ||
          d.ai_summary?.toLowerCase().includes(q),
      )
    : docs;

  const tree = buildTree(filtered);

  // ── Folder toggle ─────────────────────────────────────────────
  function toggleFolder(key: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(key)) { next.delete(key); } else { next.add(key); }
      return next;
    });
  }

  // ── Upload callback ───────────────────────────────────────────
  function handleUploaded(doc: DocumentWithRelations) {
    setDocs((prev) => [doc, ...prev]);
  }

  // ── Delete callback ───────────────────────────────────────────
  function handleDeleted(id: string) {
    setDocs((prev) => prev.filter((d) => d.id !== id));
    setSelected(null);
  }

  // ── Page-level drag-and-drop (drop anywhere on page) ─────────
  function handlePageDrop(e: React.DragEvent) {
    e.preventDefault();
    const f = e.dataTransfer.files[0];
    if (f) setShowUpload(true);
  }

  return (
    <div
      onDragOver={(e) => e.preventDefault()}
      onDrop={handlePageDrop}
      className="space-y-6"
    >
      {/* ── Header ────────────────────────────────────────────── */}
      <div className="flex items-center justify-between">
        <h1 className="font-heading text-2xl text-text-primary">Documents</h1>
        <button
          onClick={() => setShowUpload(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-all active:scale-[0.97]"
          style={{ backgroundColor: "#D4A96A26", color: "#D4A96A", border: "1px solid #D4A96A40" }}
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <line x1="7" y1="1" x2="7" y2="13"/><line x1="1" y1="7" x2="13" y2="7"/>
          </svg>
          Upload
        </button>
      </div>

      {/* ── Search ────────────────────────────────────────────── */}
      <div
        className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl"
        style={{ backgroundColor: "#1A1510", border: "1px solid #241E17" }}
      >
        <svg width="15" height="15" viewBox="0 0 15 15" fill="none" stroke="#6B5C4A" strokeWidth="1.6" strokeLinecap="round">
          <circle cx="6.5" cy="6.5" r="4.5"/>
          <line x1="10.5" y1="10.5" x2="14" y2="14"/>
        </svg>
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search documents…"
          className="flex-1 bg-transparent outline-none text-sm text-text-primary placeholder-text-muted"
        />
        {search && (
          <button onClick={() => setSearch("")} className="text-text-muted hover:text-text-secondary transition-colors">
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
              <line x1="2" y1="2" x2="12" y2="12"/><line x1="12" y1="2" x2="2" y2="12"/>
            </svg>
          </button>
        )}
      </div>

      {/* ── Drop hint (shown when no docs) ────────────────────── */}
      {docs.length === 0 && (
        <div
          className="flex flex-col items-center justify-center py-16 rounded-2xl border-2 border-dashed gap-3"
          style={{ borderColor: "#241E17" }}
        >
          <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="#6B5C4A" strokeWidth="1.3" strokeLinecap="round">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
            <polyline points="14 2 14 8 20 8"/>
          </svg>
          <div className="text-center">
            <p className="text-sm font-medium" style={{ color: "#A89880" }}>No documents yet</p>
            <p className="text-xs mt-1" style={{ color: "#6B5C4A" }}>
              Drop a file here or tap Upload
            </p>
          </div>
        </div>
      )}

      {/* ── File browser tree ─────────────────────────────────── */}
      {tree.map((section) => (
        <div key={section.domainId}>
          {/* Domain heading */}
          <div className="flex items-center gap-2 mb-2">
            <span className="text-base leading-none">{section.icon}</span>
            <h2
              className="text-xs font-semibold tracking-widest uppercase"
              style={{ color: section.color }}
            >
              {section.domainName}
            </h2>
            <span className="text-xs tabular-nums" style={{ color: "#6B5C4A" }}>
              {section.folders.reduce((n, f) => n + f.docs.length, 0) + section.loose.length}
            </span>
          </div>

          <div className="space-y-1.5">
            {/* Project folders */}
            {section.folders.map((folder) => {
              const isOpen = expanded.has(folder.key);
              return (
                <div key={folder.key}>
                  {/* Folder row */}
                  <button
                    onClick={() => toggleFolder(folder.key)}
                    className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-left transition-all"
                    style={{ backgroundColor: "#1A1510", border: "1px solid #241E17" }}
                  >
                    <svg
                      width="13"
                      height="13"
                      viewBox="0 0 13 13"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.8"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      style={{
                        color:     "#6B5C4A",
                        transform: isOpen ? "rotate(90deg)" : "none",
                        transition: "transform 150ms",
                      }}
                    >
                      <polyline points="4 2 9 6.5 4 11"/>
                    </svg>

                    {/* Folder icon */}
                    <svg
                      width="16"
                      height="16"
                      viewBox="0 0 24 24"
                      fill={`${section.color}33`}
                      stroke={section.color}
                      strokeWidth="1.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
                    </svg>

                    <span className="flex-1 text-sm font-medium truncate" style={{ color: "#F0E6D3" }}>
                      {folder.label}
                    </span>
                    <span className="shrink-0 text-xs tabular-nums" style={{ color: "#6B5C4A" }}>
                      {folder.docs.length}
                    </span>
                  </button>

                  {/* Folder contents */}
                  {isOpen && (
                    <div className="mt-1 ml-6 space-y-1">
                      {folder.docs.map((doc) => (
                        <DocumentCard key={doc.id} doc={doc} onClick={setSelected} />
                      ))}
                    </div>
                  )}
                </div>
              );
            })}

            {/* Loose files (no project) */}
            {section.loose.map((doc) => (
              <DocumentCard key={doc.id} doc={doc} onClick={setSelected} />
            ))}
          </div>
        </div>
      ))}

      {/* ── Search empty state ─────────────────────────────────── */}
      {q && filtered.length === 0 && (
        <p className="text-center py-8 text-sm" style={{ color: "#6B5C4A" }}>
          No documents match &ldquo;{search}&rdquo;
        </p>
      )}

      {/* ── Modals ────────────────────────────────────────────── */}
      {selected && (
        <DocumentDetail
          doc={selected}
          onClose={() => setSelected(null)}
          onDelete={handleDeleted}
        />
      )}

      {showUpload && (
        <UploadZone
          domains={domains}
          onUploaded={handleUploaded}
          onClose={() => setShowUpload(false)}
        />
      )}
    </div>
  );
}

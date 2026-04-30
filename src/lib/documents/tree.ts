// Pure, client-safe types and tree-building logic.
// No server imports — safe to use in "use client" components.

import type { Database } from "@/types/database";

type DocumentRow  = Database["public"]["Tables"]["documents"]["Row"];

export type DomainInfo   = { id: string; name: string; color: string; icon: string };
export type ProjectInfo  = { id: string; title: string; client_id: string | null };

export type DocumentWithRelations = DocumentRow & {
  domain:      DomainInfo;
  project:     ProjectInfo | null;
  client_name: string | null;
};

export type Folder = {
  key:   string;
  label: string;
  docs:  DocumentWithRelations[];
};

export type DomainSection = {
  domainId:   string;
  domainName: string;
  color:      string;
  icon:       string;
  folders:    Folder[];
  loose:      DocumentWithRelations[];
};

export function buildTree(docs: DocumentWithRelations[]): DomainSection[] {
  const byDomain: Record<string, DocumentWithRelations[]> = {};

  for (const doc of docs) {
    const key = doc.domain_id;
    if (!byDomain[key]) byDomain[key] = [];
    byDomain[key].push(doc);
  }

  const sections: DomainSection[] = [];

  for (const domainId of Object.keys(byDomain)) {
    const domainDocs = byDomain[domainId];
    const d          = domainDocs[0].domain;

    const folderMap: Record<string, Folder> = {};
    const loose: DocumentWithRelations[]    = [];

    for (const doc of domainDocs) {
      if (!doc.project) { loose.push(doc); continue; }
      const fKey = doc.project.id;
      if (!folderMap[fKey]) {
        const label = doc.client_name
          ? `${doc.client_name} / ${doc.project.title}`
          : doc.project.title;
        folderMap[fKey] = { key: fKey, label, docs: [] };
      }
      folderMap[fKey].docs.push(doc);
    }

    sections.push({
      domainId,
      domainName: d.name,
      color:      d.color,
      icon:       d.icon,
      folders: Object.values(folderMap).sort((a, b) => a.label.localeCompare(b.label)),
      loose,
    });
  }

  return sections.sort((a, b) => {
    if (a.domainName === "consulting") return -1;
    if (b.domainName === "consulting") return 1;
    return a.domainName.localeCompare(b.domainName);
  });
}

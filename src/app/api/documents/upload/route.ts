import { NextResponse }        from "next/server";
import { createClient }        from "@/lib/supabase/server";
import { summarizeDocument }   from "@/lib/ai/router";
import type { FileType, DocumentType } from "@/types/database";

const TEXT_MIME = new Set(["text/plain", "text/markdown", "text/x-markdown"]);

function mimeToFileType(mime: string): FileType {
  if (mime === "application/pdf")                         return "pdf";
  if (mime.includes("wordprocessingml") || mime.includes("msword")) return "docx";
  if (mime === "text/markdown" || mime === "text/x-markdown") return "md";
  if (mime.startsWith("image/"))                          return "image";
  if (mime === "text/plain")                              return "other"; // .txt → other
  return "other";
}

function sanitize(name: string): string {
  return name.replace(/[^a-zA-Z0-9._\-]/g, "_").toLowerCase();
}

export async function POST(req: Request) {
  const supabase = createClient();
  const { data: { user }, error: authErr } = await supabase.auth.getUser();
  if (authErr || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return NextResponse.json({ error: "Invalid form data" }, { status: 400 });
  }

  const file         = formData.get("file") as File | null;
  const domainId     = formData.get("domain_id") as string | null;
  const projectId    = formData.get("project_id") as string | null;
  const docType      = (formData.get("document_type") as DocumentType | null) ?? "other";
  const customTitle  = formData.get("title") as string | null;

  if (!file || !domainId) {
    return NextResponse.json({ error: "file and domain_id are required" }, { status: 400 });
  }

  const mimeType   = file.type || "application/octet-stream";
  const fileType   = mimeToFileType(mimeType);
  const title      = customTitle?.trim() || file.name;
  const storagePath = `${user.id}/${Date.now()}-${sanitize(file.name)}`;

  // ── Upload to Storage ─────────────────────────────────────────
  const fileBuffer = await file.arrayBuffer();
  const { error: uploadErr } = await supabase.storage
    .from("documents")
    .upload(storagePath, fileBuffer, { contentType: mimeType, upsert: false });

  if (uploadErr) {
    return NextResponse.json({ error: uploadErr.message }, { status: 500 });
  }

  // ── AI summary — text/markdown files only, max 500 KB ────────
  let aiSummary: string | null = null;
  if (TEXT_MIME.has(mimeType) && file.size < 500_000) {
    try {
      const text = await file.text();
      aiSummary = await summarizeDocument(title, text);
    } catch (err) {
      console.warn("[documents/upload] summary failed:", err instanceof Error ? err.message : err);
    }
  }

  // ── Create DB record ──────────────────────────────────────────
  const { data: doc, error: dbErr } = await supabase
    .from("documents")
    .insert({
      user_id:       user.id,
      domain_id:     domainId,
      project_id:    projectId || null,
      title,
      file_type:     fileType,
      storage_path:  storagePath,
      document_type: docType,
      ai_summary:    aiSummary,
    })
    .select("*")
    .single();

  if (dbErr) {
    // Best-effort cleanup if DB insert fails
    await supabase.storage.from("documents").remove([storagePath]);
    return NextResponse.json({ error: dbErr.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, document: doc });
}

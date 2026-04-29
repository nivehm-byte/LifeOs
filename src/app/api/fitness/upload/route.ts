import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { parseFitnessPlan } from "@/lib/ai/router";
import { syncSessionsFromPlan, renderPlanMarkdown } from "@/lib/fitness/sessions";

function calcEndDate(startDate: string, totalWeeks: number): string {
  const d = new Date(startDate);
  d.setDate(d.getDate() + totalWeeks * 7 - 1);
  return d.toISOString().split("T")[0];
}

function mimeToFileType(mime: string): "pdf" | "docx" | "md" | "image" | "other" {
  if (mime === "application/pdf") return "pdf";
  if (mime.includes("wordprocessingml")) return "docx";
  if (mime === "text/markdown" || mime === "text/x-markdown") return "md";
  if (mime.startsWith("image/")) return "image";
  return "other";
}

/**
 * POST /api/fitness/upload
 *
 * Accepts multipart/form-data:
 *   file        — the training plan document (txt, md, or pdf text-extracted)
 *   start_date  — YYYY-MM-DD: when Week 1 begins (required)
 *   title       — optional override for plan title
 *
 * Parses the document via Claude Sonnet, creates a fitness_plan record,
 * stores the original file, and syncs all sessions.
 *
 * Any previously active plan is paused automatically.
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const formData = await request.formData();

    const file = formData.get("file") as File | null;
    const startDate = (formData.get("start_date") as string | null)?.trim();
    const titleOverride = (formData.get("title") as string | null)?.trim() || null;

    if (!file) {
      return NextResponse.json({ error: "file is required" }, { status: 400 });
    }
    if (!startDate || !/^\d{4}-\d{2}-\d{2}$/.test(startDate)) {
      return NextResponse.json(
        { error: "start_date is required (YYYY-MM-DD)" },
        { status: 400 }
      );
    }

    // ── Extract text content ──────────────────────────────────────
    const mimeType = file.type || "text/plain";
    if (mimeType === "application/pdf") {
      return NextResponse.json(
        {
          error:
            "PDF parsing is not yet supported. Paste the plan as plain text or upload a .txt / .md file.",
        },
        { status: 415 }
      );
    }

    const textContent = await file.text();
    if (!textContent.trim()) {
      return NextResponse.json({ error: "File appears to be empty" }, { status: 400 });
    }

    const supabase = createServiceClient();

    // ── Resolve user ──────────────────────────────────────────────
    const { data: user } = await supabase
      .from("users")
      .select("id")
      .limit(1)
      .single();

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // ── Upload original file to Storage ───────────────────────────
    const fileName = file.name || `plan-${Date.now()}.txt`;
    const storagePath = `${user.id}/fitness/${Date.now()}-${fileName}`;

    const fileBuffer = await file.arrayBuffer();
    const { error: storageErr } = await supabase.storage
      .from("documents")
      .upload(storagePath, fileBuffer, { contentType: mimeType, upsert: false });

    if (storageErr) {
      return NextResponse.json(
        { error: `Storage upload failed: ${storageErr.message}` },
        { status: 500 }
      );
    }

    // ── Get fitness domain id ─────────────────────────────────────
    const { data: fitnessDomain } = await supabase
      .from("domains")
      .select("id")
      .eq("name", "fitness")
      .single();

    if (!fitnessDomain) {
      return NextResponse.json({ error: "Fitness domain not found in DB" }, { status: 500 });
    }

    // ── Create document record ────────────────────────────────────
    const { data: docRecord, error: docErr } = await supabase
      .from("documents")
      .insert({
        user_id: user.id,
        domain_id: fitnessDomain.id,
        title: titleOverride ?? fileName,
        file_type: mimeToFileType(mimeType),
        storage_path: storagePath,
        document_type: "training-plan",
      })
      .select()
      .single();

    if (docErr || !docRecord) {
      return NextResponse.json(
        { error: `Document record failed: ${docErr?.message}` },
        { status: 500 }
      );
    }

    // ── Parse via AI ──────────────────────────────────────────────
    const planData = await parseFitnessPlan(textContent);

    const planTitle = titleOverride ?? planData.meta.title ?? fileName;
    const endDate = calcEndDate(startDate, planData.meta.total_weeks);

    // ── Pause any existing active plans ───────────────────────────
    await supabase
      .from("fitness_plans")
      .update({ status: "paused" })
      .eq("user_id", user.id)
      .eq("status", "active");

    // ── Create fitness_plan record ────────────────────────────────
    const { data: planRecord, error: planErr } = await supabase
      .from("fitness_plans")
      .insert({
        user_id: user.id,
        title: planTitle,
        start_date: startDate,
        end_date: endDate,
        status: "active",
        document_url: storagePath,
        structured_data: planData as unknown as Record<string, unknown>,
      })
      .select()
      .single();

    if (planErr || !planRecord) {
      return NextResponse.json(
        { error: `Plan record failed: ${planErr?.message}` },
        { status: 500 }
      );
    }

    // ── Sync sessions ─────────────────────────────────────────────
    await syncSessionsFromPlan(planRecord.id, startDate, planData);

    const totalSessions = planData.weeks.reduce(
      (sum, w) => sum + w.sessions.length,
      0
    );

    return NextResponse.json({
      ok: true,
      plan_id: planRecord.id,
      title: planTitle,
      start_date: startDate,
      end_date: endDate,
      total_weeks: planData.meta.total_weeks,
      total_sessions: totalSessions,
      document_id: docRecord.id,
      preview: renderPlanMarkdown(planData, startDate).slice(0, 500),
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    console.error("[fitness/upload]", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

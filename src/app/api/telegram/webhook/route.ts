import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { todayInSAST } from "@/lib/utils/date";
import { sendMessage, getFileInfo, downloadFile } from "@/lib/telegram/client";
import { parseMessage } from "@/lib/telegram/parser";
import { executeIntent } from "@/lib/telegram/executor";
import { parseFitnessPlan } from "@/lib/ai/router";
import { syncSessionsFromPlan, renderPlanMarkdown } from "@/lib/fitness/sessions";
import type { TelegramUpdate, DomainRow } from "@/lib/telegram/types";

// Keywords in a Telegram document caption that trigger fitness plan parsing
const FITNESS_PLAN_KEYWORDS = [
  "training plan", "fitness plan", "workout plan", "training programme",
  "training program", "gym plan", "running plan",
];

// Map Telegram/MIME types to our FileType enum
function mimeToFileType(mime: string): "pdf" | "docx" | "md" | "image" | "other" {
  if (mime === "application/pdf") return "pdf";
  if (mime.includes("wordprocessingml")) return "docx";
  if (mime === "text/markdown" || mime === "text/x-markdown") return "md";
  if (mime.startsWith("image/")) return "image";
  return "other";
}

// Always return 200 — Telegram retries on non-2xx and that's undesirable.
export async function POST(request: NextRequest): Promise<NextResponse> {
  // ── Authenticate ────────────────────────────────────────────────
  const secret = request.headers.get("x-telegram-bot-api-secret-token");
  if (!process.env.TELEGRAM_WEBHOOK_SECRET || secret !== process.env.TELEGRAM_WEBHOOK_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let chatId = "";

  try {
    const update = (await request.json()) as TelegramUpdate;
    const message = update.message;

    // Ignore non-message updates (inline queries, callbacks, etc.)
    if (!message) return NextResponse.json({ ok: true });

    chatId = String(message.chat.id);
    const supabase = createServiceClient();

    // ── Resolve user ─────────────────────────────────────────────
    // Single-user app: fetch the one user, auto-link their chat_id if needed.
    const { data: users, error: userErr } = await supabase
      .from("users")
      .select("id, telegram_chat_id")
      .limit(1)
      .single();

    if (userErr || !users) {
      await sendMessage(chatId, "LifeOS user not found. Make sure the database is set up.");
      return NextResponse.json({ ok: true });
    }

    const userId = users.id;

    // Auto-register the chat_id on first message
    if (!users.telegram_chat_id) {
      await supabase
        .from("users")
        .update({ telegram_chat_id: chatId })
        .eq("id", userId);
    }

    // ── Reject unknown chats once a chat_id is registered ────────
    if (users.telegram_chat_id && users.telegram_chat_id !== chatId) {
      // Silently ignore — don't reveal the app exists to strangers
      return NextResponse.json({ ok: true });
    }

    // ── Load domains (needed for task creation context) ───────────
    const { data: domains } = await supabase
      .from("domains")
      .select("id, name, color, icon")
      .order("name");

    const domainList = (domains ?? []) as DomainRow[];

    // ── Handle document upload ────────────────────────────────────
    if (message.document) {
      const doc = message.document;
      const caption = message.caption || doc.file_name || "Uploaded document";
      const captionLower = caption.toLowerCase();

      // Download from Telegram
      const fileInfo = await getFileInfo(doc.file_id);
      const fileBuffer = await downloadFile(fileInfo.file_path);

      const mimeType = doc.mime_type ?? "application/octet-stream";
      const fileType = mimeToFileType(mimeType);
      const fileName = doc.file_name ?? `telegram-${Date.now()}`;
      const storagePath = `${userId}/${Date.now()}-${fileName}`;

      // Upload to Supabase Storage
      const { error: storageError } = await supabase.storage
        .from("documents")
        .upload(storagePath, fileBuffer, {
          contentType: mimeType,
          upsert: false,
        });

      if (storageError) {
        throw new Error(`Storage upload failed: ${storageError.message}`);
      }

      // ── Fitness plan detection ────────────────────────────────
      const isFitnessPlan = FITNESS_PLAN_KEYWORDS.some((kw) =>
        captionLower.includes(kw)
      );

      if (isFitnessPlan) {
        // Extract start date from caption if present, e.g. "training plan start 2026-05-05"
        const dateMatch = caption.match(/(\d{4}-\d{2}-\d{2})/);
        const startDate = dateMatch?.[1] ?? todayInSAST();

        // Decode file as text (txt/md only — PDFs need special handling)
        let planText: string;
        try {
          planText = new TextDecoder("utf-8").decode(fileBuffer);
        } catch {
          await sendMessage(
            chatId,
            "Couldn't read this file as text. Please send the plan as a .txt or .md file."
          );
          return NextResponse.json({ ok: true });
        }

        // Parse the plan via AI
        await sendMessage(chatId, "📋 Parsing your training plan… this may take a moment.");
        const planData = await parseFitnessPlan(planText);

        // Pause any active plans
        await supabase
          .from("fitness_plans")
          .update({ status: "paused" })
          .eq("user_id", userId)
          .eq("status", "active");

        const endDate = (() => {
          const d = new Date(startDate);
          d.setDate(d.getDate() + planData.meta.total_weeks * 7 - 1);
          return d.toISOString().split("T")[0];
        })();

        const fitnessDomain = domainList.find((d) => d.name === "fitness") ?? domainList[0];

        // Create document record
        const { data: docRecord } = await supabase
          .from("documents")
          .insert({
            user_id: userId,
            domain_id: fitnessDomain.id,
            title: caption,
            file_type: fileType,
            storage_path: storagePath,
            document_type: "training-plan",
          })
          .select()
          .single();

        // Create fitness_plan record
        const { data: planRecord, error: planErr } = await supabase
          .from("fitness_plans")
          .insert({
            user_id: userId,
            title: planData.meta.title,
            start_date: startDate,
            end_date: endDate,
            status: "active",
            document_url: storagePath,
            structured_data: planData as unknown as Record<string, unknown>,
          })
          .select()
          .single();

        if (planErr || !planRecord) throw new Error(`Plan insert failed: ${planErr?.message}`);

        await syncSessionsFromPlan(planRecord.id, startDate, planData);

        const totalSessions = planData.weeks.reduce((s, w) => s + w.sessions.length, 0);
        const overview = renderPlanMarkdown(planData, startDate).split("\n").slice(0, 8).join("\n");

        const reply = [
          `🏋️ *${planData.meta.title}* uploaded`,
          `${planData.meta.total_weeks} weeks · ${totalSessions} sessions scheduled`,
          `Week 1 starts ${startDate}`,
          "",
          overview,
          planData.meta.total_weeks > 3 ? "_…and more weeks_" : "",
        ].filter(Boolean).join("\n");

        await supabase.from("telegram_messages").insert({
          user_id: userId,
          chat_id: chatId,
          message_text: `[fitness plan: ${fileName}]`,
          parsed_intent: "general",
          parsed_data: { plan_id: planRecord.id, document_id: docRecord?.id },
          ai_response: reply,
        });

        await sendMessage(chatId, reply);
        return NextResponse.json({ ok: true });
      }

      // ── Generic document upload ───────────────────────────────
      const defaultDomain =
        domainList.find((d) => d.name === "personal") ?? domainList[0];

      // Create document record
      await supabase.from("documents").insert({
        user_id: userId,
        domain_id: defaultDomain.id,
        title: caption,
        file_type: fileType,
        storage_path: storagePath,
        document_type: "other",
      });

      // Log message
      await supabase.from("telegram_messages").insert({
        user_id: userId,
        chat_id: chatId,
        message_text: `[document: ${fileName}]`,
        parsed_intent: "general",
        parsed_data: { file_name: fileName, storage_path: storagePath },
        ai_response: "Document uploaded.",
      });

      await sendMessage(
        chatId,
        `📎 *${caption}* saved.\nStored in your documents library under Personal. You can reassign the domain in the app.`
      );
      return NextResponse.json({ ok: true });
    }

    // ── Handle photo upload ───────────────────────────────────────
    if (message.photo?.length) {
      const largest = message.photo[message.photo.length - 1];
      const caption = message.caption || `photo-${Date.now()}.jpg`;

      const fileInfo = await getFileInfo(largest.file_id);
      const fileBuffer = await downloadFile(fileInfo.file_path);

      const storagePath = `${userId}/${Date.now()}-${caption}`;

      const { error: storageError } = await supabase.storage
        .from("documents")
        .upload(storagePath, fileBuffer, {
          contentType: "image/jpeg",
          upsert: false,
        });

      if (storageError) throw new Error(`Photo upload failed: ${storageError.message}`);

      const defaultDomain =
        domainList.find((d) => d.name === "personal") ?? domainList[0];

      await supabase.from("documents").insert({
        user_id: userId,
        domain_id: defaultDomain.id,
        title: caption,
        file_type: "image",
        storage_path: storagePath,
        document_type: "other",
      });

      await supabase.from("telegram_messages").insert({
        user_id: userId,
        chat_id: chatId,
        message_text: `[photo: ${caption}]`,
        parsed_intent: "general",
        parsed_data: { storage_path: storagePath },
        ai_response: "Photo uploaded.",
      });

      await sendMessage(chatId, `🖼 Photo saved to your documents.`);
      return NextResponse.json({ ok: true });
    }

    // ── Handle text message ───────────────────────────────────────
    const text = message.text;
    if (!text) return NextResponse.json({ ok: true });

    const today = todayInSAST();

    // Parse intent via AI
    const parsed = await parseMessage(text, { domains: domainList, today });

    // Execute
    const reply = await executeIntent(parsed, userId, domainList);

    // Log to telegram_messages
    await supabase.from("telegram_messages").insert({
      user_id: userId,
      chat_id: chatId,
      message_text: text,
      parsed_intent: parsed.intent,
      parsed_data: parsed.data,
      ai_response: reply,
    });

    // Reply
    await sendMessage(chatId, reply);
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Telegram webhook error:", error);
    // Always try to respond to the user, but never let an error cause a non-200
    if (chatId) {
      try {
        await sendMessage(chatId, "Something went wrong processing your message. Try again in a moment.");
      } catch {
        // swallow — sending the error notification itself failed
      }
    }
    return NextResponse.json({ ok: true });
  }
}

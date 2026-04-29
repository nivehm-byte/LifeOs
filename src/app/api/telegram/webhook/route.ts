import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { todayInSAST } from "@/lib/utils/date";
import { sendMessage, getFileInfo, downloadFile } from "@/lib/telegram/client";
import { parseMessage } from "@/lib/telegram/parser";
import { executeIntent } from "@/lib/telegram/executor";
import type { TelegramUpdate, DomainRow } from "@/lib/telegram/types";

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

      // Default domain: "personal" or first available
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

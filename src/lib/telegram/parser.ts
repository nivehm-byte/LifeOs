import { parseMessage as routerParseMessage } from "@/lib/ai/router";
import type { ParsedIntent, DomainRow } from "./types";

/**
 * Parse a Telegram message into a structured intent.
 * Delegates to the central AI router (Gemini Flash + retry + cost logging).
 * Domain UUIDs are passed so the model can embed the correct domain_id directly.
 */
export async function parseMessage(
  text: string,
  context: { domains: DomainRow[]; today: string }
): Promise<ParsedIntent> {
  try {
    const result = await routerParseMessage(text, {
      domains: context.domains,
      today: context.today,
    });

    // Cast is safe: ParsedIntent in router and telegram/types are structurally identical
    return result as ParsedIntent;
  } catch (err) {
    console.error("telegram/parser: parseMessage failed:", err);
    return {
      intent: "general",
      data: {},
      reply: "I didn't quite catch that. You can ask me to add tasks, check what's due, or update task status.",
    };
  }
}

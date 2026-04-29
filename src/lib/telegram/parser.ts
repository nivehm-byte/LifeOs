import Anthropic from "@anthropic-ai/sdk";
import type { ParsedIntent, DomainRow } from "./types";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const SYSTEM_PROMPT = (domains: DomainRow[], today: string) => `
You are the LifeOS assistant. Parse the user's Telegram message into a structured action.

Today's date: ${today} (SAST, Africa/Johannesburg)

Available domains (use the exact id UUID when creating tasks):
${domains.map((d) => `- ${d.name} (id: ${d.id})`).join("\n")}

Respond ONLY with a single JSON object matching one of these schemas:

CREATE TASK — when the user wants to add a task, todo, reminder, or action item:
{"intent":"create-task","data":{"title":"...","domain_id":"<uuid>","priority":"low|medium|high|urgent","due_date":"YYYY-MM-DD or null","due_time":"HH:MM or null","description":"... or null"}}

UPDATE TASK — when the user wants to change a task's details (not status):
{"intent":"update-task","data":{"task_search":"partial title to find task","changes":{"priority":"...","due_date":"...","title":"...","description":"..."}}}

STATUS UPDATE — when the user marks a task done, complete, in-progress, or cancelled:
{"intent":"status-update","data":{"task_search":"partial title","new_status":"todo|in-progress|completed|cancelled"}}

QUERY — when the user asks what's on their list, what's due, project status, etc.:
{"intent":"query","data":{"type":"today|upcoming|overdue|projects"}}

ADJUST PLAN — when the user wants to change a project's status or details:
{"intent":"adjust-plan","data":{"project_search":"partial title","changes":{"status":"active|paused|completed|archived","title":"..."}}}

GENERAL — for greetings, questions you can answer directly, or anything else:
{"intent":"general","data":{},"reply":"your conversational response here"}

Rules:
- Infer the domain from context: gym/workout/run → fitness, client/proposal/invoice → consulting, work meeting/corporate → corporate, personal/errand/self → personal
- If domain is ambiguous, default to "personal"
- If no due date mentioned, set due_date to null
- Priority defaults to "medium" unless words like urgent/asap/important/critical (→ urgent/high) or eventually/someday (→ low) appear
- For status updates, "done"/"finished"/"completed" → "completed"; "started"/"working on" → "in-progress"
- Never include explanations or markdown — raw JSON only
`.trim();

export async function parseMessage(
  text: string,
  context: { domains: DomainRow[]; today: string }
): Promise<ParsedIntent> {
  try {
    const msg = await anthropic.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 512,
      system: SYSTEM_PROMPT(context.domains, context.today),
      messages: [{ role: "user", content: text }],
    });

    const raw =
      msg.content[0].type === "text" ? msg.content[0].text.trim() : "";

    // Strip markdown code fences if the model wraps the JSON
    const cleaned = raw.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "");

    const parsed = JSON.parse(cleaned) as ParsedIntent;
    return parsed;
  } catch (err) {
    console.error("parseMessage failed:", err);
    // Fallback: treat as general message
    return {
      intent: "general",
      data: {},
      reply: "I didn't quite catch that. You can ask me to add tasks, check what's due, or update task status.",
    };
  }
}

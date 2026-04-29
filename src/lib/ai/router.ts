import { GoogleGenerativeAI } from "@google/generative-ai";
import Anthropic from "@anthropic-ai/sdk";
import type { BriefingContent } from "@/lib/briefing/types";
import type { AIIntent } from "@/types";
import type { FitnessPlanData, AdjustmentResult } from "@/lib/fitness/types";

// ── Client singletons (lazy — fail at call time, not import) ─────

let _gemini: GoogleGenerativeAI | null = null;
let _anthropic: Anthropic | null = null;

function geminiClient(): GoogleGenerativeAI {
  if (!_gemini) {
    if (!process.env.GEMINI_API_KEY) throw new Error("GEMINI_API_KEY is not set");
    _gemini = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
  }
  return _gemini;
}

function anthropicClient(): Anthropic {
  if (!_anthropic) {
    if (!process.env.ANTHROPIC_API_KEY) throw new Error("ANTHROPIC_API_KEY is not set");
    _anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  }
  return _anthropic;
}

// ── Exported types ───────────────────────────────────────────────

export type { AIIntent };

export interface ParsedIntent {
  intent: AIIntent;
  data: Record<string, unknown>;
  reply?: string;
}

export interface DomainInfo {
  id: string;
  name: string;
  color: string;
  icon: string;
}

export interface ParseMessageOptions {
  domains?: DomainInfo[];
  today?: string;
}

export interface DocumentInput {
  title: string;
  content: string;
  file_type?: string;
}

// ── Cost tracking ────────────────────────────────────────────────

// Approximate list prices (USD per million tokens), updated 2025
const MODEL_COSTS: Record<string, { input: number; output: number }> = {
  "gemini-2.0-flash":          { input: 0.075, output: 0.30  },
  "claude-sonnet-4-6":         { input: 3.0,   output: 15.0  },
  "claude-haiku-4-5-20251001": { input: 0.80,  output: 4.0   },
};

function calcCost(model: string, inputTok: number, outputTok: number): number {
  const r = MODEL_COSTS[model];
  if (!r) return 0;
  return (inputTok * r.input + outputTok * r.output) / 1_000_000;
}

function logUsage(params: {
  model: string;
  operation: string;
  input_tokens: number;
  output_tokens: number;
}): void {
  const cost_usd = calcCost(params.model, params.input_tokens, params.output_tokens);
  console.log(
    JSON.stringify({
      event: "ai_usage",
      ...params,
      cost_usd,
      timestamp: new Date().toISOString(),
    })
  );
}

// ── Retry logic ──────────────────────────────────────────────────

function isRetryable(err: unknown): boolean {
  const msg = err instanceof Error ? err.message.toLowerCase() : "";
  return (
    msg.includes("fetch")       ||
    msg.includes("network")     ||
    msg.includes("timeout")     ||
    msg.includes("429")         ||
    msg.includes("rate limit")  ||
    msg.includes("quota")       ||
    msg.includes("500")         ||
    msg.includes("502")         ||
    msg.includes("503")         ||
    msg.includes("overloaded")
  );
}

async function withRetry<T>(
  fn: () => Promise<T>,
  operation: string,
  maxAttempts = 3,
  baseDelayMs = 1000
): Promise<T> {
  let lastErr: unknown;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      if (!isRetryable(err) || attempt === maxAttempts - 1) throw err;
      const delay = baseDelayMs * 2 ** attempt;
      console.warn(
        `[ai/router] ${operation} failed (attempt ${attempt + 1}/${maxAttempts}), ` +
          `retrying in ${delay}ms:`,
        err instanceof Error ? err.message : err
      );
      await new Promise((res) => setTimeout(res, delay));
    }
  }

  throw lastErr;
}

// ── parseMessage ─────────────────────────────────────────────────

const VALID_INTENTS: AIIntent[] = [
  "create-task", "update-task", "query", "adjust-plan", "status-update", "general",
];

function buildParsePrompt(options: ParseMessageOptions): string {
  const today = options.today ?? new Date().toISOString().split("T")[0];
  const domainLines = options.domains?.length
    ? options.domains.map((d) => `- ${d.name} (id: ${d.id})`).join("\n")
    : "- No domain context; default to 'personal'";

  return `You are LifeOS, a personal productivity assistant. Parse the user's message into a structured JSON action.

Today: ${today} (SAST / Africa/Johannesburg)

Available domains:
${domainLines}

Return EXACTLY ONE JSON object matching one of these schemas:

CREATE TASK — adding a task, todo, reminder, or action item:
{"intent":"create-task","data":{"title":"...","domain_id":"<uuid>","priority":"low|medium|high|urgent","due_date":"YYYY-MM-DD or null","due_time":"HH:MM or null","description":"... or null"}}

UPDATE TASK — changing a task's fields (not its completion status):
{"intent":"update-task","data":{"task_search":"partial title","changes":{"priority":"...","due_date":"...","title":"...","description":"..."}}}

STATUS UPDATE — marking a task done, in-progress, or cancelled:
{"intent":"status-update","data":{"task_search":"partial title","new_status":"todo|in-progress|completed|cancelled"}}

QUERY — asking what's due, overdue, or project status:
{"intent":"query","data":{"type":"today|upcoming|overdue|projects"}}

ADJUST PLAN — changing a project's status or metadata (NOT fitness/training):
{"intent":"adjust-plan","data":{"project_search":"partial title","changes":{"status":"active|paused|completed|archived","title":"..."}}}

ADJUST FITNESS PLAN — modifying a training, workout, or fitness schedule:
{"intent":"adjust-fitness-plan","data":{"instruction":"the full instruction exactly as stated"}}

GENERAL — greetings, direct questions, or anything that doesn't map to an action:
{"intent":"general","data":{},"reply":"your conversational reply"}

Domain inference:
- gym / workout / run / training       → fitness
- client / proposal / invoice / deal   → consulting
- work / meeting / board / corporate   → corporate
- everything else                      → personal

Priority inference:
- urgent / asap / critical / today     → urgent or high
- someday / eventually / low priority  → low
- default                              → medium

Status inference:
- done / finished / completed / close  → completed
- started / working on / in progress   → in-progress

Return raw JSON only — no markdown fences, no commentary.`;
}

/**
 * Classify a natural-language message into a structured intent + data object.
 * Uses Gemini Flash with JSON output mode for reliable structured responses.
 *
 * Pass `options.domains` (with UUIDs from the DB) so the model can embed
 * the correct domain_id directly in create-task responses.
 */
export async function parseMessage(
  text: string,
  options: ParseMessageOptions = {}
): Promise<ParsedIntent> {
  return withRetry(
    async () => {
      const model = geminiClient().getGenerativeModel({
        model: "gemini-2.0-flash",
        systemInstruction: buildParsePrompt(options),
        generationConfig: {
          responseMimeType: "application/json",
          temperature: 0.1,
          maxOutputTokens: 512,
        },
      });

      const result = await model.generateContent(text);
      const raw = result.response.text();

      const meta = result.response.usageMetadata;
      logUsage({
        model: "gemini-2.0-flash",
        operation: "parse-message",
        input_tokens: meta?.promptTokenCount ?? 0,
        output_tokens: meta?.candidatesTokenCount ?? 0,
      });

      const parsed = JSON.parse(raw) as ParsedIntent;
      if (!VALID_INTENTS.includes(parsed.intent)) parsed.intent = "general";
      return parsed;
    },
    "parse-message"
  );
}

// ── generateBriefing ─────────────────────────────────────────────

const BRIEFING_SYSTEM = `You are LifeOS, a focused personal assistant for a consultant based in Durban, South Africa. Write a concise morning briefing in 3–5 short paragraphs. Be direct and actionable — the reader is busy.

Content order (only include sections with data):
1. Urgent or escalated tasks that need immediate attention today
2. Today's schedule — key meetings and calendar events
3. Project health — milestones at risk or overdue
4. Fitness — today's session if one is scheduled

Style:
- Prose only — no bullet points, no markdown headers
- Name specific tasks, projects, and clients directly
- Start with the first item of substance — never open with "Here's your briefing" or similar filler
- Keep the total under 200 words`.trim();

/**
 * Generate a human-readable morning briefing from structured BriefingContent data.
 * Uses Gemini Flash for speed and cost efficiency at daily-cron frequency.
 */
export async function generateBriefing(data: BriefingContent): Promise<string> {
  return withRetry(
    async () => {
      const model = geminiClient().getGenerativeModel({
        model: "gemini-2.0-flash",
        systemInstruction: BRIEFING_SYSTEM,
        generationConfig: {
          temperature: 0.65,
          maxOutputTokens: 600,
        },
      });

      const result = await model.generateContent(JSON.stringify(data, null, 2));
      const text = result.response.text().trim();

      const meta = result.response.usageMetadata;
      logUsage({
        model: "gemini-2.0-flash",
        operation: "generate-briefing",
        input_tokens: meta?.promptTokenCount ?? 0,
        output_tokens: meta?.candidatesTokenCount ?? 0,
      });

      return text;
    },
    "generate-briefing"
  );
}

// ── reasonAboutDocument ──────────────────────────────────────────

const DOCUMENT_SYSTEM = `You are a precise document analyst. Answer questions based solely on the provided document.

Rules:
- Cite specific clauses, sections, or figures when relevant
- If the answer isn't in the document, say so explicitly — never hallucinate
- Be concise: one or two paragraphs unless detail is genuinely necessary
- For contracts or proposals, highlight dates, amounts, and obligations relevant to the question`.trim();

/**
 * Answer a question about a document using Claude Sonnet's reasoning capability.
 * The caller must extract the document text before calling (from Storage or cache).
 */
export async function reasonAboutDocument(
  document: DocumentInput,
  query: string
): Promise<string> {
  return withRetry(
    async () => {
      const userMessage = [
        `Document: ${document.title}`,
        document.file_type ? `Format: ${document.file_type}` : null,
        "",
        document.content,
        "",
        `Question: ${query}`,
      ]
        .filter((line): line is string => line !== null)
        .join("\n");

      const message = await anthropicClient().messages.create({
        model: "claude-sonnet-4-6",
        max_tokens: 1024,
        system: DOCUMENT_SYSTEM,
        messages: [{ role: "user", content: userMessage }],
      });

      const block = message.content[0];
      const text = block.type === "text" ? block.text.trim() : "";

      logUsage({
        model: "claude-sonnet-4-6",
        operation: "reason-about-document",
        input_tokens: message.usage.input_tokens,
        output_tokens: message.usage.output_tokens,
      });

      return text;
    },
    "reason-about-document"
  );
}

// ── parseFitnessPlan ─────────────────────────────────────────────

const PARSE_PLAN_SYSTEM = `You are a fitness plan parser. Convert the training plan document into structured JSON.

Return EXACTLY this JSON structure (no markdown, no commentary):
{
  "meta": {
    "title": "plan name",
    "total_weeks": 12,
    "sessions_per_week": 4,
    "goal": "optional goal description or null",
    "notes": "optional plan-level notes or null"
  },
  "weeks": [
    {
      "week_number": 1,
      "theme": "optional e.g. Volume or null",
      "sessions": [
        {
          "day_of_week": 1,
          "day_label": "Monday",
          "session_type": "gym",
          "title": "Push Day A",
          "exercises": [
            {
              "name": "Bench Press",
              "category": "strength",
              "sets": 4,
              "reps": "8-10",
              "weight_kg": null,
              "distance_km": null,
              "duration_min": null,
              "rest_seconds": 90,
              "notes": null
            }
          ],
          "notes": null
        }
      ]
    }
  ]
}

Rules:
- day_of_week: 0=Sunday, 1=Monday, 2=Tuesday, 3=Wednesday, 4=Thursday, 5=Friday, 6=Saturday
- session_type: "gym" for any weight/strength/HIIT training; "run" for any cardio/running/cycling
- category: "strength" for weighted exercises; "cardio" for running/cycling/rowing; "mobility" for stretching/yoga/warmup
- reps: string like "8-12" or "10" — never a number
- If the plan shows a repeating weekly template (same every week), expand it to all weeks
- If total_weeks is not stated, infer from the document structure
- Include ALL weeks explicitly in the output — never use references like "same as week 1"
- Null fields must be null, not omitted
- Return raw JSON only`.trim();

/**
 * Parse a training plan document (plain text or markdown) into a structured
 * FitnessPlanData object. Uses Claude Sonnet for accurate extraction.
 */
export async function parseFitnessPlan(
  content: string
): Promise<FitnessPlanData> {
  return withRetry(
    async () => {
      const message = await anthropicClient().messages.create({
        model: "claude-sonnet-4-6",
        max_tokens: 8192,
        system: PARSE_PLAN_SYSTEM,
        messages: [{ role: "user", content }],
      });

      const block = message.content[0];
      const raw = block.type === "text" ? block.text.trim() : "";

      logUsage({
        model: "claude-sonnet-4-6",
        operation: "parse-fitness-plan",
        input_tokens: message.usage.input_tokens,
        output_tokens: message.usage.output_tokens,
      });

      const cleaned = raw
        .replace(/^```(?:json)?\n?/, "")
        .replace(/\n?```$/, "");

      return JSON.parse(cleaned) as FitnessPlanData;
    },
    "parse-fitness-plan"
  );
}

// ── adjustFitnessPlan ────────────────────────────────────────────

const ADJUST_PLAN_SYSTEM = `You are a fitness plan adjuster. You will receive a structured fitness plan (JSON) and a natural-language instruction. Apply the instruction to the plan and return the modified plan plus a short summary of what changed.

Return EXACTLY this JSON structure (no markdown, no commentary):
{
  "plan": { /* full FitnessPlanData — identical structure to the input */ },
  "summary": "One sentence describing what changed",
  "new_start_date": "YYYY-MM-DD if the start date should shift, otherwise null"
}

Adjustment examples and how to handle them:
- "push training forward one week" → set new_start_date to (current start + 7 days); plan structure unchanged
- "skip week 3" → remove all sessions from week 3 (empty sessions array for that week)
- "add a rest day Wednesday" → remove any Wednesday session from the current/next week
- "change Monday sets to 5x5 from week 4 onwards" → update sets/reps for all Monday gym sessions from week 4 onward
- "swap Tuesday and Thursday for week 2" → exchange day_of_week values for those sessions
- "reduce volume next week by 20%" → reduce sets by ~20% for upcoming week sessions
- "deload week 8" → mark week 8 theme as "Deload" and halve the sets/volume

Rules:
- Only modify what the instruction specifies — leave everything else unchanged
- Preserve week_number values even if sessions are removed
- new_start_date is ONLY set when the user wants to shift the entire schedule forward or backward in calendar time
- Return raw JSON only`.trim();

/**
 * Apply a natural-language instruction to a fitness plan using Claude Sonnet.
 * Returns the modified plan, a human-readable summary, and an optional new start date.
 */
export async function adjustFitnessPlan(
  plan: FitnessPlanData,
  instruction: string,
  currentStartDate: string
): Promise<AdjustmentResult> {
  return withRetry(
    async () => {
      const userMessage = `Current start date: ${currentStartDate}

Current plan:
${JSON.stringify(plan, null, 2)}

Instruction: ${instruction}`;

      const message = await anthropicClient().messages.create({
        model: "claude-sonnet-4-6",
        max_tokens: 8192,
        system: ADJUST_PLAN_SYSTEM,
        messages: [{ role: "user", content: userMessage }],
      });

      const block = message.content[0];
      const raw = block.type === "text" ? block.text.trim() : "";

      logUsage({
        model: "claude-sonnet-4-6",
        operation: "adjust-fitness-plan",
        input_tokens: message.usage.input_tokens,
        output_tokens: message.usage.output_tokens,
      });

      const cleaned = raw
        .replace(/^```(?:json)?\n?/, "")
        .replace(/\n?```$/, "");

      return JSON.parse(cleaned) as AdjustmentResult;
    },
    "adjust-fitness-plan"
  );
}

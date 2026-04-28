import { GoogleGenerativeAI } from "@google/generative-ai";
import Anthropic from "@anthropic-ai/sdk";
import type { AIIntent } from "@/types";

const gemini = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export type AITask =
  | "parse-message"
  | "categorize"
  | "generate-briefing"
  | "simple-query"
  | "document-reason"
  | "adjust-fitness-plan"
  | "project-summary"
  | "content-generation";

const CLAUDE_TASKS: AITask[] = [
  "document-reason",
  "adjust-fitness-plan",
  "project-summary",
  "content-generation",
];

function requiresClaude(task: AITask): boolean {
  return CLAUDE_TASKS.includes(task);
}

export async function runGemini(
  prompt: string,
  systemPrompt?: string
): Promise<string> {
  const model = gemini.getGenerativeModel({
    model: "gemini-2.0-flash",
    systemInstruction: systemPrompt,
  });

  const result = await model.generateContent(prompt);
  return result.response.text();
}

export async function runClaude(
  prompt: string,
  systemPrompt?: string
): Promise<string> {
  const message = await anthropic.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 4096,
    system: systemPrompt,
    messages: [{ role: "user", content: prompt }],
  });

  const block = message.content[0];
  return block.type === "text" ? block.text : "";
}

export async function route(
  task: AITask,
  prompt: string,
  systemPrompt?: string
): Promise<string> {
  if (requiresClaude(task)) {
    return runClaude(prompt, systemPrompt);
  }
  return runGemini(prompt, systemPrompt);
}

export async function classifyIntent(message: string): Promise<AIIntent> {
  const prompt = `Classify the intent of this message into exactly one of these categories:
create-task, update-task, query, adjust-plan, status-update, general

Message: "${message}"

Reply with only the category name, nothing else.`;

  const result = await runGemini(prompt);
  const intent = result.trim().toLowerCase() as AIIntent;

  const validIntents: AIIntent[] = [
    "create-task",
    "update-task",
    "query",
    "adjust-plan",
    "status-update",
    "general",
  ];

  return validIntents.includes(intent) ? intent : "general";
}

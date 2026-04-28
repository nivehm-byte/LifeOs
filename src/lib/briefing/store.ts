import { createServiceClient } from "@/lib/supabase/server";
import type { BriefingContent, BriefingTasksSnapshot } from "./types";

export interface StoredBriefing {
  id:           string;
  date:         string;
  generated_at: string;
}

export async function storeBriefing(
  userId:   string,
  date:     string,
  content:  BriefingContent,
  snapshot: BriefingTasksSnapshot,
): Promise<StoredBriefing> {
  const supabase = createServiceClient();

  const { data, error } = await supabase
    .from("daily_briefings")
    .upsert(
      {
        user_id:        userId,
        date,
        generated_at:   new Date().toISOString(),
        content:        content as unknown as Record<string, unknown>,
        tasks_snapshot: snapshot as unknown as Record<string, unknown>,
        summary_text:   "", // populated by AI in Phase 2
      },
      { onConflict: "user_id,date" }
    )
    .select("id, date, generated_at")
    .single();

  if (error) throw new Error(`Failed to store briefing: ${error.message}`);

  return data as StoredBriefing;
}

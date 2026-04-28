import { createServiceClient } from "@/lib/supabase/server";

export async function runDailyEscalation(): Promise<{ escalated: number }> {
  const supabase = createServiceClient();

  const { data, error } = await supabase.rpc("increment_overdue_escalation");
  if (error) throw new Error(`Escalation RPC failed: ${error.message}`);

  return { escalated: (data as number) ?? 0 };
}

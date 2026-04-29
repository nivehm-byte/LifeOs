import { NextResponse }           from "next/server";
import { createServiceClient }   from "@/lib/supabase/server";
import { syncFromGoogle, syncToGoogle } from "@/lib/calendar/sync";

// Vercel Cron calls this every 15 minutes.
// Skips gracefully if Google Calendar is not yet connected.
export async function POST(req: Request) {
  const secret = req.headers.get("x-cron-secret");
  if (!secret || secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const supabase = createServiceClient();

    const { data: user } = await supabase
      .from("users")
      .select("id")
      .limit(1)
      .single();

    if (!user) return NextResponse.json({ skipped: "no user" });

    // Skip if Google Calendar has never been connected
    const { data: tokenRow } = await supabase
      .from("google_tokens")
      .select("user_id")
      .eq("user_id", user.id)
      .maybeSingle();

    if (!tokenRow) return NextResponse.json({ skipped: "google calendar not connected" });

    // Run syncs sequentially to avoid concurrent token refresh races
    const fromResult = await syncFromGoogle(user.id);
    const toResult   = await syncToGoogle(user.id);

    return NextResponse.json({
      ok:      true,
      from:    fromResult,
      to:      toResult,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("[calendar/sync]", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

import { NextResponse }        from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { gatherBriefingData }  from "@/lib/briefing/gather";
import { storeBriefing }       from "@/lib/briefing/store";
import { generateBriefing }    from "@/lib/ai/router";
import { todayInSAST }         from "@/lib/utils/date";

export async function POST(req: Request) {
  // ── Auth ─────────────────────────────────────────────────────────
  const secret = req.headers.get("x-cron-secret");
  if (!secret || secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    // ── Resolve user ──────────────────────────────────────────────
    const supabase = createServiceClient();
    const { data: userRow, error: userError } = await supabase
      .from("users")
      .select("id")
      .limit(1)
      .single();

    if (userError || !userRow) {
      return NextResponse.json({ error: "No user found" }, { status: 404 });
    }

    const userId = userRow.id;
    const date   = todayInSAST();

    // ── Gather structured data ────────────────────────────────────
    const { content, snapshot } = await gatherBriefingData(userId);

    // ── Generate AI summary ───────────────────────────────────────
    // Run in parallel with nothing — if Gemini fails we still store the
    // structured data (summary degrades to empty string gracefully).
    let summaryText = "";
    try {
      summaryText = await generateBriefing(content);
    } catch (aiErr) {
      console.error("[briefing/generate] AI summary failed:", aiErr);
    }

    // ── Store both structured data and summary ────────────────────
    const briefing = await storeBriefing(userId, date, content, snapshot, summaryText);

    return NextResponse.json({
      ok:             true,
      briefing_id:    briefing.id,
      date:           briefing.date,
      generated_at:   briefing.generated_at,
      summary_length: summaryText.length,
      stats: {
        events:   content.schedule.count,
        today:    content.tasks.today_count,
        overdue:  content.tasks.overdue_count,
        upcoming: content.tasks.upcoming_count,
        projects: content.projects.count,
        fitness:  content.fitness.session !== null,
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("[briefing/generate]", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

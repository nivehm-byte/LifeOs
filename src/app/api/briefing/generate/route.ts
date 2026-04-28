import { NextResponse }      from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { gatherBriefingData }  from "@/lib/briefing/gather";
import { storeBriefing }       from "@/lib/briefing/store";
import { todayInSAST }         from "@/lib/utils/date";

export async function POST(req: Request) {
  // ── Auth ────────────────────────────────────────────────────────
  const secret = req.headers.get("x-cron-secret");
  if (!secret || secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    // ── Resolve user ─────────────────────────────────────────────
    // Single-user app: grab the only row from the users table.
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

    // ── Gather ───────────────────────────────────────────────────
    const { content, snapshot } = await gatherBriefingData(userId);

    // ── Store ────────────────────────────────────────────────────
    const briefing = await storeBriefing(userId, date, content, snapshot);

    return NextResponse.json({
      ok:           true,
      briefing_id:  briefing.id,
      date:         briefing.date,
      generated_at: briefing.generated_at,
      stats: {
        events:    content.schedule.count,
        today:     content.tasks.today_count,
        overdue:   content.tasks.overdue_count,
        upcoming:  content.tasks.upcoming_count,
        projects:  content.projects.count,
        fitness:   content.fitness.session !== null,
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("[briefing/generate]", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

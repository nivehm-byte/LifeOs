import { NextResponse }             from "next/server";
import { createServiceClient }      from "@/lib/supabase/server";
import { gatherBriefingData }       from "@/lib/briefing/gather";
import { storeBriefing }            from "@/lib/briefing/store";
import { generateBriefing }         from "@/lib/ai/router";
import { todayInSAST }              from "@/lib/utils/date";
import { processAllRecurringTasks } from "@/lib/tasks/recurrence";
import { runDailyEscalation }       from "@/lib/tasks/escalation";
import { getBriefingPushTarget }    from "@/lib/push/actions";
import { sendPushToUser }           from "@/lib/push/send";
import { syncFromGoogle, syncToGoogle } from "@/lib/calendar/sync";

const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

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

    // ── Google Calendar sync (pull + push) ───────────────────────
    try {
      await syncFromGoogle(userId);
      await syncToGoogle(userId);
    } catch (err) {
      console.error("[briefing/generate] calendar sync failed:", err);
    }

    // ── Recurring tasks — generate instances for next 14 days ─────
    try {
      await processAllRecurringTasks();
    } catch (err) {
      console.error("[briefing/generate] recurrence failed:", err);
    }

    // ── Task escalation ───────────────────────────────────────────
    try {
      await runDailyEscalation();
    } catch (err) {
      console.error("[briefing/generate] escalation failed:", err);
    }

    // ── Gather structured data ────────────────────────────────────
    const { content, snapshot } = await gatherBriefingData(userId);

    // ── Generate AI summary ───────────────────────────────────────
    let summaryText = "";
    try {
      summaryText = await generateBriefing(content);
    } catch (err) {
      console.error("[briefing/generate] AI summary failed:", err);
    }

    // ── Store both structured data and summary ────────────────────
    const briefing = await storeBriefing(userId, date, content, snapshot, summaryText);

    // ── Send push notification (if user has push enabled) ─────────
    let pushResult: Record<string, unknown> = { skipped: "push disabled" };
    try {
      const target = await getBriefingPushTarget();
      if (target?.prefs.push_enabled) {
        const { userId: pushUserId } = target;
        const dayIndex = new Date(`${date}T12:00:00+02:00`).getDay();
        const dayName  = DAY_NAMES[dayIndex];

        let pushBody = "Open LifeOS to see your day.";
        const summary = summaryText.trim();
        if (summary) {
          const firstSentence = summary.split(/(?<=[.!?])\s+/)[0] ?? summary;
          pushBody = firstSentence.length > 120
            ? `${firstSentence.slice(0, 117)}…`
            : firstSentence;
        }

        pushResult = await sendPushToUser(pushUserId, {
          title: `Your ${dayName} briefing`,
          body:  pushBody,
          icon:  "/icons/icon-192x192.png",
          badge: "/icons/icon-96x96.png",
          tag:   "daily-briefing",
          url:   "/today",
        }) as Record<string, unknown>;
      }
    } catch (err) {
      console.error("[briefing/generate] push failed:", err);
    }

    return NextResponse.json({
      ok:             true,
      briefing_id:    briefing.id,
      date:           briefing.date,
      generated_at:   briefing.generated_at,
      summary_length: summaryText.length,
      push:           pushResult,
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

import { NextResponse }           from "next/server";
import { sendPushToUser }         from "@/lib/push/send";
import { getBriefingPushTarget }  from "@/lib/push/actions";
import { todayInSAST }            from "@/lib/utils/date";

const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

// Vercel Cron calls this endpoint at each configured time slot.
// The ?slot=HHMM query param identifies which slot is firing.
// The route only sends the push if the user's preferred time matches.
//
// Slots in vercel.json (SAST = UTC+2):
//   05:30 → slot=0530, schedule "30 3 * * *"
//   06:00 → slot=0600, schedule "0 4 * * *"
//   06:30 → slot=0630, schedule "30 4 * * *"
//   07:00 → slot=0700, schedule "0 5 * * *"
//   07:30 → slot=0730, schedule "30 5 * * *"
export async function POST(req: Request) {
  // ── Auth ────────────────────────────────────────────────────────
  const secret = req.headers.get("x-cron-secret");
  if (!secret || secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(req.url);
    const slot = searchParams.get("slot") ?? "0530"; // e.g. "0530"

    const target = await getBriefingPushTarget();
    if (!target) {
      return NextResponse.json({ skipped: "no user found" });
    }

    const { userId, prefs } = target;

    // Convert stored "HH:MM" to "HHMM" for comparison
    const preferredSlot = prefs.briefing_time.replace(":", "");

    if (!prefs.push_enabled || preferredSlot !== slot) {
      return NextResponse.json({
        skipped: !prefs.push_enabled ? "push disabled" : `slot mismatch (preferred ${preferredSlot})`,
      });
    }

    // Build notification payload
    const today    = todayInSAST();
    const dayIndex = new Date(today + "T12:00:00+02:00").getDay();
    const dayName  = DAY_NAMES[dayIndex];

    const result = await sendPushToUser(userId, {
      title: `Your ${dayName} briefing is ready`,
      body:  "Open LifeOS to see your day.",
      icon:  "/icons/icon-192x192.png",
      badge: "/icons/icon-96x96.png",
      tag:   "daily-briefing",
      url:   "/today",
    });

    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("[push/briefing]", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

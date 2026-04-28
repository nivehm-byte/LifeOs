import { NextResponse }           from "next/server";
import { createClient }           from "@/lib/supabase/server";
import { sendPushToUser }         from "@/lib/push/send";

export async function POST() {
  try {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const result = await sendPushToUser(user.id, {
      title: "LifeOS test notification",
      body:  "Push notifications are working.",
      icon:  "/icons/icon-192x192.png",
      tag:   "test",
      url:   "/today",
    });

    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

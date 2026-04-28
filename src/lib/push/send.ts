import webpush from "web-push";
import { createServiceClient } from "@/lib/supabase/server";

function initVapid() {
  webpush.setVapidDetails(
    `mailto:${process.env.VAPID_SUBJECT ?? "admin@lifeos.app"}`,
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
    process.env.VAPID_PRIVATE_KEY!,
  );
}

export interface PushPayload {
  title:  string;
  body?:  string;
  icon?:  string;
  badge?: string;
  tag?:   string;
  url?:   string;
}

// Sends a push notification to every subscription belonging to userId.
// Silently removes subscriptions that return 410 (gone / unsubscribed).
export async function sendPushToUser(
  userId:  string,
  payload: PushPayload,
): Promise<{ sent: number; removed: number }> {
  initVapid();

  const supabase = createServiceClient();
  const { data: subs, error } = await supabase
    .from("push_subscriptions")
    .select("id, endpoint, p256dh, auth")
    .eq("user_id", userId);

  if (error) throw new Error(`Failed to load subscriptions: ${error.message}`);
  if (!subs?.length) return { sent: 0, removed: 0 };

  const staleIds: string[] = [];
  let sent = 0;

  await Promise.all(
    subs.map(async (sub) => {
      try {
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          JSON.stringify(payload),
          { TTL: 3600 }, // expire after 1 hour if device is offline
        );
        sent++;
      } catch (err: unknown) {
        // 410 Gone = subscription is no longer valid
        const statusCode = (err as { statusCode?: number })?.statusCode;
        if (statusCode === 410 || statusCode === 404) {
          staleIds.push(sub.id);
        }
      }
    }),
  );

  // Clean up stale subscriptions
  if (staleIds.length) {
    await supabase.from("push_subscriptions").delete().in("id", staleIds);
  }

  return { sent, removed: staleIds.length };
}

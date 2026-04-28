"use server";

import { revalidatePath }    from "next/cache";
import { createClient }      from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/server";

// ----------------------------------------------------------------
// Notification preference shape stored in users.notification_preferences
// ----------------------------------------------------------------
export interface NotificationPrefs {
  push_enabled:  boolean;
  briefing_time: string; // "HH:MM" in SAST — e.g. "05:30"
}

const PREF_DEFAULTS: NotificationPrefs = {
  push_enabled:  false,
  briefing_time: "05:30",
};

export async function getNotificationPrefs(): Promise<NotificationPrefs> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return PREF_DEFAULTS;

  const { data } = await supabase
    .from("users")
    .select("notification_preferences")
    .eq("id", user.id)
    .single();

  if (!data?.notification_preferences) return PREF_DEFAULTS;
  const raw = data.notification_preferences as Partial<NotificationPrefs>;

  return {
    push_enabled:  raw.push_enabled  ?? PREF_DEFAULTS.push_enabled,
    briefing_time: raw.briefing_time ?? PREF_DEFAULTS.briefing_time,
  };
}

export async function updateNotificationPrefs(
  prefs: Partial<NotificationPrefs>,
): Promise<void> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  // Merge with existing preferences (don't overwrite unrelated keys)
  const { data: existing } = await supabase
    .from("users")
    .select("notification_preferences")
    .eq("id", user.id)
    .single();

  const merged = {
    ...((existing?.notification_preferences as object) ?? {}),
    ...prefs,
  };

  const { error } = await supabase
    .from("users")
    .update({ notification_preferences: merged })
    .eq("id", user.id);

  if (error) throw new Error(error.message);
  revalidatePath("/settings/notifications");
}

// ----------------------------------------------------------------
// Push subscription management
// ----------------------------------------------------------------
export interface SubscriptionInput {
  endpoint:  string;
  p256dh:    string;
  auth:      string;
  userAgent?: string;
}

export async function saveSubscription(input: SubscriptionInput): Promise<void> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const { error } = await supabase
    .from("push_subscriptions")
    .upsert(
      {
        user_id:    user.id,
        endpoint:   input.endpoint,
        p256dh:     input.p256dh,
        auth:       input.auth,
        user_agent: input.userAgent ?? null,
      },
      { onConflict: "endpoint" },
    );

  if (error) throw new Error(error.message);

  // Mark push as enabled in preferences when a subscription is saved
  await updateNotificationPrefs({ push_enabled: true });
}

export async function removeSubscription(endpoint: string): Promise<void> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  // Check if any other subscriptions remain after removal
  const { data: remaining } = await supabase
    .from("push_subscriptions")
    .select("id")
    .eq("user_id", user.id)
    .neq("endpoint", endpoint);

  const { error } = await supabase
    .from("push_subscriptions")
    .delete()
    .eq("endpoint", endpoint)
    .eq("user_id", user.id);

  if (error) throw new Error(error.message);

  // Disable push if no subscriptions remain
  if (!remaining?.length) {
    await updateNotificationPrefs({ push_enabled: false });
  }
}

// ----------------------------------------------------------------
// Used by the briefing cron to find the owner user_id + check prefs
// ----------------------------------------------------------------
export async function getBriefingPushTarget(): Promise<{
  userId: string;
  prefs:  NotificationPrefs;
} | null> {
  const supabase = createServiceClient();

  const { data: userRow } = await supabase
    .from("users")
    .select("id, notification_preferences")
    .limit(1)
    .single();

  if (!userRow) return null;

  const raw = (userRow.notification_preferences ?? {}) as Partial<NotificationPrefs>;
  return {
    userId: userRow.id,
    prefs: {
      push_enabled:  raw.push_enabled  ?? false,
      briefing_time: raw.briefing_time ?? "05:30",
    },
  };
}

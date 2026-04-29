"use client";

import { useEffect, useState, useTransition } from "react";
import { updateNotificationPrefs }             from "@/lib/push/actions";
import type { NotificationPrefs }              from "@/lib/push/actions";

interface Props {
  initialPrefs: NotificationPrefs;
}

const TIME_SLOTS = [
  { value: "05:30", label: "5:30 am" },
  { value: "06:00", label: "6:00 am" },
  { value: "06:30", label: "6:30 am" },
  { value: "07:00", label: "7:00 am" },
  { value: "07:30", label: "7:30 am" },
] as const;

type PermissionState = "unsupported" | "default" | "granted" | "denied";

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64  = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw     = atob(base64);
  return Uint8Array.from(Array.from(raw, (c) => c.charCodeAt(0)));
}

export function NotificationSettings({ initialPrefs }: Props) {
  const [prefs,      setPrefs]      = useState<NotificationPrefs>(initialPrefs);
  const [permission, setPermission] = useState<PermissionState>("unsupported");
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [isPending,  start]         = useTransition();
  const [status,     setStatus]     = useState<string | null>(null);

  // ── Detect browser support + current state on mount ────────────
  useEffect(() => {
    if (
      typeof window === "undefined" ||
      !("Notification" in window)   ||
      !("serviceWorker" in navigator) ||
      !("PushManager" in window)
    ) {
      setPermission("unsupported");
      return;
    }

    setPermission(Notification.permission as PermissionState);

    // Check if we already have an active subscription
    navigator.serviceWorker.ready.then((reg) =>
      reg.pushManager.getSubscription()
    ).then((sub) => {
      setIsSubscribed(!!sub);
    }).catch(() => {});
  }, []);

  // ── Subscribe ───────────────────────────────────────────────────
  async function subscribe() {
    setStatus(null);
    try {
      const reg = await navigator.serviceWorker.ready;

      let perm = Notification.permission;
      if (perm === "default") {
        perm = await Notification.requestPermission();
        setPermission(perm as PermissionState);
      }
      if (perm !== "granted") {
        setStatus("Permission denied. Enable notifications in your browser settings.");
        return;
      }

      const vapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
      if (!vapidKey) {
        setStatus("Push not configured (missing VAPID key).");
        return;
      }

      const sub = await reg.pushManager.subscribe({
        userVisibleOnly:      true,
        applicationServerKey: urlBase64ToUint8Array(vapidKey).buffer as ArrayBuffer,
      });

      const json = sub.toJSON() as {
        endpoint: string;
        keys: { p256dh: string; auth: string };
      };

      const res = await fetch("/api/push/subscribe", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify(json),
      });

      if (!res.ok) throw new Error("Failed to save subscription");

      setIsSubscribed(true);
      setPrefs((p) => ({ ...p, push_enabled: true }));
      setStatus("Notifications enabled.");
    } catch (err) {
      setStatus(err instanceof Error ? err.message : "Could not subscribe.");
    }
  }

  // ── Unsubscribe ─────────────────────────────────────────────────
  async function unsubscribe() {
    setStatus(null);
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();

      if (sub) {
        await sub.unsubscribe();
        await fetch("/api/push/subscribe", {
          method:  "DELETE",
          headers: { "Content-Type": "application/json" },
          body:    JSON.stringify({ endpoint: sub.endpoint }),
        });
      }

      setIsSubscribed(false);
      setPrefs((p) => ({ ...p, push_enabled: false }));
      setStatus("Notifications disabled.");
    } catch (err) {
      setStatus(err instanceof Error ? err.message : "Could not unsubscribe.");
    }
  }

  // ── Save time preference ────────────────────────────────────────
  function saveTime(time: string) {
    setPrefs((p) => ({ ...p, briefing_time: time }));
    start(async () => {
      try {
        await updateNotificationPrefs({ briefing_time: time });
        setStatus("Briefing time saved.");
      } catch {
        setStatus("Failed to save preference.");
      }
    });
  }

  // ── Send test push ──────────────────────────────────────────────
  async function sendTest() {
    setStatus(null);
    try {
      const res = await fetch("/api/push/test", { method: "POST" });
      if (!res.ok) throw new Error("Test failed");
      setStatus("Test notification sent.");
    } catch {
      setStatus("Could not send test (is push enabled?).");
    }
  }

  // ── Render ──────────────────────────────────────────────────────
  const canPush = permission !== "unsupported";
  const isDenied = permission === "denied";

  return (
    <div className="space-y-8">

      {/* Push toggle */}
      <section>
        <div className="flex items-center gap-3 mb-4">
          <span className="text-xs font-semibold tracking-[0.15em] uppercase text-text-secondary">
            Push Notifications
          </span>
          <div className="flex-1 h-px bg-surface-raised" />
        </div>

        {!canPush ? (
          <div
            className="rounded-xl px-4 py-3.5 text-sm text-text-muted"
            style={{ backgroundColor: "#1A1510", border: "1px solid #241E17" }}
          >
            Push notifications are not supported in this browser. Install LifeOS as a
            PWA or use a compatible browser.
          </div>
        ) : isDenied ? (
          <div
            className="rounded-xl px-4 py-3.5 text-sm text-status-urgent"
            style={{ backgroundColor: "#E05C5C0D", border: "1px solid #E05C5C26" }}
          >
            Notifications are blocked. Open your browser settings and allow
            notifications for this site, then come back here.
          </div>
        ) : (
          <div
            className="rounded-xl overflow-hidden"
            style={{ backgroundColor: "#1A1510", border: "1px solid #241E17" }}
          >
            <div className="flex items-center justify-between px-4 py-4">
              <div>
                <p className="text-sm text-text-primary font-medium">Morning briefing</p>
                <p className="text-xs text-text-muted mt-0.5">
                  Daily push when your briefing is generated
                </p>
              </div>

              {/* Toggle */}
              <button
                onClick={isSubscribed ? unsubscribe : subscribe}
                className="relative w-11 h-6 rounded-full transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/50"
                style={{
                  backgroundColor: isSubscribed ? "#D4A96A" : "#3A3028",
                }}
                aria-label={isSubscribed ? "Disable notifications" : "Enable notifications"}
              >
                <span
                  className="absolute top-0.5 w-5 h-5 rounded-full bg-canvas shadow transition-transform"
                  style={{ transform: isSubscribed ? "translateX(22px)" : "translateX(2px)" }}
                />
              </button>
            </div>

            {isSubscribed && (
              <div
                className="border-t px-4 py-3 flex items-center justify-between"
                style={{ borderColor: "#241E17" }}
              >
                <p className="text-xs text-text-muted">Test that it&apos;s working</p>
                <button
                  onClick={sendTest}
                  className="text-xs text-accent hover:text-accent/80 transition-colors"
                >
                  Send test
                </button>
              </div>
            )}
          </div>
        )}
      </section>

      {/* Briefing time */}
      <section>
        <div className="flex items-center gap-3 mb-4">
          <span className="text-xs font-semibold tracking-[0.15em] uppercase text-text-secondary">
            Briefing Time
          </span>
          <div className="flex-1 h-px bg-surface-raised" />
        </div>

        <div className="grid grid-cols-5 gap-2">
          {TIME_SLOTS.map(({ value, label }) => {
            const selected = prefs.briefing_time === value;
            return (
              <button
                key={value}
                onClick={() => saveTime(value)}
                disabled={isPending}
                className="py-2.5 rounded-xl text-xs font-medium transition-all"
                style={{
                  backgroundColor: selected ? "#D4A96A26" : "#1A1510",
                  border:          `1px solid ${selected ? "#D4A96A60" : "#241E17"}`,
                  color:           selected ? "#D4A96A" : "#6B5C4A",
                }}
              >
                {label}
              </button>
            );
          })}
        </div>

        <p className="mt-3 text-[11px] text-text-muted leading-relaxed">
          All times are SAST (UTC+2). The briefing is generated 10 minutes earlier
          so it&apos;s ready when the notification arrives.
        </p>
      </section>

      {/* Status toast */}
      {status && (
        <p className="text-xs text-text-secondary px-1">{status}</p>
      )}
    </div>
  );
}

import { NotificationSettings } from "@/components/settings/NotificationSettings";
import { getNotificationPrefs }  from "@/lib/push/actions";
import Link                      from "next/link";

export default async function NotificationsPage() {
  const prefs = await getNotificationPrefs();

  return (
    <div>
      {/* Header */}
      <header className="pt-2 mb-8">
        <Link
          href="/today"
          className="inline-flex items-center gap-1.5 text-xs text-text-muted mb-4 hover:text-text-secondary transition-colors"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 18 9 12 15 6"/>
          </svg>
          Today
        </Link>

        <h1 className="font-heading text-3xl text-text-primary">Notifications</h1>
        <p className="text-sm text-text-muted mt-1.5">
          Manage your daily briefing push notifications.
        </p>

        <div className="mt-5 h-px bg-surface-raised" />
      </header>

      <NotificationSettings initialPrefs={prefs} />
    </div>
  );
}

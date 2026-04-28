// Custom service worker code injected by next-pwa.
// Handles push events and notification clicks.

declare const self: ServiceWorkerGlobalScope;

interface PushPayload {
  title:   string;
  body?:   string;
  icon?:   string;
  badge?:  string;
  tag?:    string;
  url?:    string;
}

self.addEventListener("push", (event) => {
  if (!event.data) return;

  let payload: PushPayload;
  try {
    payload = event.data.json() as PushPayload;
  } catch {
    payload = { title: event.data.text() };
  }

  event.waitUntil(
    self.registration.showNotification(payload.title, {
      body:  payload.body  ?? "",
      icon:  payload.icon  ?? "/icons/icon-192x192.png",
      badge: payload.badge ?? "/icons/icon-96x96.png",
      tag:   payload.tag   ?? "lifeos",
      data:  { url: payload.url ?? "/today" },
    })
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  const url = (event.notification.data as { url?: string })?.url ?? "/today";

  event.waitUntil(
    self.clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((clients) => {
        // Bring existing window into focus if it matches the target URL
        const match = clients.find((c) => c.url.includes(url) && "focus" in c);
        if (match) return (match as WindowClient).focus();
        return self.clients.openWindow(url);
      })
  );
});

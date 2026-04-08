/**
 * Cleopatra Service Worker — Web Push handler.
 *
 * This file is served from /sw.js (Next.js public/). It:
 *   1. Receives push events from the browser push service
 *   2. Shows a notification matching the payload
 *   3. Handles click events by focusing or opening the app at the right URL
 *
 * Payload shape (sent from /api/push/send):
 *   {
 *     title: string,
 *     body: string,
 *     icon?: string,
 *     badge?: string,
 *     url?: string,        // path to open on click
 *     tag?: string,        // dedupes multiple notifications (e.g. "msg:<user-id>")
 *     timestamp?: number,
 *   }
 */

self.addEventListener("install", (event) => {
  // Activate immediately on install
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  // Claim all clients so updates take effect without a reload
  event.waitUntil(self.clients.claim());
});

self.addEventListener("push", (event) => {
  if (!event.data) return;

  let payload;
  try {
    payload = event.data.json();
  } catch {
    payload = { title: "Cleopatra", body: event.data.text() };
  }

  const {
    title = "Cleopatra",
    body = "",
    icon = "/icon-192.png",
    badge = "/badge-72.png",
    url = "/",
    tag,
    timestamp = Date.now(),
  } = payload;

  const options = {
    body,
    icon,
    badge,
    tag,
    timestamp,
    data: { url },
    // Vibrate pattern for mobile devices
    vibrate: [80, 40, 80],
    // Keep notification until user interacts (especially important on Android)
    requireInteraction: false,
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const targetUrl = event.notification.data?.url || "/";

  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clients) => {
      // If a window for this app is already open, focus it and navigate there
      for (const client of clients) {
        const clientUrl = new URL(client.url);
        if (clientUrl.origin === self.location.origin && "focus" in client) {
          client.focus();
          if ("navigate" in client) {
            return client.navigate(targetUrl);
          }
          return;
        }
      }
      // Otherwise open a new window
      if (self.clients.openWindow) {
        return self.clients.openWindow(targetUrl);
      }
    })
  );
});

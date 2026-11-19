// CareCircle service worker: shows visit notifications and opens the site when
// one is tapped. It caches no pages. Names below must match lib/push-message.ts.

const RECORD_CACHE = "carecircle-visit-records";
const recordCacheKey = (id) => `/__visit-record/${encodeURIComponent(id)}`;

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));

self.addEventListener("push", (event) => {
  let msg;
  try {
    msg = event.data ? event.data.json() : null;
  } catch {
    msg = null;
  }
  if (!msg || !msg.title) msg = { title: "CareCircle", body: "There's a new update. Tap to open.", url: "/family/dashboard" };

  event.waitUntil(
    (async () => {
      // Keep the visit record on this phone until the family signs in to see it.
      if (msg.record) {
        try {
          const id = new URL(msg.url, self.location.origin).searchParams.get("u");
          if (id) {
            const cache = await caches.open(RECORD_CACHE);
            await cache.put(recordCacheKey(id), new Response(msg.record, { headers: { "Content-Type": "application/json" } }));
          }
        } catch {
          // No cache: the page falls back to the dashboard.
        }
      }
      await self.registration.showNotification(msg.title, {
        body: msg.body,
        tag: msg.tag,
        renotify: true,
        icon: "/push-icon",
        badge: "/push-badge",
        vibrate: [120, 60, 120],
        data: { url: msg.url || "/family/dashboard" },
      });
    })(),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = new URL((event.notification.data && event.notification.data.url) || "/family/dashboard", self.location.origin).href;
  event.waitUntil(
    (async () => {
      const open = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      for (const client of open) {
        if (new URL(client.url).origin === self.location.origin && "navigate" in client) {
          await client.focus();
          return client.navigate(url);
        }
      }
      return self.clients.openWindow(url);
    })(),
  );
});

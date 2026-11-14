// Itan service worker (FR-16, NFR-12). Hand-written, deliberately small.
// - Caches the app shell and static assets so the patient app opens with no connection.
// - NEVER caches /api, /c, /v or any request that is not a GET: patient data and clinician views must not sit on a device cache.
// - The upload queue itself lives in IndexedDB (lib/upload-queue.ts), not here, so Background Sync support is not needed.
const CACHE = "itan-shell-v1";
const SHELL = ["/", "/sign-in", "/app", "/app/capture"];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE).then((c) => Promise.all(SHELL.map((u) => c.add(u).catch(() => undefined)))));
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()),
  );
});

const never = (url) => url.pathname.startsWith("/api/") || url.pathname.startsWith("/c") || url.pathname.startsWith("/v");

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin || never(url)) return;

  if (url.pathname.startsWith("/_next/static/") || /\.(woff2?|png|svg|ico|webmanifest)$/.test(url.pathname)) {
    // Static, versioned assets: cache first.
    event.respondWith(
      caches.match(req).then(
        (hit) =>
          hit ||
          fetch(req).then((res) => {
            const copy = res.clone();
            caches.open(CACHE).then((c) => c.put(req, copy));
            return res;
          }),
      ),
    );
    return;
  }

  if (req.mode === "navigate") {
    // Pages: network first, fall back to the cached shell when offline.
    event.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(req, copy));
          return res;
        })
        .catch(() => caches.match(req).then((hit) => hit || caches.match("/app") || caches.match("/"))),
    );
  }
});

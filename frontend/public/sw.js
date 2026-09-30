// MedRemind Service Worker — offline support + background push notifications
const CACHE_NAME = "medremind-v3";

// App shell files to pre-cache on install
const APP_SHELL = [
  "/",
  "/index.html",
  "/manifest.json",
  "/favicon.ico",
  "/logo192.png",
  "/medremind-icon-192.svg"
];

// ── Install: pre-cache app shell with resilient error handling ────────────────
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(async (cache) => {
      // Use Promise.allSettled so a single missing asset doesn't abort service worker installation
      await Promise.allSettled(
        APP_SHELL.map((url) =>
          cache.add(url).catch((err) => console.warn(`[SW] Pre-cache skipped for ${url}:`, err.message))
        )
      );
      return self.skipWaiting();
    })
  );
});

// ── Activate: clean up old caches ─────────────────────────────────────────────
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) =>
        Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
      )
      .then(() => self.clients.claim())
  );
});

// ── Fetch: offline-capable network strategy ───────────────────────────────────
self.addEventListener("fetch", (event) => {
  const { request } = event;

  // Only handle GET requests
  if (request.method !== "GET") return;

  const url = new URL(request.url);

  // CRITICAL: NEVER intercept cross-origin requests (e.g. backend running on Render or custom domain)
  if (url.origin !== self.location.origin) return;

  // CRITICAL: NEVER intercept any API calls (dynamic data must always hit network)
  if (
    url.pathname.startsWith("/api") ||
    url.pathname.startsWith("/auth") ||
    url.pathname.startsWith("/medicine") ||
    url.pathname.startsWith("/caregiver") ||
    url.pathname.startsWith("/admin") ||
    url.pathname.startsWith("/vapid-public-key") ||
    url.pathname.startsWith("/save-subscription") ||
    url.pathname.startsWith("/send-notification")
  ) {
    return;
  }

  // Navigation requests (page loads, refreshes): network first, fall back to /index.html
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request).catch(() => caches.match("/index.html"))
    );
    return;
  }

  // Static assets: cache first, fallback to network
  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) return cached;

      return fetch(request)
        .then((response) => {
          if (
            response &&
            response.status === 200 &&
            (response.type === "basic" || response.type === "cors")
          ) {
            const cloned = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, cloned));
          }
          return response;
        })
        .catch(() => caches.match(request));
    })
  );
});

// ── Push: show notification even when app is closed or offline ────────────────
self.addEventListener("push", (event) => {
  if (!event.data) return;

  let data = {};
  try {
    data = event.data.json();
  } catch {
    data = { title: "MedRemind", body: event.data.text() };
  }

  const title   = data.title || "MedRemind";
  const options = {
    body:               data.body  || "",
    icon:               data.icon  || "/medremind-icon-192.svg",
    badge:              "/medremind-icon-192.svg",
    tag:                data.tag   || "medremind",
    requireInteraction: true,
    vibrate:            [200, 100, 200, 100, 200, 100, 200], // Wakes mobile device from sleep
    data: { url: `${self.location.origin}/dashboard` }
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

// ── Notification click: open /dashboard ───────────────────────────────────────
self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  const url = event.notification.data?.url || `${self.location.origin}/dashboard`;

  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url.startsWith(self.location.origin) && "focus" in client) {
          client.navigate(url);
          return client.focus();
        }
      }
      if (clients.openWindow) return clients.openWindow(url);
    })
  );
});

// MedRemind Service Worker — offline support + background push notifications
const CACHE_NAME = "medremind-v2";

// App shell files to pre-cache on install
const APP_SHELL = [
  "/",
  "/index.html",
  "/manifest.json",
  "/favicon.ico",
  "/logo192.png",
  "/medremind-icon-192.svg"
];

// ── Install: pre-cache app shell ──────────────────────────────────────────────
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(APP_SHELL))
      .then(() => self.skipWaiting()) // Activate immediately
  );
});

// ── Activate: clean up old caches ─────────────────────────────────────────────
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) =>
        Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
      )
      .then(() => self.clients.claim()) // Take control of open pages immediately
  );
});

// ── Fetch: offline-capable network strategy ───────────────────────────────────
self.addEventListener("fetch", (event) => {
  const { request } = event;

  // Only handle GET requests
  if (request.method !== "GET") return;

  const url = new URL(request.url);

  // Never intercept API calls — always go to network for fresh data
  if (url.pathname.startsWith("/api/")) return;

  // Navigation requests (page loads, refreshes): network first, fall back to /index.html
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .catch(() => caches.match("/index.html"))
    );
    return;
  }

  // Static assets: cache first, then network; cache new assets as they load
  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) return cached;

      return fetch(request).then((response) => {
        // Only cache successful same-origin responses
        if (
          response &&
          response.status === 200 &&
          (response.type === "basic" || response.type === "cors")
        ) {
          const cloned = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, cloned));
        }
        return response;
      }).catch(() => new Response("", { status: 503, statusText: "Offline" }));
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
    vibrate:            [200, 100, 200, 100, 200, 100, 200], // CRITICAL: Wakes Android from sleep
    // Store the dashboard URL in notification data so notificationclick can open it
    data: { url: `${self.location.origin}/dashboard` }
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

// ── Notification click: open /dashboard (not just origin root) ────────────────
self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  // Always direct to dashboard — not the login page
  const url = event.notification.data?.url || `${self.location.origin}/dashboard`;

  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientList) => {
      // If the app is already open in a tab, navigate it to dashboard and focus it
      for (const client of clientList) {
        if (client.url.startsWith(self.location.origin) && "focus" in client) {
          client.navigate(url);
          return client.focus();
        }
      }
      // App is not open — launch a new window at dashboard
      if (clients.openWindow) return clients.openWindow(url);
    })
  );
});

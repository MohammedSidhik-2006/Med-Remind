// MedRemind Service Worker — Production-Grade Notification Engine v7
// Fixes: timezone, double-fire, missing action data, duplicate intervals, cache bloat
const CACHE_NAME = "medremind-v7";
const DB_NAME = "MedRemindOfflineDB";
const DB_VERSION = 2; // Bumped to trigger onupgradeneeded for new store

// App shell files to pre-cache on install
const APP_SHELL = [
  "/",
  "/index.html",
  "/manifest.json",
  "/favicon.ico",
  "/logo192.png",
  "/medremind-icon-192.svg"
];

// ── Timezone-aware local time (IST = UTC+5:30) ────────────────────────────────
// CRITICAL: Always compute time in IST regardless of device locale/timezone.
// Mobile users globally must get alerts at the correct IST-scheduled time.
function getISTDateTime() {
  const now = new Date();
  // UTC offset for IST is +5:30 = 330 minutes
  const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;
  const istMs = now.getTime() + IST_OFFSET_MS;
  const ist = new Date(istMs);

  const year   = ist.getUTCFullYear();
  const month  = String(ist.getUTCMonth() + 1).padStart(2, "0");
  const day    = String(ist.getUTCDate()).padStart(2, "0");
  const hours  = String(ist.getUTCHours()).padStart(2, "0");
  const mins   = String(ist.getUTCMinutes()).padStart(2, "0");

  return {
    today:       `${year}-${month}-${day}`,
    currentTime: `${hours}:${mins}`,
    nowMs:       now.getTime()
  };
}

// ── IndexedDB Engine ──────────────────────────────────────────────────────────
function openDatabase() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains("schedules")) {
        db.createObjectStore("schedules", { keyPath: "_id" });
      }
      if (!db.objectStoreNames.contains("notified_events")) {
        const store = db.createObjectStore("notified_events", { keyPath: "key" });
        // Index by timestamp so we can prune old entries efficiently
        store.createIndex("byTimestamp", "timestamp");
      }
      if (!db.objectStoreNames.contains("offline_queue")) {
        db.createObjectStore("offline_queue", { keyPath: "id", autoIncrement: true });
      }
      if (!db.objectStoreNames.contains("settings")) {
        db.createObjectStore("settings", { keyPath: "key" });
      }
    };
    req.onsuccess  = () => resolve(req.result);
    req.onerror    = () => reject(req.error);
  });
}

function getAllFromStore(db, storeName) {
  return new Promise((resolve) => {
    try {
      const tx    = db.transaction(storeName, "readonly");
      const store = tx.objectStore(storeName);
      const req   = store.getAll();
      req.onsuccess = () => resolve(req.result || []);
      req.onerror   = () => resolve([]);
    } catch { resolve([]); }
  });
}

function getFromStore(db, storeName, key) {
  return new Promise((resolve) => {
    try {
      const tx    = db.transaction(storeName, "readonly");
      const store = tx.objectStore(storeName);
      const req   = store.get(key);
      req.onsuccess = () => resolve(req.result || null);
      req.onerror   = () => resolve(null);
    } catch { resolve(null); }
  });
}

function putInStore(db, storeName, value) {
  return new Promise((resolve) => {
    try {
      const tx    = db.transaction(storeName, "readwrite");
      const store = tx.objectStore(storeName);
      const req   = store.put(value);
      req.onsuccess = () => resolve(true);
      req.onerror   = () => resolve(false);
    } catch { resolve(false); }
  });
}

function deleteFromStore(db, storeName, key) {
  return new Promise((resolve) => {
    try {
      const tx    = db.transaction(storeName, "readwrite");
      const store = tx.objectStore(storeName);
      const req   = store.delete(key);
      req.onsuccess = () => resolve(true);
      req.onerror   = () => resolve(false);
    } catch { resolve(false); }
  });
}

// ── Prune notified_events older than 48 hours (prevents IndexedDB bloat) ─────
async function pruneNotifiedEvents(db) {
  try {
    const cutoff = Date.now() - 48 * 60 * 60 * 1000;
    const tx     = db.transaction("notified_events", "readwrite");
    const store  = tx.objectStore("notified_events");
    const idx    = store.index("byTimestamp");
    const range  = IDBKeyRange.upperBound(cutoff);
    const req    = idx.openCursor(range);
    req.onsuccess = (e) => {
      const cursor = e.target.result;
      if (cursor) { cursor.delete(); cursor.continue(); }
    };
  } catch (e) {
    // byTimestamp index may not exist in old DB version — safe to skip
  }
}

// ── Core: Check and fire due medication notifications ─────────────────────────
// Uses IST time so notifications fire correctly regardless of device locale.
// Deduplicates per slot per day so only one notification fires per medicine per time.
// Does NOT fire if the server already sent a push (prevents doubling).
async function checkDueMedications() {
  try {
    const db = await openDatabase();
    const schedules = await getAllFromStore(db, "schedules");
    if (!schedules || schedules.length === 0) return;

    const { today, currentTime, nowMs } = getISTDateTime();

    // Prune old entries periodically (run ~every 30 minutes)
    if (Math.floor(nowMs / 1000) % 1800 < 30) {
      await pruneNotifiedEvents(db);
    }

    for (const med of schedules) {
      if (!med || !med.name) continue;

      // Respect medicine start/end date window
      if (med.startDate && today < med.startDate) continue;
      if (med.endDate   && today > med.endDate)   continue;

      const allTimes = Array.isArray(med.times) && med.times.length > 0
        ? med.times
        : (med.time ? [med.time] : []);

      const isSnoozeMatured = med.snoozedUntil &&
        new Date(med.snoozedUntil).getTime() <= nowMs;

      for (const slotTime of allTimes) {
        if (!slotTime) continue;

        const isCurrentSlot = (slotTime === currentTime);
        if (!isCurrentSlot && !isSnoozeMatured) continue;

        // If the dose was already taken (marked in local cache), skip
        if (med.taken && !isSnoozeMatured) continue;

        // Per-slot deduplication key — unique per day + medicine + scheduled time
        const slotKey = `${today}_${med._id}_${slotTime}`;
        const alreadyFired = await getFromStore(db, "notified_events", slotKey);
        if (alreadyFired) continue;

        // Mark as fired BEFORE showing notification to prevent race in fast intervals
        await putInStore(db, "notified_events", { key: slotKey, timestamp: nowMs });

        if (isSnoozeMatured) {
          // Clear snooze from local cache
          med.snoozedUntil = null;
          await putInStore(db, "schedules", med);
        }

        // Show the OS notification with full action data
        await self.registration.showNotification(`💊 Time to take ${med.name}`, {
          body:               `${med.dosage} scheduled for ${slotTime}. Tap to confirm your dose.`,
          icon:               "/medremind-icon-192.svg",
          badge:              "/medremind-icon-192.svg",
          tag:                `local-med-${med._id}-${slotTime}`,
          renotify:           true,   // Force Android to re-display even if same tag
          requireInteraction: true,   // Keep on screen until user acts
          silent:             false,
          vibrate:            [300, 150, 300, 150, 300],
          actions: [
            { action: "take",   title: "✅ Take Now" },
            { action: "snooze", title: "⏰ Snooze 10m" }
          ],
          data: {
            url:           "/dashboard",
            medicineId:    med._id,
            medicineName:  med.name,
            dosage:        med.dosage,
            scheduledTime: slotTime,
            source:        "local"
          }
        });
      }

      // ── Low-stock local alert ─────────────────────────────────────────────
      if (
        typeof med.stock    === "number" &&
        typeof med.refillAt === "number" &&
        med.stock <= med.refillAt &&
        med.stock >= 0
      ) {
        const refillKey = `${today}_refill_${med._id}`;
        const alreadyRefillFired = await getFromStore(db, "notified_events", refillKey);
        if (!alreadyRefillFired) {
          await putInStore(db, "notified_events", { key: refillKey, timestamp: nowMs });
          await self.registration.showNotification(`📦 Low Stock Alert: ${med.name}`, {
            body:    `Only ${med.stock} dose${med.stock !== 1 ? "s" : ""} remaining (refill at: ${med.refillAt}). Tap to view refill tracker.`,
            icon:    "/medremind-icon-192.svg",
            badge:   "/medremind-icon-192.svg",
            tag:     `local-refill-${med._id}`,
            renotify: true,
            vibrate: [250, 100, 250],
            actions: [{ action: "refill", title: "📦 Refill Now" }],
            data:    { url: "/refill", medicineId: med._id }
          });
        }
      }
    }
  } catch (err) {
    console.warn("[SW] checkDueMedications error:", err);
  }
}

// ── Flush Offline Dose Queue to Backend ───────────────────────────────────────
async function flushOfflineQueue() {
  try {
    const db    = await openDatabase();
    const queue = await getAllFromStore(db, "offline_queue");
    if (!queue || queue.length === 0) return;

    const tokenSetting  = await getFromStore(db, "settings", "authToken");
    const token         = tokenSetting?.value;
    if (!token) return;

    const apiSetting = await getFromStore(db, "settings", "apiBaseUrl");
    const apiBase    = (apiSetting?.value || "https://medi-time-2peh.onrender.com").replace(/\/+$/, "");

    for (const item of queue) {
      try {
        const res = await fetch(`${apiBase}/api/medicine/taken/${item.medicineId}`, {
          method:  "PATCH",
          headers: {
            "Content-Type":  "application/json",
            "Authorization": `Bearer ${token}`
          },
          body: JSON.stringify({ scheduledTime: item.scheduledTime })
        });
        if (res.ok) {
          await deleteFromStore(db, "offline_queue", item.id);
          console.log(`[SW] Offline dose synced: ${item.medicineId}`);
        }
      } catch {
        break; // Still offline — retry on next sync event
      }
    }
  } catch (err) {
    console.warn("[SW] flushOfflineQueue error:", err);
  }
}

// ── Background Alarm Heartbeat (single interval, started once in activate) ────
// Checks every 30 seconds to catch the exact scheduled minute.
// Single instance guard prevents overlapping setIntervals.
let _heartbeatInterval = null;

function startAlarmHeartbeat() {
  if (_heartbeatInterval) {
    clearInterval(_heartbeatInterval);
    _heartbeatInterval = null;
  }
  // Run immediately
  checkDueMedications();
  // Then every 30 seconds
  _heartbeatInterval = setInterval(checkDueMedications, 30000);
}

// ── Install: pre-cache app shell ──────────────────────────────────────────────
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(async (cache) => {
      await Promise.allSettled(
        APP_SHELL.map((url) =>
          cache.add(url).catch((err) =>
            console.warn(`[SW] Pre-cache skipped for ${url}:`, err.message)
          )
        )
      );
      return self.skipWaiting();
    })
  );
});

// ── Activate: clean up old caches and start heartbeat (ONCE) ─────────────────
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) =>
        Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
      )
      .then(() => self.clients.claim())
      .then(() => {
        // Start heartbeat HERE only — not also at the bottom of the file
        startAlarmHeartbeat();
      })
  );
});

// ── Fetch: offline-capable network-first for navigation, cache-first for assets
self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);

  // Never intercept cross-origin (API calls, CDN, fonts)
  if (url.origin !== self.location.origin) return;

  // Never intercept API routes — they must always hit the live backend
  if (
    url.pathname.startsWith("/api")             ||
    url.pathname.startsWith("/auth")            ||
    url.pathname.startsWith("/medicine")        ||
    url.pathname.startsWith("/caregiver")       ||
    url.pathname.startsWith("/admin")           ||
    url.pathname.startsWith("/vapid-public-key")||
    url.pathname.startsWith("/save-subscription")||
    url.pathname.startsWith("/send-notification")
  ) return;

  // Navigation (page loads): network-first, fallback to cached index.html
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request).catch(() =>
        caches.match("/index.html").then(
          (cached) => cached || new Response(
            '<!DOCTYPE html><html><head><meta charset="utf-8"><meta http-equiv="refresh" content="0;url=/"></head><body></body></html>',
            { status: 200, headers: { "Content-Type": "text/html; charset=utf-8" } }
          )
        )
      )
    );
    return;
  }

  // Static assets: cache-first, then network
  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) return cached;
      return fetch(request)
        .then((response) => {
          if (response && response.status === 200 &&
              (response.type === "basic" || response.type === "cors")) {
            const cloned = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, cloned));
          }
          return response;
        })
        .catch(() =>
          caches.match(request).then(
            (fallback) => fallback || new Response("", { status: 408, statusText: "Offline" })
          )
        );
    })
  );
});

// ── Push: server-sent WebPush notifications ───────────────────────────────────
// Server sends the full payload including medicineId and scheduledTime.
// Tag matches the local SW tag so the push REPLACES the local alarm notification,
// preventing the "double notification" problem.
self.addEventListener("push", (event) => {
  if (!event.data) return;

  let data = {};
  try   { data = event.data.json(); }
  catch { data = { title: "MedRemind", body: event.data.text() }; }

  const title   = data.title || "MedRemind Alert";
  const options = {
    body:               data.body    || "",
    icon:               data.icon    || "/medremind-icon-192.svg",
    badge:              "/medremind-icon-192.svg",
    // CRITICAL: use the same tag format as checkDueMedications so push REPLACES local alarm
    tag:                data.tag     || `push-${Date.now()}`,
    renotify:           true,         // Always re-vibrate/re-show even if tag exists
    requireInteraction: true,
    silent:             false,
    vibrate:            [300, 150, 300, 150, 300],
    actions: [
      { action: "take",   title: "✅ Take Now"  },
      { action: "snooze", title: "⏰ Snooze 10m" }
    ],
    data: {
      url:           data.url          || "/dashboard",
      medicineId:    data.medicineId   || null,
      medicineName:  data.medicineName || null,
      dosage:        data.dosage       || null,
      scheduledTime: data.scheduledTime || null,
      source:        "push"
    }
  };

  // Mark this push slot as already notified so the local SW heartbeat
  // won't fire a duplicate notification for the same medicine at the same minute
  event.waitUntil(
    (async () => {
      if (data.medicineId && data.scheduledTime) {
        try {
          const db       = await openDatabase();
          const { today } = getISTDateTime();
          const slotKey  = `${today}_${data.medicineId}_${data.scheduledTime}`;
          await putInStore(db, "notified_events", { key: slotKey, timestamp: Date.now() });
        } catch (e) {
          console.warn("[SW] Push dedup write error:", e);
        }
      }
      await self.registration.showNotification(title, options);
    })()
  );
});

// ── Periodic Background Sync (Chrome Android) ─────────────────────────────────
self.addEventListener("periodicsync", (event) => {
  if (event.tag === "medremind-reminders" || event.tag === "med-check") {
    event.waitUntil(checkDueMedications());
  }
});

// ── Background Sync (reconnect after offline) ─────────────────────────────────
self.addEventListener("sync", (event) => {
  if (event.tag === "sync-taken-doses") {
    event.waitUntil(flushOfflineQueue());
  } else {
    event.waitUntil(checkDueMedications());
  }
});

// ── Message Handler: Receive schedules and commands from the React app ─────────
self.addEventListener("message", (event) => {
  if (!event.data) return;

  if (event.data.type === "SYNC_SCHEDULES") {
    const { medicines, token, apiBaseUrl } = event.data;
    event.waitUntil((async () => {
      try {
        const db = await openDatabase();

        if (Array.isArray(medicines)) {
          // Clear old schedules first (user isolation — prevent cross-user alarm leakage)
          try {
            const tx = db.transaction("schedules", "readwrite");
            tx.objectStore("schedules").clear();
            await new Promise((res, rej) => { tx.oncomplete = res; tx.onerror = rej; });
          } catch (clearErr) {
            console.warn("[SW] Could not clear old schedules:", clearErr);
          }

          for (const med of medicines) {
            if (med && med._id) {
              await putInStore(db, "schedules", med);
            }
          }
        }

        if (token) {
          await putInStore(db, "settings", { key: "authToken", value: token });
        }

        if (apiBaseUrl) {
          await putInStore(db, "settings", { key: "apiBaseUrl", value: apiBaseUrl });
        }

        // Restart heartbeat to pick up new schedules immediately
        startAlarmHeartbeat();
      } catch (err) {
        console.warn("[SW] Error syncing schedules:", err);
      }
    })());
  }

  if (event.data.type === "CHECK_NOW") {
    event.waitUntil(checkDueMedications());
  }

  // Called on logout — stop heartbeat and clear all user data
  if (event.data.type === "CLEAR_USER_DATA") {
    event.waitUntil((async () => {
      try {
        if (_heartbeatInterval) {
          clearInterval(_heartbeatInterval);
          _heartbeatInterval = null;
        }
        const db = await openDatabase();
        const stores = ["schedules", "notified_events", "offline_queue"];
        for (const storeName of stores) {
          try {
            const tx = db.transaction(storeName, "readwrite");
            tx.objectStore(storeName).clear();
          } catch (e) {}
        }
        // Close all open notifications belonging to this user
        const notifications = await self.registration.getNotifications();
        notifications.forEach((n) => n.close());
      } catch (e) {
        console.warn("[SW] CLEAR_USER_DATA error:", e);
      }
    })());
  }
});

// ── Notification Click & Action Handler ───────────────────────────────────────
self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  const data   = event.notification.data || {};
  const action = event.action;

  // ── "Take Now" action ─────────────────────────────────────────────────────
  if (action === "take" && data.medicineId) {
    event.waitUntil((async () => {
      // 1. Broadcast IMMEDIATELY to any open app tabs for instant UI update
      try {
        const clientList = await clients.matchAll({ type: "window", includeUncontrolled: true });
        for (const client of clientList) {
          client.postMessage({
            type:          "MEDICINE_TAKEN_OFFLINE",
            medicineId:    data.medicineId,
            scheduledTime: data.scheduledTime
          });
        }
      } catch (bcErr) {
        console.warn("[SW] Broadcast error:", bcErr);
      }

      // 2. Optimistically update local cache
      try {
        const db  = await openDatabase();
        const med = await getFromStore(db, "schedules", data.medicineId);
        if (med) {
          med.stock = Math.max(0, (med.stock || 0) - 1);
          med.taken = true;
          await putInStore(db, "schedules", med);
        }

        // 3. Queue for backend sync
        await putInStore(db, "offline_queue", {
          medicineId:    data.medicineId,
          scheduledTime: data.scheduledTime,
          timestamp:     Date.now()
        });

        // 4. Flush immediately if online
        await flushOfflineQueue();
      } catch (err) {
        console.warn("[SW] Take action error:", err);
      }

      // 5. Confirmation notification
      await self.registration.showNotification(`✅ Dose Recorded: ${data.medicineName || "Medication"}`, {
        body:    `Great job! ${data.dosage ? data.dosage + " — " : ""}Your dose has been confirmed.`,
        icon:    "/medremind-icon-192.svg",
        badge:   "/medremind-icon-192.svg",
        tag:     `confirm-${data.medicineId}-${data.scheduledTime || Date.now()}`,
        vibrate: [100, 50, 100],
        data:    { url: "/dashboard" }
      });
    })());
    return;
  }

  // ── "Snooze 10m" action ───────────────────────────────────────────────────
  if (action === "snooze" && data.medicineId) {
    event.waitUntil((async () => {
      const snoozeUntilMs  = Date.now() + 10 * 60 * 1000;
      const snoozeUntilISO = new Date(snoozeUntilMs).toISOString();

      try {
        const db  = await openDatabase();
        const med = await getFromStore(db, "schedules", data.medicineId);
        if (med) {
          med.snoozedUntil = snoozeUntilISO;
          await putInStore(db, "schedules", med);
        }

        // Remove the deduplication key so the snoozed alarm can fire again
        if (data.scheduledTime) {
          const { today } = getISTDateTime();
          const slotKey   = `${today}_${data.medicineId}_${data.scheduledTime}`;
          await deleteFromStore(db, "notified_events", slotKey);
        }
      } catch (e) {
        console.warn("[SW] Snooze cache update error:", e);
      }

      await self.registration.showNotification(`⏰ Snoozed for 10 Minutes`, {
        body:    `You'll be reminded about ${data.medicineName || "your medication"} in 10 minutes.`,
        icon:    "/medremind-icon-192.svg",
        badge:   "/medremind-icon-192.svg",
        tag:     `snooze-confirm-${data.medicineId}`,
        vibrate: [100, 50],
        data:    { url: "/dashboard" }
      });
    })());
    return;
  }

  // ── Default: Open/focus the app at the target URL ─────────────────────────
  const targetUrl = action === "refill"
    ? `${self.location.origin}/refill`
    : (data.url ? `${self.location.origin}${data.url}` : `${self.location.origin}/dashboard`);

  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url.startsWith(self.location.origin) && "focus" in client) {
          client.navigate(targetUrl);
          return client.focus();
        }
      }
      if (clients.openWindow) return clients.openWindow(targetUrl);
    })
  );
});

// ── Notification dismiss handler ──────────────────────────────────────────────
self.addEventListener("notificationclose", (event) => {
  // When user swipes away a medication notification, we note it but don't lock the dose.
  // The reminder escalation on the backend will handle follow-up.
  const data = event.notification.data || {};
  if (data.source === "local" && data.medicineId) {
    console.log(`[SW] Notification dismissed for ${data.medicineName} at ${data.scheduledTime}`);
  }
});

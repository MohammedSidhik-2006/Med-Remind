// MedRemind Service Worker — Offline Support + Local Alarms + Background Push
const CACHE_NAME = "medremind-v4";
const DB_NAME = "MedRemindOfflineDB";
const DB_VERSION = 1;

// App shell files to pre-cache on install
const APP_SHELL = [
  "/",
  "/index.html",
  "/manifest.json",
  "/favicon.ico",
  "/logo192.png",
  "/medremind-icon-192.svg"
];

// ── IndexedDB Engine for Service Worker ───────────────────────────────────────
function openDatabase() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains("schedules")) {
        db.createObjectStore("schedules", { keyPath: "_id" });
      }
      if (!db.objectStoreNames.contains("notified_events")) {
        db.createObjectStore("notified_events", { keyPath: "key" });
      }
      if (!db.objectStoreNames.contains("offline_queue")) {
        db.createObjectStore("offline_queue", { keyPath: "id", autoIncrement: true });
      }
      if (!db.objectStoreNames.contains("settings")) {
        db.createObjectStore("settings", { keyPath: "key" });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function getAllFromStore(db, storeName) {
  return new Promise((resolve) => {
    try {
      const tx = db.transaction(storeName, "readonly");
      const store = tx.objectStore(storeName);
      const req = store.getAll();
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => resolve([]);
    } catch {
      resolve([]);
    }
  });
}

function getFromStore(db, storeName, key) {
  return new Promise((resolve) => {
    try {
      const tx = db.transaction(storeName, "readonly");
      const store = tx.objectStore(storeName);
      const req = store.get(key);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

function putInStore(db, storeName, value) {
  return new Promise((resolve) => {
    try {
      const tx = db.transaction(storeName, "readwrite");
      const store = tx.objectStore(storeName);
      const req = store.put(value);
      req.onsuccess = () => resolve(true);
      req.onerror = () => resolve(false);
    } catch {
      resolve(false);
    }
  });
}

function deleteFromStore(db, storeName, key) {
  return new Promise((resolve) => {
    try {
      const tx = db.transaction(storeName, "readwrite");
      const store = tx.objectStore(storeName);
      const req = store.delete(key);
      req.onsuccess = () => resolve(true);
      req.onerror = () => resolve(false);
    } catch {
      resolve(false);
    }
  });
}

// ── Check & Trigger Due Medications (Offline & Background) ───────────────────
async function checkDueMedications() {
  try {
    const db = await openDatabase();
    const schedules = await getAllFromStore(db, "schedules");
    if (!schedules || schedules.length === 0) return;

    const now = new Date();
    const hours = String(now.getHours()).padStart(2, "0");
    const minutes = String(now.getMinutes()).padStart(2, "0");
    const currentTime = `${hours}:${minutes}`;
    const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;

    for (const med of schedules) {
      if (!med || !med.name) continue;

      // Check date validity range if set
      if (med.startDate && today < med.startDate) continue;
      if (med.endDate && today > med.endDate) continue;

      const allTimes = Array.isArray(med.times) && med.times.length > 0 ? med.times : (med.time ? [med.time] : []);
      const isSnoozeMatured = med.snoozedUntil && new Date(med.snoozedUntil).getTime() <= now.getTime();

      // Check scheduled dose times
      for (const slotTime of allTimes) {
        if (!slotTime) continue;

        const isCurrentSlot = (slotTime === currentTime);
        const slotKey = `${today}_${med._id}_${slotTime}`;

        if (isCurrentSlot || isSnoozeMatured) {
          const alreadyNotified = await getFromStore(db, "notified_events", slotKey);
          if (!alreadyNotified && !med.taken) {
            // Deduplicate immediately in database
            await putInStore(db, "notified_events", { key: slotKey, timestamp: now.getTime() });

            if (isSnoozeMatured) {
              med.snoozedUntil = null;
              await putInStore(db, "schedules", med);
            }

            // Display OS notification even if app is closed or offline
            await self.registration.showNotification(`💊 Time to take ${med.name}`, {
              body: `${med.dosage} scheduled for ${slotTime}. Tap to record your dose.`,
              icon: "/medremind-icon-192.svg",
              badge: "/medremind-icon-192.svg",
              tag: `local-med-${med._id}-${slotTime}`,
              renotify: true,
              requireInteraction: true,
              vibrate: [300, 150, 300, 150, 300],
              actions: [
                { action: "take", title: "✅ Take Now" },
                { action: "snooze", title: "⏰ Snooze 10m" }
              ],
              data: {
                url: "/dashboard",
                medicineId: med._id,
                medicineName: med.name,
                dosage: med.dosage,
                scheduledTime: slotTime
              }
            });
          }
        }
      }

      // Check Low Stock / Refill Alert
      if (med.stock !== undefined && med.refillAt !== undefined && med.stock <= med.refillAt) {
        const refillKey = `${today}_refill_${med._id}`;
        const alreadyNotifiedRefill = await getFromStore(db, "notified_events", refillKey);
        if (!alreadyNotifiedRefill) {
          await putInStore(db, "notified_events", { key: refillKey, timestamp: now.getTime() });
          await self.registration.showNotification(`📦 Low Stock Alert: ${med.name}`, {
            body: `Only ${med.stock} doses remaining (refill threshold: ${med.refillAt}). Tap to view refill tracker.`,
            icon: "/medremind-icon-192.svg",
            badge: "/medremind-icon-192.svg",
            tag: `local-refill-${med._id}`,
            vibrate: [250, 100, 250],
            actions: [
              { action: "refill", title: "📦 Refill Tracker" }
            ],
            data: {
              url: "/refill",
              medicineId: med._id
            }
          });
        }
      }
    }
  } catch (err) {
    console.warn("[SW] checkDueMedications error:", err);
  }
}

// ── Notification Triggers API (OS-native offline alarm scheduling) ─────────────
async function scheduleTriggerAlarms(medicines) {
  if (!('showTrigger' in Notification.prototype) && typeof TimestampTrigger === 'undefined') {
    return; // Fallback handled by background alarm heartbeat
  }

  const now = new Date();

  for (const med of medicines) {
    if (!med || !med.name || med.taken) continue;
    const allTimes = Array.isArray(med.times) && med.times.length > 0 ? med.times : (med.time ? [med.time] : []);

    for (const timeStr of allTimes) {
      if (!timeStr || !timeStr.includes(":")) continue;
      const [h, m] = timeStr.split(":").map(Number);
      
      const targetToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), h, m, 0, 0);
      
      // Schedule only upcoming slots
      if (targetToday.getTime() > now.getTime()) {
        try {
          const trigger = new TimestampTrigger(targetToday.getTime());
          await self.registration.showNotification(`💊 Time to take ${med.name}`, {
            body: `${med.dosage} scheduled for ${timeStr}. Tap to confirm your dose.`,
            icon: "/medremind-icon-192.svg",
            badge: "/medremind-icon-192.svg",
            tag: `trigger-med-${med._id}-${timeStr}`,
            showTrigger: trigger,
            requireInteraction: true,
            vibrate: [300, 150, 300, 150, 300],
            actions: [
              { action: "take", title: "✅ Take Now" },
              { action: "snooze", title: "⏰ Snooze 10m" }
            ],
            data: {
              url: "/dashboard",
              medicineId: med._id,
              medicineName: med.name,
              scheduledTime: timeStr
            }
          });
        } catch (e) {
          console.warn("[SW] TimestampTrigger error:", e);
        }
      }
    }
  }
}

// ── Background Alarm Heartbeat Loop ───────────────────────────────────────────
let alarmTimer = null;
function startAlarmHeartbeat() {
  if (alarmTimer) clearInterval(alarmTimer);
  checkDueMedications();
  // Check every 30 seconds so scheduled minutes are never missed
  alarmTimer = setInterval(() => {
    checkDueMedications();
  }, 30000);
}

// ── Flush Offline Taken Queue to Backend ──────────────────────────────────────
async function flushOfflineQueue() {
  try {
    const db = await openDatabase();
    const queue = await getAllFromStore(db, "offline_queue");
    if (!queue || queue.length === 0) return;

    const tokenSetting = await getFromStore(db, "settings", "authToken");
    const token = tokenSetting?.value;
    if (!token) return;

    for (const item of queue) {
      try {
        const res = await fetch(`/medicine/taken/${item.medicineId}`, {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${token}`
          },
          body: JSON.stringify({ scheduledTime: item.scheduledTime })
        });
        if (res.ok) {
          await deleteFromStore(db, "offline_queue", item.id);
        }
      } catch {
        // Still offline; will retry on next sync event
        break;
      }
    }
  } catch (err) {
    console.warn("[SW] flushOfflineQueue error:", err);
  }
}

// ── Install: pre-cache app shell with resilient error handling ────────────────
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(async (cache) => {
      await Promise.allSettled(
        APP_SHELL.map((url) =>
          cache.add(url).catch((err) => console.warn(`[SW] Pre-cache skipped for ${url}:`, err.message))
        )
      );
      return self.skipWaiting();
    })
  );
});

// ── Activate: clean up old caches & start background alarm ────────────────────
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) =>
        Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
      )
      .then(() => self.clients.claim())
      .then(() => {
        startAlarmHeartbeat();
      })
  );
});

// ── Fetch: offline-capable network strategy ───────────────────────────────────
self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);

  // CRITICAL: NEVER intercept cross-origin requests
  if (url.origin !== self.location.origin) return;

  // CRITICAL: NEVER intercept API dynamic requests
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

  // Navigation requests: network first, fallback to /index.html
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

// ── Push: remote WebPush notifications from server ────────────────────────────
self.addEventListener("push", (event) => {
  if (!event.data) return;

  let data = {};
  try {
    data = event.data.json();
  } catch {
    data = { title: "MedRemind", body: event.data.text() };
  }

  const title   = data.title || "MedRemind Alert";
  const options = {
    body:               data.body  || "",
    icon:               data.icon  || "/medremind-icon-192.svg",
    badge:              "/medremind-icon-192.svg",
    tag:                data.tag   || `push-${Date.now()}`,
    requireInteraction: true,
    vibrate:            [300, 150, 300, 150, 300], // Wake mobile device from sleep
    actions: [
      { action: "take", title: "✅ Take Now" },
      { action: "snooze", title: "⏰ Snooze 10m" }
    ],
    data: { 
      url: data.url || `${self.location.origin}/dashboard`,
      medicineId: data.medicineId,
      medicineName: data.medicineName,
      scheduledTime: data.scheduledTime
    }
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

// ── Periodic Background Sync (runs in background on Android/Chrome) ───────────
self.addEventListener("periodicsync", (event) => {
  if (event.tag === "medremind-reminders" || event.tag === "med-check") {
    event.waitUntil(checkDueMedications());
  }
});

// ── Background Sync (when connectivity is restored) ───────────────────────────
self.addEventListener("sync", (event) => {
  if (event.tag === "sync-taken-doses") {
    event.waitUntil(flushOfflineQueue());
  } else {
    event.waitUntil(checkDueMedications());
  }
});

// ── Message: Receive updated schedules from client app ────────────────────────
self.addEventListener("message", (event) => {
  if (!event.data) return;

  if (event.data.type === "SYNC_SCHEDULES") {
    const { medicines, token } = event.data;
    event.waitUntil((async () => {
      try {
        const db = await openDatabase();
        if (Array.isArray(medicines)) {
          for (const med of medicines) {
            if (med && med._id) {
              await putInStore(db, "schedules", med);
            }
          }
          await scheduleTriggerAlarms(medicines);
        }
        if (token) {
          await putInStore(db, "settings", { key: "authToken", value: token });
        }
        startAlarmHeartbeat();
      } catch (err) {
        console.warn("[SW] Error syncing schedules:", err);
      }
    })());
  }

  if (event.data.type === "CHECK_NOW") {
    event.waitUntil(checkDueMedications());
  }
});

// ── Notification Click & Action Handlers ──────────────────────────────────────
self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  const data = event.notification.data || {};
  const action = event.action;

  // 1. User clicked "Take Now" directly from notification
  if (action === "take" && data.medicineId) {
    event.waitUntil((async () => {
      try {
        const db = await openDatabase();
        const med = await getFromStore(db, "schedules", data.medicineId);
        if (med) {
          med.stock = Math.max(0, (med.stock || 0) - 1);
          med.taken = true;
          await putInStore(db, "schedules", med);
        }

        // Queue dose for backend synchronization
        await putInStore(db, "offline_queue", {
          medicineId: data.medicineId,
          scheduledTime: data.scheduledTime,
          timestamp: Date.now()
        });

        // Flush immediately if online
        await flushOfflineQueue();
      } catch (err) {
        console.warn("[SW] Error handling take action:", err);
      }

      // Show immediate feedback confirmation
      await self.registration.showNotification(`✅ Dose Recorded: ${data.medicineName || "Medication"}`, {
        body: `Great job! Your dose was confirmed and recorded.`,
        icon: "/medremind-icon-192.svg",
        badge: "/medremind-icon-192.svg",
        tag: `feedback-${data.medicineId}`,
        vibrate: [100, 50, 100],
        data: { url: "/dashboard" }
      });

      // Broadcast to open tabs
      const clientList = await clients.matchAll({ type: "window", includeUncontrolled: true });
      for (const client of clientList) {
        client.postMessage({ type: "MEDICINE_TAKEN_OFFLINE", medicineId: data.medicineId });
      }
    })());
    return;
  }

  // 2. User clicked "Snooze 10m" directly from notification
  if (action === "snooze" && data.medicineId) {
    event.waitUntil((async () => {
      try {
        const db = await openDatabase();
        const med = await getFromStore(db, "schedules", data.medicineId);
        if (med) {
          med.snoozedUntil = new Date(Date.now() + 10 * 60 * 1000).toISOString();
          await putInStore(db, "schedules", med);
        }
      } catch (err) {}

      await self.registration.showNotification(`⏰ Snoozed for 10 Minutes`, {
        body: `We will remind you about ${data.medicineName || "your medication"} in 10 minutes.`,
        icon: "/medremind-icon-192.svg",
        badge: "/medremind-icon-192.svg",
        tag: `feedback-snooze-${data.medicineId}`,
        vibrate: [100, 50],
        data: { url: "/dashboard" }
      });
    })());
    return;
  }

  // 3. User clicked "Refill Tracker" or main notification body
  const targetUrl = action === "refill" 
    ? `${self.location.origin}/refill` 
    : (data.url || `${self.location.origin}/dashboard`);

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

// Start heartbeat immediately on worker evaluation
startAlarmHeartbeat();

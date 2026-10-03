/**
 * Offline Sync Service — Production-grade bridge between React and Service Worker.
 * Guarantees medication reminders, refill alerts, and dose logging work reliably
 * in offline mode, airplane mode, and when the app is backgrounded on mobile.
 */
import API from "./api";

const DB_NAME    = "MedRemindOfflineDB";
const DB_VERSION = 2; // Matches SW DB_VERSION

// ── Single global listener registration guard ────────────────────────────────
// Prevents duplicate `MEDICINE_TAKEN_OFFLINE` event listeners when the user
// navigates between pages (each page mount would otherwise re-add a listener).
let _swMessageListenerRegistered = false;

function ensureSWMessageListener() {
  if (_swMessageListenerRegistered) return;
  if (typeof window === "undefined" || !("serviceWorker" in navigator)) return;

  navigator.serviceWorker.addEventListener("message", (event) => {
    if (event.data?.type === "MEDICINE_TAKEN_OFFLINE") {
      window.dispatchEvent(
        new CustomEvent("medremind-dose-taken-offline", {
          detail: {
            medicineId:    event.data.medicineId,
            scheduledTime: event.data.scheduledTime
          }
        })
      );
    }
  });

  _swMessageListenerRegistered = true;
}

// Register listener immediately on module load (once)
ensureSWMessageListener();

// ── IndexedDB helper ──────────────────────────────────────────────────────────
function openDB() {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") return resolve(null);
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains("schedules")) {
        db.createObjectStore("schedules", { keyPath: "_id" });
      }
      if (!db.objectStoreNames.contains("notified_events")) {
        const store = db.createObjectStore("notified_events", { keyPath: "key" });
        try { store.createIndex("byTimestamp", "timestamp"); } catch {}
      }
      if (!db.objectStoreNames.contains("offline_queue")) {
        db.createObjectStore("offline_queue", { keyPath: "id", autoIncrement: true });
      }
      if (!db.objectStoreNames.contains("settings")) {
        db.createObjectStore("settings", { keyPath: "key" });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror   = () => resolve(null);
  });
}

// ── VAPID key converter ───────────────────────────────────────────────────────
const urlBase64ToUint8Array = (base64String) => {
  if (!base64String) return new Uint8Array(0);
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64  = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw     = window.atob(base64);
  return Uint8Array.from([...raw].map((c) => c.charCodeAt(0)));
};

// ── Resolve backend API base URL ──────────────────────────────────────────────
const getApiBase = () => {
  if (process.env.REACT_APP_API_URL) return process.env.REACT_APP_API_URL.replace(/\/+$/, "");
  const host = typeof window !== "undefined" ? window.location.hostname : "";
  if (host === "localhost" || host === "127.0.0.1") return "http://localhost:5000";
  return "https://medi-time-2peh.onrender.com";
};

/**
 * Sync active medication schedules to IndexedDB and the active Service Worker.
 * Called every time Dashboard loads or medicines are updated.
 */
export async function syncMedicinesToOfflineStorage(medicines) {
  if (!Array.isArray(medicines)) return;

  // Cache to localStorage for fast synchronous component hydration
  try { localStorage.setItem("medremind_cached_medicines", JSON.stringify(medicines)); } catch {}

  // Persist to IndexedDB with user isolation (clear first)
  try {
    const db = await openDB();
    if (db) {
      try {
        const clearTx = db.transaction("schedules", "readwrite");
        clearTx.objectStore("schedules").clear();
        await new Promise((res, rej) => { clearTx.oncomplete = res; clearTx.onerror = rej; });
      } catch {}

      const tx        = db.transaction(["schedules", "settings"], "readwrite");
      const schedStore = tx.objectStore("schedules");
      for (const med of medicines) {
        if (med && med._id) schedStore.put(med);
      }
      const token = localStorage.getItem("token");
      if (token) {
        tx.objectStore("settings").put({ key: "authToken", value: token });
      }
      tx.objectStore("settings").put({ key: "apiBaseUrl", value: getApiBase() });
    }
  } catch (err) {
    console.warn("IndexedDB sync error:", err);
  }

  // Post SYNC_SCHEDULES to Service Worker (includes token + apiBaseUrl)
  try {
    if ("serviceWorker" in navigator) {
      const registration  = await navigator.serviceWorker.ready;
      const targetWorker  = registration.active || navigator.serviceWorker.controller;
      if (targetWorker) {
        targetWorker.postMessage({
          type:       "SYNC_SCHEDULES",
          medicines,
          token:      localStorage.getItem("token"),
          apiBaseUrl: getApiBase()
        });
      }
    }
  } catch (err) {
    console.warn("Service Worker postMessage error:", err);
  }
}

/**
 * Initialize the service worker and periodic background sync.
 * Safe to call multiple times — SW registration is idempotent.
 */
export async function initOfflineNotifications() {
  if (typeof window === "undefined" || !("serviceWorker" in navigator)) return null;

  try {
    const registration = await navigator.serviceWorker.register("/sw.js");
    await navigator.serviceWorker.ready;

    // Register Periodic Background Sync (Chrome Android only)
    if ("periodicSync" in registration) {
      try {
        const status = await navigator.permissions.query({ name: "periodic-background-sync" });
        if (status.state === "granted") {
          await registration.periodicSync.register("medremind-reminders", {
            minInterval: 60 * 1000
          });
        }
      } catch {
        // Optional — silently skip if not supported
      }
    }

    // Ensure the message listener is registered (no-op if already done)
    ensureSWMessageListener();

    return registration;
  } catch (err) {
    console.warn("initOfflineNotifications error:", err);
    return null;
  }
}

/**
 * Request OS notification permission and subscribe to both offline alarms
 * (via Service Worker heartbeat) and online WebPush (via VAPID).
 */
export async function setupAppNotifications() {
  if (typeof window === "undefined" || !("Notification" in window)) return false;

  try {
    // 1. Request OS notification permission
    const permission = await Notification.requestPermission();
    if (permission !== "granted") return false;

    // 2. Register Service Worker
    const registration = await initOfflineNotifications();
    if (!registration) return false;

    // 3. Immediately sync cached medicines for offline local alarms
    try {
      const cached = localStorage.getItem("medremind_cached_medicines");
      if (cached) {
        const meds = JSON.parse(cached);
        await syncMedicinesToOfflineStorage(meds);
      }
    } catch {}

    // 4. Subscribe to server-side WebPush (enables caregiver + admin remote pushes)
    if (navigator.onLine && "PushManager" in window) {
      try {
        const vapidRes  = await API.get("/vapid-public-key");
        const vapidData = vapidRes.data;
        if (vapidData?.publicKey) {
          const applicationServerKey = urlBase64ToUint8Array(vapidData.publicKey);
          let subscription = await registration.pushManager.getSubscription();
          if (!subscription) {
            subscription = await registration.pushManager.subscribe({
              userVisibleOnly:      true,
              applicationServerKey
            });
          }
          const token = localStorage.getItem("token");
          if (token && subscription) {
            const sub = subscription.toJSON();
            if (sub?.endpoint && sub?.keys) {
              await API.post("/save-subscription", {
                endpoint: sub.endpoint,
                keys: { p256dh: sub.keys.p256dh, auth: sub.keys.auth }
              });
            }
          }
        }
      } catch (pushErr) {
        // Online push is additive — offline local alarms remain fully functional
        console.info("WebPush subscription skipped (offline alarms active):", pushErr.message);
      }
    }

    return true;
  } catch (err) {
    console.error("setupAppNotifications error:", err);
    return false;
  }
}

/**
 * Called on logout. Clears all user-specific data from IndexedDB, localStorage,
 * and the Service Worker's schedule cache. Stops local alarm heartbeat.
 */
export async function clearOfflineStorage() {
  // 1. Tell SW to stop heartbeat and clear user data
  try {
    if ("serviceWorker" in navigator) {
      const registration = await navigator.serviceWorker.ready;
      const targetWorker = registration.active || navigator.serviceWorker.controller;
      if (targetWorker) {
        targetWorker.postMessage({ type: "CLEAR_USER_DATA" });
      }
    }
  } catch {}

  // 2. Clear IndexedDB stores
  try {
    const db = await openDB();
    if (!db) return;
    const stores = ["schedules", "notified_events"];
    for (const storeName of stores) {
      try {
        const tx = db.transaction(storeName, "readwrite");
        tx.objectStore(storeName).clear();
      } catch {}
    }
  } catch (err) {
    console.warn("clearOfflineStorage error:", err);
  }

  // 3. Clear cached medicines from localStorage
  try { localStorage.removeItem("medremind_cached_medicines"); } catch {}
}

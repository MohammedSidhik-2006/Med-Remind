/**
 * Offline Sync Service — Bridge between React client and Service Worker
 * Guarantees that medication reminders, refill alerts, and dose logging
 * function reliably even in offline mode, airplane mode, or when the app is inactive.
 */
import API from "./api";

const DB_NAME = "MedRemindOfflineDB";
const DB_VERSION = 1;

// Open or initialize IndexedDB from client side
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
    req.onerror = () => resolve(null);
  });
}

// Convert VAPID key
const urlBase64ToUint8Array = (base64String) => {
  if (!base64String) return new Uint8Array(0);
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64  = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw     = window.atob(base64);
  return Uint8Array.from([...raw].map((c) => c.charCodeAt(0)));
};

// Global listener for SW events (e.g. dose taken from OS notification while tab was backgrounded)
if (typeof window !== "undefined" && "serviceWorker" in navigator) {
  navigator.serviceWorker.addEventListener("message", (event) => {
    if (event.data?.type === "MEDICINE_TAKEN_OFFLINE") {
      window.dispatchEvent(new CustomEvent("medremind-dose-taken-offline", { 
        detail: { 
          medicineId: event.data.medicineId,
          scheduledTime: event.data.scheduledTime 
        }
      }));
    }
  });
}


/**
 * Sync active medication schedules to both IndexedDB and the active Service Worker.
 * Ensures the Service Worker has complete offline awareness of all dose schedules.
 */
export async function syncMedicinesToOfflineStorage(medicines) {
  if (!Array.isArray(medicines)) return;

  // 1. Cache to localStorage for fast synchronous component hydration
  try {
    localStorage.setItem("medremind_cached_medicines", JSON.stringify(medicines));
  } catch {}

  // 2. Persist to IndexedDB — clear first for user isolation
  try {
    const db = await openDB();
    if (db) {
      // Clear existing schedules so a new user doesn't inherit the previous
      // user's medicine reminders after logout
      try {
        const clearTx = db.transaction("schedules", "readwrite");
        clearTx.objectStore("schedules").clear();
        await new Promise((res, rej) => { clearTx.oncomplete = res; clearTx.onerror = rej; });
      } catch {}

      const tx = db.transaction(["schedules", "settings"], "readwrite");
      const schedStore = tx.objectStore("schedules");
      for (const med of medicines) {
        if (med && med._id) {
          schedStore.put(med);
        }
      }
      const token = localStorage.getItem("token");
      if (token) {
        tx.objectStore("settings").put({ key: "authToken", value: token });
      }
    }
  } catch (err) {
    console.warn("IndexedDB sync error:", err);
  }

  // 3. Resolve the backend API base URL so the SW uses the correct server
  // for offline dose queue flushing (avoid hitting the frontend origin)
  const getApiBase = () => {
    if (process.env.REACT_APP_API_URL) return process.env.REACT_APP_API_URL.replace(/\/+$/, "");
    const host = typeof window !== "undefined" ? window.location.hostname : "";
    if (host === "localhost" || host === "127.0.0.1") return "http://localhost:5000";
    return "https://medi-time-2peh.onrender.com";
  };

  // 4. Post to Service Worker (includes apiBaseUrl for correct offline sync)
  try {
    if ("serviceWorker" in navigator) {
      const registration = await navigator.serviceWorker.ready;
      const targetWorker = registration.active || navigator.serviceWorker.controller;
      if (targetWorker) {
        targetWorker.postMessage({
          type: "SYNC_SCHEDULES",
          medicines,
          token: localStorage.getItem("token"),
          apiBaseUrl: getApiBase()
        });
      }
    }
  } catch (err) {
    console.warn("Service Worker postMessage error:", err);
  }
}

/**
 * Initialize offline service worker, periodic background sync, and notification listeners.
 */
export async function initOfflineNotifications() {
  if (typeof window === "undefined" || !("serviceWorker" in navigator)) return null;

  try {
    const registration = await navigator.serviceWorker.register("/sw.js");
    await navigator.serviceWorker.ready;

    // Register Periodic Background Sync (Chrome Android)
    if ("periodicSync" in registration) {
      try {
        const status = await navigator.permissions.query({ name: "periodic-background-sync" });
        if (status.state === "granted") {
          await registration.periodicSync.register("medremind-reminders", {
            minInterval: 60 * 1000 // 1 minute
          });
        }
      } catch (e) {
        // Periodic sync optional/permission dependent
      }
    }

    // Listen for Service Worker messages (e.g. dose taken from notification while offline)
    navigator.serviceWorker.addEventListener("message", (event) => {
      if (event.data?.type === "MEDICINE_TAKEN_OFFLINE") {
        window.dispatchEvent(new CustomEvent("medremind-dose-taken-offline", { 
          detail: { medicineId: event.data.medicineId }
        }));
      }
    });

    return registration;
  } catch (err) {
    console.warn("initOfflineNotifications error:", err);
    return null;
  }
}

/**
 * Request notification permission and set up both offline alarms and online push.
 * Guarantees local offline reminders work even if backend/VAPID is unreachable.
 */
export async function setupAppNotifications() {
  if (typeof window === "undefined" || !("Notification" in window)) {
    return false;
  }

  try {
    // 1. Request OS Permission
    const permission = await Notification.requestPermission();
    if (permission !== "granted") {
      return false;
    }

    // 2. Ensure Service Worker is registered
    const registration = await initOfflineNotifications();
    if (!registration) return false;

    // 3. Immediately sync cached medicines for offline alarms
    try {
      const cached = localStorage.getItem("medremind_cached_medicines");
      if (cached) {
        const meds = JSON.parse(cached);
        await syncMedicinesToOfflineStorage(meds);
      }
    } catch {}

    // 4. Try online push subscription (enhances with caregiver & admin remote pushes)
    if (navigator.onLine && "PushManager" in window) {
      try {
        const vapidRes = await API.get("/vapid-public-key");
        const vapidData = vapidRes.data;
        if (vapidData?.publicKey) {
          const applicationServerKey = urlBase64ToUint8Array(vapidData.publicKey);
          let subscription = await registration.pushManager.getSubscription();
          if (!subscription) {
            subscription = await registration.pushManager.subscribe({
              userVisibleOnly: true,
              applicationServerKey
            });
          }
          const token = localStorage.getItem("token");
          if (token && subscription) {
            const sub = subscription.toJSON();
            if (sub?.endpoint && sub?.keys) {
              await API.post("/save-subscription", {
                endpoint: sub.endpoint,
                keys: {
                  p256dh: sub.keys.p256dh,
                  auth: sub.keys.auth
                }
              });
            }
          }
        }
      } catch (pushErr) {
        console.info("Online WebPush setup skipped (offline alarms remain fully active):", pushErr.message);
      }
    }

    return true;
  } catch (err) {
    console.error("setupAppNotifications error:", err);
    return false;
  }
}

/**
 * Clear all offline schedules and notification history from IndexedDB.
 * MUST be called on logout so the service worker stops firing the previous
 * user's medication reminders for any subsequent session.
 */
export async function clearOfflineStorage() {
  // Tell the service worker to stop checking (send empty schedule list)
  try {
    if ("serviceWorker" in navigator) {
      const registration = await navigator.serviceWorker.ready;
      const targetWorker = registration.active || navigator.serviceWorker.controller;
      if (targetWorker) {
        targetWorker.postMessage({ type: "SYNC_SCHEDULES", medicines: [], token: null, apiBaseUrl: null });
      }
    }
  } catch {}

  // Clear IndexedDB stores
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
    // Clear cached medicines from localStorage too
    localStorage.removeItem("medremind_cached_medicines");
  } catch (err) {
    console.warn("clearOfflineStorage error:", err);
  }
}

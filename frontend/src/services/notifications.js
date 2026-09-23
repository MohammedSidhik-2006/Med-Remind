import API from "./api";

// Convert VAPID public key from base64url to Uint8Array
const urlBase64ToUint8Array = (base64String) => {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64  = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw     = window.atob(base64);
  return Uint8Array.from([...raw].map((c) => c.charCodeAt(0)));
};

// Get the raw backend BASE url (without /api) for VAPID/subscription endpoints
// because those routes are registered at /api/vapid-public-key etc., and the
// axios instance already appends /api — so we must bypass it here.
const getBackendBase = () => {
  if (process.env.REACT_APP_API_URL) {
    // Strip trailing /api if present to get the bare origin
    return process.env.REACT_APP_API_URL.replace(/\/api\/?$/, "").replace(/\/+$/, "");
  }
  const hostname = window.location.hostname;
  if (hostname === "localhost" || hostname === "127.0.0.1") {
    return "http://localhost:5000";
  }
  return "";
};

export const setupPushNotifications = async () => {
  try {
    if (!("Notification" in window)) {
      console.warn("Browser does not support notifications");
      return false;
    }
    if (!("serviceWorker" in navigator)) {
      console.warn("Browser does not support service workers");
      return false;
    }
    if (!("PushManager" in window)) {
      console.warn("Browser does not support push notifications");
      return false;
    }

    // 1. Request permission
    const permission = await Notification.requestPermission();
    if (permission !== "granted") {
      console.warn("Notification permission denied");
      return false;
    }

    // 2. Register service worker and force update the cache dynamically
    const registration = await navigator.serviceWorker.register("/sw.js");
    await registration.update();
    await navigator.serviceWorker.ready;

    // 3. Fetch VAPID public key — use raw backend URL (not axios /api base)
    const backendBase = getBackendBase();
    const vapidRes = await fetch(`${backendBase}/api/vapid-public-key`);
    if (!vapidRes.ok) throw new Error(`VAPID key fetch failed: ${vapidRes.status}`);
    const vapidData = await vapidRes.json();
    const applicationServerKey = urlBase64ToUint8Array(vapidData.publicKey);

    // 4. Subscribe via PushManager
    let subscription = await registration.pushManager.getSubscription();
    if (!subscription) {
      subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey
      });
    }

    // 5. Send subscription to backend via authenticated axios (correct path)
    const sub = subscription.toJSON();
    await API.post("/save-subscription", {
      endpoint: sub.endpoint,
      keys: {
        p256dh: sub.keys.p256dh,
        auth:   sub.keys.auth
      }
    });

    console.log("Push notifications set up successfully");
    return true;
  } catch (err) {
    console.error("Push notification setup failed:", err.message);
    return false;
  }
};

/**
 * Check if push notifications are currently active.
 */
export const isPushSubscribed = async () => {
  try {
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) return false;
    const registration = await navigator.serviceWorker.getRegistration("/sw.js");
    if (!registration) return false;
    const subscription = await registration.pushManager.getSubscription();
    return !!subscription;
  } catch {
    return false;
  }
};

export const unsubscribePush = async () => {
  try {
    const registration = await navigator.serviceWorker.getRegistration("/sw.js");
    if (!registration) return;
    const subscription = await registration.pushManager.getSubscription();
    if (subscription) await subscription.unsubscribe();
  } catch (err) {
    console.error("Unsubscribe failed:", err.message);
  }
};

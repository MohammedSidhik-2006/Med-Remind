import { setupAppNotifications, syncMedicinesToOfflineStorage, initOfflineNotifications } from "./offlineSync";

export const setupPushNotifications = async () => {
  return await setupAppNotifications();
};

export { syncMedicinesToOfflineStorage, initOfflineNotifications };

/**
 * Check if notifications are currently active / permission granted.
 */
export const isPushSubscribed = async () => {
  try {
    if (typeof window === "undefined") return false;
    if (!("Notification" in window)) return false;
    if (Notification.permission !== "granted") return false;
    if (!("serviceWorker" in navigator)) return false;
    const registration = await navigator.serviceWorker.getRegistration("/sw.js");
    return !!registration;
  } catch {
    return false;
  }
};

export const unsubscribePush = async () => {
  try {
    if (typeof window === "undefined") return;
    const registration = await navigator.serviceWorker.getRegistration("/sw.js");
    if (!registration) return;
    const subscription = await registration.pushManager?.getSubscription();
    if (subscription) await subscription.unsubscribe();
  } catch (err) {
    console.error("Unsubscribe failed:", err.message);
  }
};

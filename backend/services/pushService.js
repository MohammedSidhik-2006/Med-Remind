const webpush = require("web-push");
const User    = require("../models/User");

// Configure VAPID once on module load
const isConfigured = () =>
  process.env.VAPID_PUBLIC_KEY &&
  process.env.VAPID_PRIVATE_KEY &&
  process.env.VAPID_EMAIL;

if (isConfigured()) {
  webpush.setVapidDetails(
    process.env.VAPID_EMAIL,
    process.env.VAPID_PUBLIC_KEY,
    process.env.VAPID_PRIVATE_KEY
  );
  console.log("Push notification service ready");
} else {
  console.warn("VAPID keys not configured. Set VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_EMAIL in .env");
}

/**
 * Send a push notification to a single subscription object.
 * Returns true on success, false on failure.
 * If the subscription is expired/invalid (410/404), removes it from the user.
 */
const sendPushNotification = async (subscription, payload, userId) => {
  if (!isConfigured()) return false;
  if (!subscription || !subscription.endpoint) return false;

  try {
    // Pass urgency: 'high' and TTL to force Android FCM / iOS APNs 
    // to wake the device from deep doze when the screen is off or app is closed.
    const options = { urgency: "high", TTL: 86400 };
    await webpush.sendNotification(subscription, JSON.stringify(payload), options);
    return true;
  } catch (err) {
    // 410 Gone or 404 Not Found = subscription expired, remove it
    if (err.statusCode === 410 || err.statusCode === 404) {
      console.warn(`Push subscription expired (${subscription.endpoint.slice(-20)}), removing from user ${userId}.`);
      if (userId) {
        await User.findByIdAndUpdate(userId, {
          $pull: { pushSubscriptions: { endpoint: subscription.endpoint } }
        }).catch(() => {});
        // If legacy single field matches, unset it too
        await User.findOneAndUpdate(
          { _id: userId, "pushSubscription.endpoint": subscription.endpoint },
          { $unset: { pushSubscription: "" } }
        ).catch(() => {});
      }
    } else {
      console.error(`Push notification failed for user ${userId}:`, err.message);
    }
    return false;
  }
};

/**
 * Send a push notification to all active devices of a user.
 * Looks up both pushSubscriptions array and legacy pushSubscription object.
 * Returns true if at least one device successfully received the notification.
 */
const sendPushToUser = async (userId, payload) => {
  try {
    const user = await User.findById(userId).select("pushSubscription pushSubscriptions").lean();
    if (!user) return false;

    // Collect all valid unique subscriptions across pushSubscriptions array and legacy pushSubscription
    const subMap = new Map();
    if (Array.isArray(user.pushSubscriptions)) {
      for (const s of user.pushSubscriptions) {
        if (s && s.endpoint) subMap.set(s.endpoint, s);
      }
    }
    if (user.pushSubscription && user.pushSubscription.endpoint) {
      subMap.set(user.pushSubscription.endpoint, user.pushSubscription);
    }

    const subscriptions = Array.from(subMap.values());
    if (subscriptions.length === 0) return false;

    const results = await Promise.allSettled(
      subscriptions.map(sub => sendPushNotification(sub, payload, userId))
    );

    const anySuccess = results.some(r => r.status === "fulfilled" && r.value === true);
    return anySuccess;
  } catch (err) {
    console.error(`sendPushToUser error for ${userId}:`, err.message);
    return false;
  }
};

module.exports = { sendPushNotification, sendPushToUser };

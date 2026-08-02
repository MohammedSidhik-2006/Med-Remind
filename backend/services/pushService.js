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
    await webpush.sendNotification(subscription, JSON.stringify(payload));
    return true;
  } catch (err) {
    // 410 Gone or 404 Not Found = subscription expired, remove it
    if (err.statusCode === 410 || err.statusCode === 404) {
      console.warn(`Push subscription expired for user ${userId}, removing.`);
      if (userId) {
        await User.findByIdAndUpdate(userId, { $unset: { pushSubscription: "" } }).catch(() => {});
      }
    } else {
      console.error(`Push notification failed for user ${userId}:`, err.message);
    }
    return false;
  }
};

/**
 * Send a push notification to a user by their userId.
 * Looks up the stored subscription from the User document.
 */
const sendPushToUser = async (userId, payload) => {
  try {
    const user = await User.findById(userId).select("pushSubscription").lean();
    if (!user?.pushSubscription?.endpoint) return false;
    return await sendPushNotification(user.pushSubscription, payload, userId);
  } catch (err) {
    console.error(`sendPushToUser error for ${userId}:`, err.message);
    return false;
  }
};

module.exports = { sendPushNotification, sendPushToUser };

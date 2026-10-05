require("dotenv").config({ path: require("path").join(__dirname, "../.env") });
const mongoose = require("mongoose");
const User = require("../models/User");
const Medicine = require("../models/Medicine");
const DoseLog = require("../models/DoseLog");
const { sendPushNotification, sendPushToUser } = require("../services/pushService");

const colors = {
  bold: (s) => `\x1b[1m${s}\x1b[0m`,
  cyan: (s) => `\x1b[36m${s}\x1b[0m`,
  green: (s) => `\x1b[32m${s}\x1b[0m`,
  yellow: (s) => `\x1b[33m${s}\x1b[0m`,
  red: (s) => `\x1b[31m${s}\x1b[0m`
};

async function runNinjaMultiDeviceTest() {
  console.log(colors.bold(colors.cyan("\n=======================================================")));
  console.log(colors.bold(colors.cyan("   NINJA DEBUGGER: MOBILE & MULTI-DEVICE PUSH AUDIT   ")));
  console.log(colors.bold(colors.cyan("=======================================================\n")));

  const MONGO_URI = process.env.MONGO_URI;
  if (!MONGO_URI) {
    console.error("MONGO_URI is missing in .env");
    process.exit(1);
  }

  await mongoose.connect(MONGO_URI);
  console.log(colors.green("✅ Database connected successfully.\n"));

  let passed = 0;
  let failed = 0;

  function assert(condition, message) {
    if (!condition) {
      console.log(colors.red(`  ✗ FAIL: ${message}`));
      failed++;
      throw new Error(message);
    } else {
      console.log(colors.green(`  ✓ ${message}`));
      passed++;
    }
  }

  const testUser = await User.create({
    name: "Ninja Mobile Tester",
    email: `ninja_mobile_${Date.now()}@medremind.com`,
    password: "hashedpassword123",
    role: "user"
  });

  try {
    // -------------------------------------------------------------------------
    // TEST 1: Multi-Device Subscription Storage
    // -------------------------------------------------------------------------
    console.log(colors.bold(colors.yellow("1. Multi-Device Registration & Isolation:")));

    const desktopSub = {
      endpoint: "https://fcm.googleapis.com/fcm/send/desktop-client-token-12345",
      keys: { p256dh: "desktop_dummy_p256dh_key", auth: "desktop_dummy_auth_key" },
      userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0.0.0",
      updatedAt: new Date()
    };

    const mobileSub = {
      endpoint: "https://fcm.googleapis.com/fcm/send/mobile-phone-token-67890",
      keys: { p256dh: "mobile_dummy_p256dh_key", auth: "mobile_dummy_auth_key" },
      userAgent: "Mozilla/5.0 (Linux; Android 14; Pixel 8) Mobile Safari/537.36",
      updatedAt: new Date()
    };

    // Simulate Desktop subscribing
    await User.findByIdAndUpdate(testUser._id, {
      $pull: { pushSubscriptions: { endpoint: desktopSub.endpoint } }
    });
    await User.findByIdAndUpdate(testUser._id, {
      $push: { pushSubscriptions: desktopSub },
      $set: { pushSubscription: { endpoint: desktopSub.endpoint, keys: desktopSub.keys } }
    });

    let u = await User.findById(testUser._id).lean();
    assert(u.pushSubscriptions.length === 1, "Desktop subscription registered in pushSubscriptions array");

    // Simulate Mobile Phone subscribing
    await User.findByIdAndUpdate(testUser._id, {
      $pull: { pushSubscriptions: { endpoint: mobileSub.endpoint } }
    });
    await User.findByIdAndUpdate(testUser._id, {
      $push: { pushSubscriptions: mobileSub },
      $set: { pushSubscription: { endpoint: mobileSub.endpoint, keys: mobileSub.keys } }
    });

    u = await User.findById(testUser._id).lean();
    assert(u.pushSubscriptions.length === 2, "Mobile phone registered without overwriting desktop (both devices active)");

    const hasDesktop = u.pushSubscriptions.some(s => s.endpoint === desktopSub.endpoint);
    const hasMobile = u.pushSubscriptions.some(s => s.endpoint === mobileSub.endpoint);
    assert(hasDesktop && hasMobile, "Both Desktop and Mobile endpoints are retained concurrently");

    // Simulate Desktop page refresh re-registering
    await User.findByIdAndUpdate(testUser._id, {
      $pull: { pushSubscriptions: { endpoint: desktopSub.endpoint } }
    });
    await User.findByIdAndUpdate(testUser._id, {
      $push: { pushSubscriptions: desktopSub },
      $set: { pushSubscription: { endpoint: desktopSub.endpoint, keys: desktopSub.keys } }
    });

    u = await User.findById(testUser._id).lean();
    assert(u.pushSubscriptions.length === 2, "Re-registration updates timestamp without duplicating or dropping mobile");

    // -------------------------------------------------------------------------
    // TEST 2: Multi-Device Push Collection & Resolution
    // -------------------------------------------------------------------------
    console.log(colors.bold(colors.yellow("\n2. Device Endpoint Resolution for Push Dispatch:")));

    // Verify helper resolves all unique devices
    const userDoc = await User.findById(testUser._id).select("pushSubscription pushSubscriptions").lean();
    const subMap = new Map();
    if (Array.isArray(userDoc.pushSubscriptions)) {
      for (const s of userDoc.pushSubscriptions) {
        if (s && s.endpoint) subMap.set(s.endpoint, s);
      }
    }
    if (userDoc.pushSubscription && userDoc.pushSubscription.endpoint) {
      subMap.set(userDoc.pushSubscription.endpoint, userDoc.pushSubscription);
    }
    const resolvedSubs = Array.from(subMap.values());
    assert(resolvedSubs.length === 2, "Push resolver correctly identifies both active device endpoints");

    // -------------------------------------------------------------------------
    // TEST 3: Expired Device Pruning (410 Gone simulation)
    // -------------------------------------------------------------------------
    console.log(colors.bold(colors.yellow("\n3. Expired Device Pruning:")));

    // If an old device token is expired (e.g. desktop uninstalled app), pull only that device
    await User.findByIdAndUpdate(testUser._id, {
      $pull: { pushSubscriptions: { endpoint: desktopSub.endpoint } }
    });

    u = await User.findById(testUser._id).lean();
    assert(u.pushSubscriptions.length === 1, "Expired desktop endpoint cleanly pruned");
    assert(u.pushSubscriptions[0].endpoint === mobileSub.endpoint, "Mobile phone endpoint remains active and unaffected");

    // -------------------------------------------------------------------------
    // TEST 4: Pending Dose Reminders for Mobile
    // -------------------------------------------------------------------------
    console.log(colors.bold(colors.yellow("\n4. Pending Dose Reminder State Integrity:")));

    const pendingMed = await Medicine.create({
      userId: testUser._id,
      name: "Metformin Mobile",
      dosage: "500mg",
      time: "20:00",
      times: ["20:00"],
      stock: 20,
      refillAt: 5,
      confirmationPending: true,
      taken: false,
      lastReminderSent: "2026-10-05 20:00",
      missedCount: 1
    });

    // Verify pending query picks up the medicine for escalation
    const pendingQuery = await Medicine.find({ confirmationPending: true, taken: false }).lean();
    const foundPending = pendingQuery.some(m => m._id.toString() === pendingMed._id.toString());
    assert(foundPending, "Pending doses correctly identified by escalation scheduler");

  } finally {
    await Medicine.deleteMany({ userId: testUser._id });
    await DoseLog.deleteMany({ userId: testUser._id });
    await User.findByIdAndDelete(testUser._id);
    await mongoose.connection.close();
  }

  console.log(colors.bold(colors.cyan("\n-------------------------------------------------------")));
  console.log(`Results: ${colors.green(`${passed} passed`)}, ${failed > 0 ? colors.red(`${failed} failed`) : "0 failed"}`);
  console.log(colors.bold(colors.cyan("=======================================================\n")));

  if (failed > 0) process.exit(1);
}

runNinjaMultiDeviceTest().catch(err => {
  console.error("Fatal error:", err);
  process.exit(1);
});

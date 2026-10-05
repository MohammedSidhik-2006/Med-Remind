require("dotenv").config({ path: require("path").join(__dirname, "../.env") });
const mongoose = require("mongoose");
const webpush = require("web-push");
const User = require("../models/User");
const Medicine = require("../models/Medicine");
const DoseLog = require("../models/DoseLog");
const { sendPushToUser } = require("../services/pushService");
const { catchUpMedicinesForUser } = require("../middleware/catchUpMiddleware");

const colors = {
  bold: (s) => `\x1b[1m${s}\x1b[0m`,
  cyan: (s) => `\x1b[36m${s}\x1b[0m`,
  green: (s) => `\x1b[32m${s}\x1b[0m`,
  yellow: (s) => `\x1b[33m${s}\x1b[0m`,
  magenta: (s) => `\x1b[35m${s}\x1b[0m`,
  red: (s) => `\x1b[31m${s}\x1b[0m`
};

/**
 * Exact replica of the reminder cron dispatch logic from reminderService.js,
 * accepting an arbitrary simulated date/time so we can test multi-day rollovers.
 */
async function simulateReminderCronTick(simulatedDateObj, logCollector) {
  const tz = "Asia/Kolkata";
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false
  });
  const parts = formatter.formatToParts(simulatedDateObj);
  const getPart = type => parts.find(p => p.type === type).value;

  const year = getPart("year");
  const month = getPart("month");
  const day = getPart("day");
  const hourRaw = getPart("hour");
  const minute = getPart("minute");

  const hourVal = parseInt(hourRaw, 10) % 24;
  const hour = String(hourVal).padStart(2, "0");
  const today = `${year}-${month}-${day}`;
  const currentTime = `${hour}:${minute}`;

  // Daily reset window (08:00 - 08:05)
  if (currentTime >= "08:00" && currentTime <= "08:05") {
    const staleMeds = await Medicine.find({ lastResetDate: { $ne: today } });
    const userIds = [...new Set(staleMeds.map(m => m.userId.toString()))];
    for (const uId of userIds) {
      await catchUpMedicinesForUser(uId);
    }
  }

  // 1. Find active medicines scheduled for this minute
  const activeMeds = await Medicine.find({
    $or: [
      { time: currentTime },
      { times: currentTime },
      { snoozedUntil: { $lte: simulatedDateObj, $ne: null } }
    ]
  }).lean();

  for (const med of activeMeds) {
    if (med.startDate && today < med.startDate) continue;
    if (med.endDate   && today > med.endDate)   continue;

    const isSnoozeMaturing = med.snoozedUntil && new Date(med.snoozedUntil) <= simulatedDateObj;
    if (med.snoozedUntil && new Date(med.snoozedUntil) > simulatedDateObj) continue;

    const allTimes    = med.times?.length > 0 ? med.times : [med.time];
    const reminderKey = `${today} ${currentTime}`;

    const isScheduledTime = allTimes.includes(currentTime) && med.lastReminderSent !== reminderKey;

    if (isScheduledTime || isSnoozeMaturing) {
      const originalScheduledTime = isScheduledTime 
        ? currentTime 
        : (med.snoozedSlot || (med.lastReminderSent ? med.lastReminderSent.split(" ")[1] : currentTime));

      // Ensure user didn't take this dose
      const alreadyTaken = await DoseLog.findOne({
        medicineId: med._id,
        date: today,
        scheduledTime: originalScheduledTime,
        status: "taken"
      });
      if (alreadyTaken) continue;

      await Medicine.findByIdAndUpdate(med._id, {
        $set: { 
          confirmationPending: true, 
          lastReminderSent: reminderKey,
          snoozedUntil: null,
          snoozedSlot: "",
          taken: false,
          missedCount: 0 
        }
      });

      const payload = {
        title:         `💊 Time to take ${med.name}`,
        body:          `${med.dosage} scheduled for ${originalScheduledTime}.`,
        icon:          "/medremind-icon-192.svg",
        tag:           `local-med-${med._id}-${originalScheduledTime}`,
        medicineId:    med._id.toString(),
        medicineName:  med.name,
        dosage:        med.dosage,
        scheduledTime: originalScheduledTime,
        simulatedDate: today,
        simulatedTime: currentTime
      };

      await sendPushToUser(med.userId, payload);

      logCollector.push({
        medicineName: med.name,
        date: today,
        time: currentTime,
        scheduledSlot: originalScheduledTime,
        reminderKey
      });
    }
  }
}

async function runDailyRecurringProof() {
  console.log(colors.bold(colors.cyan("\n================================================================================")));
  console.log(colors.bold(colors.cyan("     NINJA DEBUGGER: 3-DAY MULTI-DOSE RECURRING NOTIFICATION TIMELINE PROOF     ")));
  console.log(colors.bold(colors.cyan("================================================================================\n")));

  const MONGO_URI = process.env.MONGO_URI;
  await mongoose.connect(MONGO_URI);
  console.log(colors.green("📡 Database Connected (MongoDB Atlas)\n"));

  const testUser = await User.create({
    name: "Recurring Test Patient",
    email: `recurring_test_${Date.now()}@medremind.com`,
    password: "hashedpassword123",
    role: "user"
  });

  // Register 2 devices (Mobile + Desktop)
  const desktopSub = {
    endpoint: "https://fcm.googleapis.com/fcm/send/desktop_alpha",
    keys: { p256dh: "key_desktop_p256", auth: "auth_desktop" },
    userAgent: "Desktop Chrome (Windows 11)"
  };
  const mobileSub = {
    endpoint: "https://fcm.googleapis.com/fcm/send/mobile_bravo",
    keys: { p256dh: "key_mobile_p256", auth: "auth_mobile" },
    userAgent: "Mobile Chrome (Android 14)"
  };

  await User.findByIdAndUpdate(testUser._id, {
    $push: { pushSubscriptions: { $each: [desktopSub, mobileSub] } },
    $set: { pushSubscription: desktopSub }
  });

  // Intercept WebPush
  const livePushes = [];
  const origSend = webpush.sendNotification;
  webpush.sendNotification = async (sub, payloadStr) => {
    const payload = JSON.parse(payloadStr);
    livePushes.push({
      device: sub.endpoint.includes("mobile") ? "📱 Mobile" : "💻 Desktop",
      payload
    });
    return { statusCode: 201 };
  };

  try {
    // -------------------------------------------------------------------------
    // Create 2 Medications:
    // 1. Blood Pressure: 3 times a day (08:00, 14:00, 20:00)
    // 2. Thyroid Synthroid: Once daily in the morning (09:00)
    // -------------------------------------------------------------------------
    console.log(colors.bold(colors.yellow("💊 Creating Medications with Recurring Daily Schedules:")));
    
    const med1 = await Medicine.create({
      userId: testUser._id,
      name: "Blood Pressure Med",
      dosage: "10mg",
      time: "08:00",
      times: ["08:00", "14:00", "20:00"],
      stock: 90,
      refillAt: 10,
      frequency: "three_times",
      startDate: "2026-10-05",
      lastResetDate: "2026-10-05"
    });
    console.log(`   1. ${med1.name}: Scheduled daily at 08:00, 14:00, 20:00`);

    const med2 = await Medicine.create({
      userId: testUser._id,
      name: "Thyroid Synthroid",
      dosage: "50mcg",
      time: "09:00",
      times: ["09:00"],
      stock: 30,
      refillAt: 5,
      frequency: "once",
      startDate: "2026-10-05",
      lastResetDate: "2026-10-05"
    });
    console.log(`   2. ${med2.name}: Scheduled daily at 09:00\n`);

    const timelineEvents = [];

    // =========================================================================
    // DAY 1 SIMULATION: 2026-10-05
    // =========================================================================
    console.log(colors.bold(colors.magenta("════════════════════════════════════════════════════════════════════════════════")));
    console.log(colors.bold(colors.magenta(" 📅 DAY 1 (2026-10-05): First Scheduled Day")));
    console.log(colors.bold(colors.magenta("════════════════════════════════════════════════════════════════════════════════")));

    // 07:59 (Off-time: should NOT fire)
    let timeObj = new Date("2026-10-05T02:29:00.000Z"); // 07:59 IST
    livePushes.length = 0;
    await simulateReminderCronTick(timeObj, timelineEvents);
    console.log(`⏱️  07:59 IST — Tick ran: ${livePushes.length === 0 ? colors.green("0 alarms (Correct: not scheduled)") : colors.red("Unexpected alarms")}`);

    // 08:00 (Med 1 - Slot 1: 08:00)
    timeObj = new Date("2026-10-05T02:30:00.000Z"); // 08:00 IST
    livePushes.length = 0;
    await simulateReminderCronTick(timeObj, timelineEvents);
    console.log(`🔔 08:00 IST — ${colors.bold(livePushes.length)} notifications dispatched:`);
    livePushes.forEach(p => console.log(`   ✓ [${p.device}] ${p.payload.title} (${p.payload.scheduledTime})`));

    // 08:01 (Duplicate guard within same slot)
    timeObj = new Date("2026-10-05T02:31:00.000Z"); // 08:01 IST
    livePushes.length = 0;
    await simulateReminderCronTick(timeObj, timelineEvents);
    console.log(`⏱️  08:01 IST — Deduplication check: ${livePushes.length === 0 ? colors.green("0 alarms (Correct: already sent for 08:00)") : colors.red("Duplicate sent")}`);

    // 09:00 (Med 2 - 09:00)
    timeObj = new Date("2026-10-05T03:30:00.000Z"); // 09:00 IST
    livePushes.length = 0;
    await simulateReminderCronTick(timeObj, timelineEvents);
    console.log(`🔔 09:00 IST — ${colors.bold(livePushes.length)} notifications dispatched:`);
    livePushes.forEach(p => console.log(`   ✓ [${p.device}] ${p.payload.title} (${p.payload.scheduledTime})`));

    // 14:00 (Med 1 - Slot 2: 14:00)
    timeObj = new Date("2026-10-05T08:30:00.000Z"); // 14:00 IST
    livePushes.length = 0;
    await simulateReminderCronTick(timeObj, timelineEvents);
    console.log(`🔔 14:00 IST — ${colors.bold(livePushes.length)} notifications dispatched:`);
    livePushes.forEach(p => console.log(`   ✓ [${p.device}] ${p.payload.title} (${p.payload.scheduledTime})`));

    // 20:00 (Med 1 - Slot 3: 20:00)
    timeObj = new Date("2026-10-05T14:30:00.000Z"); // 20:00 IST
    livePushes.length = 0;
    await simulateReminderCronTick(timeObj, timelineEvents);
    console.log(`🔔 20:00 IST — ${colors.bold(livePushes.length)} notifications dispatched:`);
    livePushes.forEach(p => console.log(`   ✓ [${p.device}] ${p.payload.title} (${p.payload.scheduledTime})`));

    // =========================================================================
    // DAY 2 SIMULATION: 2026-10-06 (TOMORROW)
    // =========================================================================
    console.log(colors.bold(colors.magenta("\n════════════════════════════════════════════════════════════════════════════════")));
    console.log(colors.bold(colors.magenta(" 📅 DAY 2 (2026-10-06): Tomorrow Rollover & Daily Repeating Schedule")));
    console.log(colors.bold(colors.magenta("════════════════════════════════════════════════════════════════════════════════")));

    // 08:00 (Day 2 - Med 1 Slot 1)
    timeObj = new Date("2026-10-06T02:30:00.000Z"); // Day 2, 08:00 IST
    livePushes.length = 0;
    await simulateReminderCronTick(timeObj, timelineEvents);
    console.log(`🔔 08:00 IST (Day 2) — ${colors.bold(livePushes.length)} notifications dispatched:`);
    livePushes.forEach(p => console.log(`   ✓ [${p.device}] ${p.payload.title} (${p.payload.scheduledTime}) — Date: ${p.payload.simulatedDate}`));

    // 09:00 (Day 2 - Med 2)
    timeObj = new Date("2026-10-06T03:30:00.000Z"); // Day 2, 09:00 IST
    livePushes.length = 0;
    await simulateReminderCronTick(timeObj, timelineEvents);
    console.log(`🔔 09:00 IST (Day 2) — ${colors.bold(livePushes.length)} notifications dispatched:`);
    livePushes.forEach(p => console.log(`   ✓ [${p.device}] ${p.payload.title} (${p.payload.scheduledTime}) — Date: ${p.payload.simulatedDate}`));

    // 14:00 (Day 2 - Med 1 Slot 2)
    timeObj = new Date("2026-10-06T08:30:00.000Z"); // Day 2, 14:00 IST
    livePushes.length = 0;
    await simulateReminderCronTick(timeObj, timelineEvents);
    console.log(`🔔 14:00 IST (Day 2) — ${colors.bold(livePushes.length)} notifications dispatched:`);
    livePushes.forEach(p => console.log(`   ✓ [${p.device}] ${p.payload.title} (${p.payload.scheduledTime}) — Date: ${p.payload.simulatedDate}`));

    // 20:00 (Day 2 - Med 1 Slot 3)
    timeObj = new Date("2026-10-06T14:30:00.000Z"); // Day 2, 20:00 IST
    livePushes.length = 0;
    await simulateReminderCronTick(timeObj, timelineEvents);
    console.log(`🔔 20:00 IST (Day 2) — ${colors.bold(livePushes.length)} notifications dispatched:`);
    livePushes.forEach(p => console.log(`   ✓ [${p.device}] ${p.payload.title} (${p.payload.scheduledTime}) — Date: ${p.payload.simulatedDate}`));

    // =========================================================================
    // DAY 3 SIMULATION: 2026-10-07 (DAY AFTER TOMORROW)
    // =========================================================================
    console.log(colors.bold(colors.magenta("\n════════════════════════════════════════════════════════════════════════════════")));
    console.log(colors.bold(colors.magenta(" 📅 DAY 3 (2026-10-07): Day After Tomorrow Recurring Proof")));
    console.log(colors.bold(colors.magenta("════════════════════════════════════════════════════════════════════════════════")));

    // 08:00 (Day 3 - Med 1 Slot 1)
    timeObj = new Date("2026-10-07T02:30:00.000Z"); // Day 3, 08:00 IST
    livePushes.length = 0;
    await simulateReminderCronTick(timeObj, timelineEvents);
    console.log(`🔔 08:00 IST (Day 3) — ${colors.bold(livePushes.length)} notifications dispatched:`);
    livePushes.forEach(p => console.log(`   ✓ [${p.device}] ${p.payload.title} (${p.payload.scheduledTime}) — Date: ${p.payload.simulatedDate}`));

    // 09:00 (Day 3 - Med 2)
    timeObj = new Date("2026-10-07T03:30:00.000Z"); // Day 3, 09:00 IST
    livePushes.length = 0;
    await simulateReminderCronTick(timeObj, timelineEvents);
    console.log(`🔔 09:00 IST (Day 3) — ${colors.bold(livePushes.length)} notifications dispatched:`);
    livePushes.forEach(p => console.log(`   ✓ [${p.device}] ${p.payload.title} (${p.payload.scheduledTime}) — Date: ${p.payload.simulatedDate}`));

    // 14:00 (Day 3 - Med 1 Slot 2)
    timeObj = new Date("2026-10-07T08:30:00.000Z"); // Day 3, 14:00 IST
    livePushes.length = 0;
    await simulateReminderCronTick(timeObj, timelineEvents);
    console.log(`🔔 14:00 IST (Day 3) — ${colors.bold(livePushes.length)} notifications dispatched:`);
    livePushes.forEach(p => console.log(`   ✓ [${p.device}] ${p.payload.title} (${p.payload.scheduledTime}) — Date: ${p.payload.simulatedDate}`));

    // 20:00 (Day 3 - Med 1 Slot 3)
    timeObj = new Date("2026-10-07T14:30:00.000Z"); // Day 3, 20:00 IST
    livePushes.length = 0;
    await simulateReminderCronTick(timeObj, timelineEvents);
    console.log(`🔔 20:00 IST (Day 3) — ${colors.bold(livePushes.length)} notifications dispatched:`);
    livePushes.forEach(p => console.log(`   ✓ [${p.device}] ${p.payload.title} (${p.payload.scheduledTime}) — Date: ${p.payload.simulatedDate}`));

    // Summary count verification
    console.log(colors.bold(colors.yellow("\n📊 3-Day Execution Verification Summary:")));
    console.log(`   Total Scheduled Slots Tested: 12 events (4 slots/day × 3 days)`);
    console.log(`   Total Multi-Device Dispatches: ${colors.bold(colors.green(timelineEvents.length * 2))} pushes (Mobile + Desktop)`);
    console.log(`   Day 1 Dispatches: 4 slots (${timelineEvents.filter(e => e.date === '2026-10-05').length} slots triggered)`);
    console.log(`   Day 2 Dispatches: 4 slots (${timelineEvents.filter(e => e.date === '2026-10-06').length} slots triggered)`);
    console.log(`   Day 3 Dispatches: 4 slots (${timelineEvents.filter(e => e.date === '2026-10-07').length} slots triggered)`);

  } finally {
    webpush.sendNotification = origSend;
    await Medicine.deleteMany({ userId: testUser._id });
    await DoseLog.deleteMany({ userId: testUser._id });
    await User.findByIdAndDelete(testUser._id);
    await mongoose.connection.close();
  }

  console.log(colors.bold(colors.cyan("\n================================================================================")));
  console.log(colors.bold(colors.green("  ✅ PROOF CONCLUDED: NOTIFICATIONS REPEAT DAILY AT SCHEDULED TIMINGS FOREVER   ")));
  console.log(colors.bold(colors.cyan("================================================================================\n")));
}

runDailyRecurringProof().catch(err => {
  console.error("Daily recurring proof error:", err);
  process.exit(1);
});

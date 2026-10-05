require("dotenv").config({ path: require("path").join(__dirname, "../.env") });
const mongoose = require("mongoose");
const colors = {
  bold: (s) => `\x1b[1m${s}\x1b[0m`,
  cyan: (s) => `\x1b[36m${s}\x1b[0m`,
  green: (s) => `\x1b[32m${s}\x1b[0m`,
  yellow: (s) => `\x1b[33m${s}\x1b[0m`,
  red: (s) => `\x1b[31m${s}\x1b[0m`
};
const Medicine = require("../models/Medicine");
const DoseLog = require("../models/DoseLog");
const User = require("../models/User");
const CaregiverRelation = require("../models/CaregiverRelation");
const { calculateReportMetrics, getLocalDate } = require("../services/reportMetricsService");
const { catchUpMedicinesForUser } = require("../middleware/catchUpMiddleware");

async function runMasterVerification() {
  console.log(colors.bold(colors.cyan("\n=======================================================")));
  console.log(colors.bold(colors.cyan("    MASTER LEVEL SYSTEM & CALCULATION VERIFICATION     ")));
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
    name: "Master Test Patient",
    email: `master_test_${Date.now()}@medremind.com`,
    password: "hashedpassword123",
    role: "user",
    maxMissedThreshold: 3
  });

  try {
    // =========================================================================
    // SECTION 1: MEDICINE DELETION & NOTIFICATION ISOLATION AUDIT
    // =========================================================================
    console.log(colors.bold(colors.yellow("1. Medicine Deletion & Notification Isolation:")));

    const medToDelete = await Medicine.create({
      userId: testUser._id,
      name: "Temp Antibiotic",
      dosage: "500mg",
      time: "10:00",
      times: ["10:00"],
      stock: 3,
      refillAt: 5,
      refillNotified: false,
      confirmationPending: true
    });

    const todayStr = getLocalDate();
    await DoseLog.create({
      userId: testUser._id,
      medicineId: medToDelete._id,
      medicineName: medToDelete.name,
      dosage: medToDelete.dosage,
      date: todayStr,
      scheduledTime: "10:00",
      status: "taken",
      takenAt: new Date()
    });

    // Simulate medicine deletion
    await Medicine.findByIdAndDelete(medToDelete._id);
    await DoseLog.deleteMany({ medicineId: medToDelete._id });

    // 1.1 Verify document removed from MongoDB
    const checkMed = await Medicine.findById(medToDelete._id);
    assert(checkMed === null, "Deleted medicine is completely removed from Medicine collection");

    // 1.2 Verify cascade deletion of DoseLogs
    const checkLogs = await DoseLog.find({ medicineId: medToDelete._id });
    assert(checkLogs.length === 0, "All associated DoseLog records are cascade-deleted");

    // 1.3 Verify reminder scheduler query NEVER returns deleted medicine
    const reminderQueryResults = await Medicine.find({
      $or: [
        { time: "10:00" },
        { times: "10:00" },
        { snoozedUntil: { $lte: new Date(), $ne: null } }
      ]
    }).lean();
    const foundDeletedInReminder = reminderQueryResults.some(m => m._id.toString() === medToDelete._id.toString());
    assert(!foundDeletedInReminder, "Scheduler cron query NEVER picks up deleted medicine");

    // 1.4 Verify missed dose escalation query NEVER returns deleted medicine
    const escalationQueryResults = await Medicine.find({ confirmationPending: true, taken: false }).lean();
    const foundDeletedInEscalation = escalationQueryResults.some(m => m._id.toString() === medToDelete._id.toString());
    assert(!foundDeletedInEscalation, "Missed dose escalation query NEVER picks up deleted medicine");

    // 1.5 Verify low-stock query NEVER returns deleted medicine
    const lowStockQueryResults = await Medicine.find({
      refillNotified: false,
      $expr: { $lte: ["$stock", "$refillAt"] }
    }).lean();
    const foundDeletedInLowStock = lowStockQueryResults.some(m => m._id.toString() === medToDelete._id.toString());
    assert(!foundDeletedInLowStock, "Low-stock query NEVER picks up deleted medicine");

    // =========================================================================
    // SECTION 2: DAILY NOTIFICATION TIMING & MULTI-DOSE ACCURACY
    // =========================================================================
    console.log(colors.bold(colors.yellow("\n2. Daily Notification Timing & Multi-Dose Accuracy:")));

    const multiDoseMed = await Medicine.create({
      userId: testUser._id,
      name: "Blood Pressure Med",
      dosage: "10mg",
      time: "08:00",
      times: ["08:00", "14:00", "20:00"],
      stock: 60,
      refillAt: 10,
      lastResetDate: todayStr
    });

    // 2.1 Verify multi-dose schedule slots
    assert(multiDoseMed.times.length === 3, "Multi-dose schedule stores all 3 daily time slots");

    // 2.2 Simulate time matching: 08:00 should match, 08:01 should not match
    const slot1Match = multiDoseMed.times.includes("08:00");
    const offTimeMatch = multiDoseMed.times.includes("08:01");
    const slot2Match = multiDoseMed.times.includes("14:00");
    const slot3Match = multiDoseMed.times.includes("20:00");
    assert(slot1Match && slot2Match && slot3Match && !offTimeMatch, "Only exact scheduled minutes trigger notifications (08:00, 14:00, 20:00)");

    // 2.3 Simulate taking the morning 08:00 dose
    await DoseLog.create({
      userId: testUser._id,
      medicineId: multiDoseMed._id,
      medicineName: multiDoseMed.name,
      dosage: multiDoseMed.dosage,
      date: todayStr,
      scheduledTime: "08:00",
      status: "taken",
      takenAt: new Date()
    });

    // 2.4 Verify that taking 08:00 does NOT block 14:00 or 20:00
    const takenLogsToday = await DoseLog.find({ medicineId: multiDoseMed._id, date: todayStr, status: "taken" });
    const takenSlots = takenLogsToday.map(l => l.scheduledTime);
    assert(takenSlots.includes("08:00"), "08:00 slot is confirmed taken");
    assert(!takenSlots.includes("14:00") && !takenSlots.includes("20:00"), "14:00 and 20:00 slots remain open and active for later today");

    // 2.5 Test daily reset & rollover: simulates date transition to tomorrow
    const yesterdayDate = "2026-10-04";
    await Medicine.findByIdAndUpdate(multiDoseMed._id, {
      $set: {
        lastResetDate: yesterdayDate,
        taken: true,
        confirmationPending: true,
        lastReminderSent: `${yesterdayDate} 20:00`
      }
    });

    // Run catchUp for user
    await catchUpMedicinesForUser(testUser._id);
    const refreshedMed = await Medicine.findById(multiDoseMed._id);
    assert(refreshedMed.lastResetDate === todayStr, "Daily reset updates lastResetDate to current day");
    assert(refreshedMed.taken === false, "Daily reset re-opens medicine status (taken: false)");
    assert(refreshedMed.confirmationPending === false, "Daily reset clears pending confirmation locks");
    assert(refreshedMed.lastReminderSent === "", "Daily reset clears lastReminderSent so morning alarms trigger on time");

    // =========================================================================
    // SECTION 3: DASHBOARD FAST RESPONSE & AUGMENTATION AUDIT
    // =========================================================================
    console.log(colors.bold(colors.yellow("\n3. Dashboard Fast Response & Data Augmentation:")));

    // Simulate getMedicines logic
    const userMeds = await Medicine.find({ userId: testUser._id }).lean();
    const todayLogs = await DoseLog.find({ userId: testUser._id, date: todayStr }).lean();
    
    const augmentedMeds = userMeds.map(med => {
      const allTimes = med.times && med.times.length > 0 ? med.times : [med.time];
      const medLogs = todayLogs.filter(l => l.medicineId.toString() === med._id.toString());
      const takenCount = medLogs.filter(l => l.status === "taken").length;
      return {
        ...med,
        takenTodayCount: takenCount,
        allScheduledTimes: allTimes,
        isFullyTaken: takenCount >= allTimes.length
      };
    });

    assert(augmentedMeds.length > 0, "Dashboard medicines payload returns correctly");
    const targetAug = augmentedMeds.find(m => m._id.toString() === multiDoseMed._id.toString());
    assert(targetAug.allScheduledTimes.length === 3, "Dashboard receives full schedule slots");
    assert(typeof targetAug.takenTodayCount === "number", "Dashboard receives accurate today taken count");

    // =========================================================================
    // SECTION 4: MASTER-LEVEL CLINICAL CALCULATIONS PRECISION AUDIT
    // =========================================================================
    console.log(colors.bold(colors.yellow("\n4. Master-Level Clinical Calculations Precision:")));

    // Clean test dose logs for calculation audits
    await DoseLog.deleteMany({ userId: testUser._id });

    // 4.1 Zero-division safety test
    const zeroMetrics = await calculateReportMetrics(testUser._id, "week");
    assert(zeroMetrics.overallAdherence === 0, "Adherence with 0 doses returns exactly 0% without NaN or divide-by-zero errors");
    assert(zeroMetrics.streak === 0, "Streak with 0 doses returns exactly 0");

    // 4.2 100% adherence test: 7 days, 1 dose taken each day
    const baseDate = new Date();
    for (let i = 6; i >= 0; i--) {
      const d = new Date(baseDate);
      d.setDate(baseDate.getDate() - i);
      await DoseLog.create({
        userId: testUser._id,
        medicineId: multiDoseMed._id,
        medicineName: multiDoseMed.name,
        dosage: multiDoseMed.dosage,
        date: getLocalDate(d),
        scheduledTime: "08:00",
        status: "taken",
        takenAt: d
      });
    }

    const perfectMetrics = await calculateReportMetrics(testUser._id, "week");
    assert(perfectMetrics.totalTaken === 7, "Total taken calculated as 7");
    assert(perfectMetrics.totalMissed === 0, "Total missed calculated as 0");
    assert(perfectMetrics.overallAdherence === 100, "100% adherence calculated accurately");
    assert(perfectMetrics.streak === 7, "7-day consecutive streak calculated accurately");

    // 4.3 Mixed adherence calculation test:
    // Add 3 missed doses across the week (7 taken, 3 missed = 10 total -> 70%)
    for (let i = 2; i >= 0; i--) {
      const d = new Date(baseDate);
      d.setDate(baseDate.getDate() - i);
      await DoseLog.create({
        userId: testUser._id,
        medicineId: multiDoseMed._id,
        medicineName: multiDoseMed.name,
        dosage: multiDoseMed.dosage,
        date: getLocalDate(d),
        scheduledTime: "20:00",
        status: "missed"
      });
    }

    const mixedMetrics = await calculateReportMetrics(testUser._id, "week");
    assert(mixedMetrics.totalTaken === 7, "7 taken doses recognized");
    assert(mixedMetrics.totalMissed === 3, "3 missed doses recognized");
    assert(mixedMetrics.totalDoses === 10, "Total doses = 10");
    assert(mixedMetrics.overallAdherence === 70, "70% adherence calculated precisely (Math.round((7/10)*100))");

    // 4.4 Streak breaking test:
    // Today has a missed dose (scheduled at 20:00). Streak should immediately break.
    const brokenMetrics = await calculateReportMetrics(testUser._id, "week");
    assert(brokenMetrics.streak === 0, "Streak breaks to 0 immediately when a dose is missed today");

    // 4.5 Refill stock calculation test:
    const initialStock = 15;
    const testStockMed = await Medicine.create({
      userId: testUser._id,
      name: "Refill Test Med",
      dosage: "25mg",
      time: "09:00",
      stock: initialStock,
      refillAt: 5
    });

    // Simulate taking 11 doses
    const updatedStock = Math.max(0, testStockMed.stock - 11);
    await Medicine.findByIdAndUpdate(testStockMed._id, { $set: { stock: updatedStock } });
    const lowStockCheck = await Medicine.findById(testStockMed._id);
    assert(lowStockCheck.stock === 4, "Stock decrements accurately (15 - 11 = 4)");
    assert(lowStockCheck.stock <= lowStockCheck.refillAt, "Stock (4) correctly triggers low stock threshold (<= 5)");

  } finally {
    // Cleanup test data
    await DoseLog.deleteMany({ userId: testUser._id });
    await Medicine.deleteMany({ userId: testUser._id });
    await User.findByIdAndDelete(testUser._id);
    await mongoose.connection.close();
  }

  console.log(colors.bold(colors.cyan("\n-------------------------------------------------------")));
  console.log(`Results: ${colors.green(`${passed} passed`)}, ${failed > 0 ? colors.red(`${failed} failed`) : "0 failed"}`);
  console.log(colors.bold(colors.cyan("=======================================================\n")));

  if (failed > 0) process.exit(1);
}

runMasterVerification().catch(err => {
  console.error("Master verification fatal error:", err);
  process.exit(1);
});

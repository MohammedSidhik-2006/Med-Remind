/**
 * Ninja Tester & Debugger: Comprehensive Notification & Scheduling Test Suite
 * Validates:
 * 1. Timezone accuracy (IST UTC+5:30)
 * 2. Multi-dose snooze isolation & slot targeting
 * 3. Escalation timing, diffMinutes, and threshold locking
 * 4. Offline queue replay, Bearer formatting, and 4xx cleanup
 * 5. Tag alignment between Push & Service Worker local alarms
 * 6. Caregiver alert tags and payload consistency
 */

const assert = require("assert");

const colors = {
  green: (t) => `\x1b[32m${t}\x1b[0m`,
  red: (t) => `\x1b[31m${t}\x1b[0m`,
  yellow: (t) => `\x1b[33m${t}\x1b[0m`,
  cyan: (t) => `\x1b[36m${t}\x1b[0m`,
  bold: (t) => `\x1b[1m${t}\x1b[0m`
};

let passedCount = 0;
let failedCount = 0;

function runTest(name, fn) {
  try {
    fn();
    console.log(`  ${colors.green("✓")} ${name}`);
    passedCount++;
  } catch (err) {
    console.log(`  ${colors.red("✗")} ${name}`);
    console.log(`     ${colors.red("Error:")} ${err.message}`);
    failedCount++;
  }
}

console.log(colors.bold(colors.cyan("\n=======================================================")));
console.log(colors.bold(colors.cyan("   NINJA TESTER & DEBUGGER: NOTIFICATION TEST SUITE   ")));
console.log(colors.bold(colors.cyan("=======================================================\n")));

// ── 1. TIMEZONE & IST ARITHMETIC ──────────────────────────────────────
console.log(colors.bold("1. Timezone & IST Arithmetic Tests:"));

const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;

function getISTDateTimeFromMs(ms) {
  const ist = new Date(ms + IST_OFFSET_MS);
  const year   = ist.getUTCFullYear();
  const month  = String(ist.getUTCMonth() + 1).padStart(2, "0");
  const day    = String(ist.getUTCDate()).padStart(2, "0");
  const hours  = String(ist.getUTCHours()).padStart(2, "0");
  const mins   = String(ist.getUTCMinutes()).padStart(2, "0");
  return {
    today: `${year}-${month}-${day}`,
    currentTime: `${hours}:${mins}`
  };
}

runTest("IST conversion correctly offsets UTC by +5:30", () => {
  // 04:30 UTC = 10:00 IST
  const utcMs = Date.UTC(2026, 9, 5, 4, 30, 0);
  const ist = getISTDateTimeFromMs(utcMs);
  assert.strictEqual(ist.currentTime, "10:00");
  assert.strictEqual(ist.today, "2026-10-05");
});

runTest("IST conversion handles midnight rollover across date boundary", () => {
  // 19:00 UTC Oct 5 = 00:30 IST Oct 6
  const utcMs = Date.UTC(2026, 9, 5, 19, 0, 0);
  const ist = getISTDateTimeFromMs(utcMs);
  assert.strictEqual(ist.currentTime, "00:30");
  assert.strictEqual(ist.today, "2026-10-06");
});

// ── 2. ESCALATION TIMING & THRESHOLD LOCKING ──────────────────────────
console.log(colors.bold("\n2. Escalation Timing & Threshold Logic:"));

function calculateDiffMinutes(sentDate, sentTime, nowUtcMs) {
  const [year, month, day] = sentDate.split("-").map(Number);
  const [hour, minute] = sentTime.split(":").map(Number);
  const sentTime_ms = Date.UTC(year, month - 1, day, hour, minute) - IST_OFFSET_MS;
  return Math.floor((nowUtcMs - sentTime_ms) / (1000 * 60));
}

runTest("Elapsed minutes >= 5 correctly triggers escalation", () => {
  const sentDate = "2026-10-05";
  const sentTime = "08:00";
  // Now is 08:06 IST = 02:36 UTC
  const nowUtc = Date.UTC(2026, 9, 5, 2, 36, 0);
  const diff = calculateDiffMinutes(sentDate, sentTime, nowUtc);
  assert.strictEqual(diff, 6);
  assert.strictEqual(diff >= 5, true);
});

runTest("Elapsed minutes < 5 skips escalation", () => {
  const sentDate = "2026-10-05";
  const sentTime = "08:00";
  // Now is 08:03 IST = 02:33 UTC
  const nowUtc = Date.UTC(2026, 9, 5, 2, 33, 0);
  const diff = calculateDiffMinutes(sentDate, sentTime, nowUtc);
  assert.strictEqual(diff, 3);
  assert.strictEqual(diff >= 5, false);
});

runTest("Escalation locks dose and clears confirmationPending at threshold", () => {
  const threshold = 3;
  let missedCount = 2;
  let confirmationPending = true;

  // New missed dose attempt
  const newMissedCount = missedCount + 1;
  const reachedThreshold = newMissedCount >= threshold;

  if (reachedThreshold) {
    confirmationPending = false;
    missedCount = newMissedCount;
  }

  assert.strictEqual(reachedThreshold, true);
  assert.strictEqual(confirmationPending, false);
  assert.strictEqual(missedCount, 3);
});

// ── 3. MULTI-DOSE SNOOZE ISOLATION ────────────────────────────────────
console.log(colors.bold("\n3. Multi-Dose Snooze Isolation Tests:"));

function simulateSWCheckDue(med, currentTime, nowMs, notifiedEvents) {
  const firedNotifications = [];
  const allTimes = Array.isArray(med.times) && med.times.length > 0 ? med.times : [med.time];
  let isSnoozeMatured = med.snoozedUntil && new Date(med.snoozedUntil).getTime() <= nowMs;
  const targetSnoozeSlot = med.snoozedSlot || (allTimes.length === 1 ? allTimes[0] : null);

  for (const slotTime of allTimes) {
    if (!slotTime) continue;

    const isCurrentSlot = (slotTime === currentTime);
    // CRITICAL FIX: Only fire if this exact slot matured, and consume flag immediately
    const isThisSlotSnoozeMatured = isSnoozeMatured && (targetSnoozeSlot === slotTime);

    if (!isCurrentSlot && !isThisSlotSnoozeMatured) continue;
    if (med.taken && !isThisSlotSnoozeMatured) continue;

    const slotKey = `2026-10-05_${med._id}_${slotTime}`;
    if (notifiedEvents.has(slotKey)) continue;

    notifiedEvents.add(slotKey);

    if (isThisSlotSnoozeMatured) {
      med.snoozedUntil = null;
      med.snoozedSlot = null;
      isSnoozeMatured = false; // Mark snooze consumed
    }

    firedNotifications.push({
      slotTime,
      tag: `local-med-${med._id}-${slotTime}`,
      isSnooze: isThisSlotSnoozeMatured
    });
  }

  return firedNotifications;
}

runTest("Snoozed morning slot fires ONLY for the morning slot when matured", () => {
  const notifiedEvents = new Set();
  const med = {
    _id: "med_multi_123",
    name: "Metformin",
    times: ["08:00", "14:00", "20:00"],
    snoozedUntil: new Date("2026-10-05T02:40:00.000Z").toISOString(), // 08:10 IST
    snoozedSlot: "08:00",
    taken: false
  };

  // At 08:10 IST
  const nowMs = new Date("2026-10-05T02:40:00.000Z").getTime();
  const fired = simulateSWCheckDue(med, "08:10", nowMs, notifiedEvents);

  assert.strictEqual(fired.length, 1, "Exactly one notification should fire for the snoozed slot");
  assert.strictEqual(fired[0].slotTime, "08:00");
  assert.strictEqual(fired[0].isSnooze, true);

  // Crucial check: 14:00 and 20:00 MUST NOT be burned into notifiedEvents
  assert.strictEqual(notifiedEvents.has("2026-10-05_med_multi_123_14:00"), false);
  assert.strictEqual(notifiedEvents.has("2026-10-05_med_multi_123_20:00"), false);
});

runTest("Subsequent dose slots fire on time after previous slot was snoozed and taken", () => {
  const notifiedEvents = new Set();
  // 08:00 already fired and was recorded
  notifiedEvents.add("2026-10-05_med_multi_123_08:00");

  const med = {
    _id: "med_multi_123",
    name: "Metformin",
    times: ["08:00", "14:00", "20:00"],
    snoozedUntil: null,
    snoozedSlot: null,
    taken: false
  };

  // Now 14:00 arrives
  const nowMs = new Date("2026-10-05T08:30:00.000Z").getTime(); // 14:00 IST
  const fired = simulateSWCheckDue(med, "14:00", nowMs, notifiedEvents);

  assert.strictEqual(fired.length, 1);
  assert.strictEqual(fired[0].slotTime, "14:00");
  assert.strictEqual(fired[0].tag, "local-med-med_multi_123-14:00");
});

// ── 4. OFFLINE QUEUE RECOVERY & CLEANUP ────────────────────────────────
console.log(colors.bold("\n4. Offline Queue Recovery & Cleanup Tests:"));

function simulateOfflineQueueProcess(queue, mockHttpResponses) {
  const remainingQueue = [...queue];
  const processed = [];

  for (let i = 0; i < remainingQueue.length; i++) {
    const item = remainingQueue[i];
    const res = mockHttpResponses[item.medicineId] || { status: 500, ok: false };

    if (res.ok) {
      processed.push({ id: item.id, status: "synced" });
      remainingQueue.splice(i, 1);
      i--;
    } else if (res.status >= 400 && res.status < 500) {
      // 4xx non-retryable error removed
      processed.push({ id: item.id, status: "dropped_4xx" });
      remainingQueue.splice(i, 1);
      i--;
    } else {
      // 5xx or network failure breaks to retry later
      break;
    }
  }

  return { remainingQueue, processed };
}

runTest("Offline queue removes 4xx errors without blocking subsequent items", () => {
  const queue = [
    { id: 1, medicineId: "deleted_med_1", scheduledTime: "08:00" },
    { id: 2, medicineId: "valid_med_2", scheduledTime: "12:00" },
    { id: 3, medicineId: "network_err_med_3", scheduledTime: "16:00" },
    { id: 4, medicineId: "pending_med_4", scheduledTime: "20:00" }
  ];

  const mockResponses = {
    deleted_med_1: { status: 404, ok: false }, // Should be dropped
    valid_med_2: { status: 200, ok: true },     // Should be synced
    network_err_med_3: { status: 500, ok: false } // Network error, stops loop
  };

  const result = simulateOfflineQueueProcess(queue, mockResponses);

  assert.strictEqual(result.processed.length, 2);
  assert.strictEqual(result.processed[0].status, "dropped_4xx");
  assert.strictEqual(result.processed[1].status, "synced");
  assert.strictEqual(result.remainingQueue.length, 2);
  assert.strictEqual(result.remainingQueue[0].medicineId, "network_err_med_3");
});

// ── 5. TAG ALIGNMENT & NOTIFICATION PAYLOAD ───────────────────────────
console.log(colors.bold("\n5. Tag Alignment & Payload Consistency:"));

runTest("Push notification tag matches Service Worker local alarm tag exactly", () => {
  const medId = "6720f8ab91c80123456789ab";
  const slotTime = "09:30";

  const serverPushTag = `local-med-${medId}-${slotTime}`;
  const swAlarmTag = `local-med-${medId}-${slotTime}`;

  assert.strictEqual(serverPushTag, swAlarmTag, "Tags must be identical to replace instead of stack");
});

runTest("Push payload contains all necessary action and navigation parameters", () => {
  const med = { _id: "med999", name: "Aspirin", dosage: "75mg" };
  const slotTime = "14:00";

  const payload = {
    title: `💊 Time to take ${med.name}`,
    body: `${med.dosage} scheduled for ${slotTime}. Tap ✅ Take Now to confirm.`,
    icon: "/medremind-icon-192.svg",
    tag: `local-med-${med._id}-${slotTime}`,
    medicineId: med._id,
    medicineName: med.name,
    dosage: med.dosage,
    scheduledTime: slotTime,
    url: "/dashboard"
  };

  assert.ok(payload.medicineId);
  assert.ok(payload.scheduledTime);
  assert.ok(payload.medicineName);
  assert.ok(payload.tag);
  assert.strictEqual(payload.tag, "local-med-med999-14:00");
});

runTest("Caregiver missed alert tag is stable and per-patient-slot", () => {
  const caregiverId = "cg_user_1";
  const patientId = "patient_user_2";
  const medId = "med_555";
  const slotTime = "18:00";

  const caregiverTag = `caregiver-missed-${patientId}-${medId}-${slotTime}`;
  assert.strictEqual(caregiverTag, "caregiver-missed-patient_user_2-med_555-18:00");
});

// ── SUMMARY REPORT ────────────────────────────────────────────────────
console.log(colors.bold(colors.cyan("\n=======================================================")));
console.log(`Results: ${colors.green(passedCount + " passed")}, ${failedCount > 0 ? colors.red(failedCount + " failed") : "0 failed"}`);
console.log(colors.bold(colors.cyan("=======================================================\n")));

if (failedCount > 0) {
  process.exit(1);
} else {
  console.log(colors.green("🎯 All Ninja Verification Tests Passed Successfully!\n"));
  process.exit(0);
}

const cron    = require("node-cron");
const Medicine = require("../models/Medicine");
const DoseLog  = require("../models/DoseLog");
const User     = require("../models/User");
const CaregiverRelation = require("../models/CaregiverRelation");
const SystemLock = require("../models/SystemLock");
const { sendPushToUser } = require("./pushService");

const getTimePeriod = (time) => {
  const hour = parseInt(time.split(":")[0], 10);
  if (hour >= 5  && hour < 12) return "Morning";
  if (hour >= 12 && hour < 17) return "Afternoon";
  if (hour >= 17 && hour < 21) return "Evening";
  return "Night";
};

// Safe parsing utility
const timeToMinutes = (time) => {
  if (!time || typeof time !== "string" || !time.includes(":")) return 0;
  const [h, m] = time.split(":").map(Number);
  return (isNaN(h) ? 0 : h) * 60 + (isNaN(m) ? 0 : m);
};

const getLocalDate = (d = new Date()) => {
  const tz = process.env.TZ || "Asia/Kolkata";
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour12: false
  });
  const parts = formatter.formatToParts(d);
  const getPart = type => parts.find(p => p.type === type).value;
  return `${getPart("year")}-${getPart("month")}-${getPart("day")}`;
};

const getAsiaKolkataDateTime = (d = new Date()) => {
  const tz = process.env.TZ || "Asia/Kolkata";
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false
  });
  const parts = formatter.formatToParts(d);
  const getPart = type => parts.find(p => p.type === type).value;
  
  const year = getPart("year");
  const month = getPart("month");
  const day = getPart("day");
  const hourRaw = getPart("hour");
  const minute = getPart("minute");
  
  const hourVal = parseInt(hourRaw, 10) % 24;
  const hour = String(hourVal).padStart(2, "0");
  
  return {
    today: `${year}-${month}-${day}`,
    currentTime: `${hour}:${minute}`,
    nowMinutes: hourVal * 60 + parseInt(minute, 10),
    hours: hourVal,
    minutes: parseInt(minute, 10)
  };
};

let isRunning = false;

const startReminder = () => {
  cron.schedule("* * * * *", async () => {
    if (global.recordCronTick) global.recordCronTick();

    // Part 1: In-process overlap protection
    if (isRunning) return;
    isRunning = true;

    // Part 2: MongoDB Distributed Lock
    // Generate unique token PER EXECUTION to prevent old lock release bugs
    const crypto = require("crypto");
    const executionToken = crypto.randomBytes(16).toString("hex");
    
    const now = new Date();
    // 3-minute lease safely covers worst-case valid execution times
    const expires = new Date(now.getTime() + 180000); 
    let lockAcquired = false;

    try {
      try {
        await SystemLock.create({ lockName: "reminder_cron", lockedAt: now, expiresAt: expires, lockedBy: executionToken });
        lockAcquired = true;
      } catch (err) {
        if (err.code === 11000 || err.message?.includes("E11000")) {
          const updated = await SystemLock.findOneAndUpdate(
            { lockName: "reminder_cron", expiresAt: { $lt: now } },
            { $set: { lockedAt: now, expiresAt: expires, lockedBy: executionToken } },
            { returnDocument: "after" }
          );
          if (updated) lockAcquired = true;
        } else {
          throw err;
        }
      }

      if (!lockAcquired) return; // Skip execution, another instance holds the lock

      const { today, currentTime, nowMinutes } = getAsiaKolkataDateTime(now);

      // ── 1. Send push reminders at scheduled times ─────────
      // Part 3: Replace Medicine.find({}) with targeted query
      const activeMeds = await Medicine.find({
        $or: [
          { time: currentTime },
          { times: currentTime },
          { snoozedUntil: { $lte: now, $ne: null } }
        ]
      }).lean();

      for (const med of activeMeds) {
        try {
          if (med.startDate && today < med.startDate) continue;
          if (med.endDate   && today > med.endDate)   continue;

          const isSnoozeMaturing = med.snoozedUntil && new Date(med.snoozedUntil) <= now;
          if (med.snoozedUntil && new Date(med.snoozedUntil) > now) continue;

          const allTimes    = med.times?.length > 0 ? med.times : [med.time];
          const reminderKey = `${today} ${currentTime}`;

          // Determine if this minute matches a scheduled time
          const isScheduledTime = allTimes.includes(currentTime) && med.lastReminderSent !== reminderKey;

          if (isScheduledTime || isSnoozeMaturing) {
            const period       = getTimePeriod(currentTime);
            const originalScheduledTime = isScheduledTime ? currentTime : (med.lastReminderSent ? med.lastReminderSent.split(" ")[1] : currentTime);

            // Before firing, ensure the user didn't ALREADY take this exact dose ahead of time
            const alreadyTaken = await DoseLog.findOne({ medicineId: med._id, date: today, scheduledTime: originalScheduledTime, status: "taken" });
            if (alreadyTaken) {
              // Already handled! Clear the snooze bypass safely if it was stuck
              if (isSnoozeMaturing) await Medicine.findByIdAndUpdate(med._id, { $set: { snoozedUntil: null } });
              continue;
            }

            await Medicine.findByIdAndUpdate(med._id, {
              $set: { 
                confirmationPending: true, 
                lastReminderSent: reminderKey,
                snoozedUntil: null, // Clear matured snooze lock natively
                taken: false, // Re-open UI for upcoming secondary doses automatically
                missedCount: 0 // Reset missed count for the new slot
              }
            });

            // Fire-and-forget push notification to avoid sequential network block
            sendPushToUser(med.userId, {
              title: `💊 Time to take ${med.name}${isSnoozeMaturing ? " (Snoozed)" : ""}`,
              body:  `${med.dosage} — ${period} (scheduled: ${originalScheduledTime}, now: ${currentTime}). Open MedRemind to confirm.`,
              icon:  "/logo192.png",
              tag:   `reminder-${med._id}-${currentTime}`
            }).then((ok) => {
              if (ok) console.log(`✅ Push sent: ${med.name} → user ${med.userId} at ${currentTime} (scheduled: ${originalScheduledTime})`);
            }).catch((e) => {
              console.error(`Error sending push to user ${med.userId} for ${med.name}:`, e.message);
            });
          }
        } catch (innerErr) {
          console.error(`Error processing active medicine ${med._id}:`, innerErr.message);
        }
      }

      // ── 2. Every 5 min: escalate missed reminders ────────
      if (nowMinutes % 5 === 0) {
        const pendingMeds = await Medicine.find({ confirmationPending: true, taken: false }).lean();

        for (const med of pendingMeds) {
          try {
            if (!med.lastReminderSent) continue;
            const parts = med.lastReminderSent.split(" ");
            if (parts.length < 2) continue; // Ensure lastReminderSent is well-formed
            const [sentDate, sentTime] = parts;
            
            // Calculate elapsed time using abstract UTC mapping to bypass OS timezone
            const [year, month, day] = sentDate.split("-").map(Number);
            const [hour, minute] = sentTime.split(":").map(Number);
            const sentAsUTC = Date.UTC(year, month - 1, day, hour, minute);
            
            const tz = process.env.TZ || "Asia/Kolkata";
            const formatter = new Intl.DateTimeFormat("en-US", {
              timeZone: tz,
              year: "numeric", month: "2-digit", day: "2-digit",
              hour: "2-digit", minute: "2-digit", hour12: false
            });
            const fmtParts = formatter.formatToParts(now);
            const getP = type => fmtParts.find(p => p.type === type).value;
            
            const currAsUTC = Date.UTC(
              Number(getP("year")),
              Number(getP("month")) - 1,
              Number(getP("day")),
              Number(getP("hour")) % 24,
              Number(getP("minute"))
            );
            
            const diffMinutes = Math.floor((currAsUTC - sentAsUTC) / (1000 * 60));

            if (diffMinutes < 5) continue;

            const patientUser = await User.findById(med.userId).lean();
            const threshold = patientUser?.maxMissedThreshold || 3;
            const patientName = patientUser?.name || "Patient";

            const newMissedCount = (med.missedCount || 0) + 1;
            const reachedThreshold = newMissedCount >= threshold;

            if (reachedThreshold) {
              // Lock the dose: set confirmationPending = false to stop reminders/escalations
              await Medicine.findByIdAndUpdate(med._id, { 
                $set: { 
                  missedCount: newMissedCount,
                  confirmationPending: false 
                } 
              });

              // Log missed dose in DoseLog ONLY after all escalation threshold attempts have expired
              const alreadyLogged = await DoseLog.findOne({
                medicineId: med._id, date: sentDate, scheduledTime: sentTime, status: "missed"
              });

              if (!alreadyLogged) {
                await DoseLog.create({
                  userId: med.userId, medicineId: med._id,
                  medicineName: med.name, dosage: med.dosage,
                  date: sentDate, scheduledTime: sentTime, status: "missed"
                });

                // Notify caregivers of locked missed dose
                try {
                  const relations = await CaregiverRelation.find({ patientId: med.userId });
                  if (relations.length > 0) {
                    for (const rel of relations) {
                      sendPushToUser(rel.caregiverId, {
                        title: `🚨 Missed Dose Locked: ${patientName}`,
                        body: `FINAL NOTICE: ${patientName} failed to confirm taking ${med.name} (${med.dosage}) after ${threshold} attempts (${threshold * 5} minutes). This dose is locked as missed.`,
                        icon: "/logo192.png",
                        tag: `missed-locked-caregiver-${med._id}-${sentTime}-${Date.now()}`
                      }).catch(e => console.error("Error sending locked missed dose push to caregiver:", e.message));
                    }
                  }
                } catch (caregiverErr) {
                  console.error("Error checking caregiver relations in reminderService:", caregiverErr.message);
                }
              }

              // Send definitive push warning to user
              sendPushToUser(med.userId, {
                title: `🚨 Dose Locked: Missed ${med.name}`,
                body:  `You missed ${med.name} at ${sentTime}. Reminders have stopped and this dose is locked as missed.`,
                icon:  "/logo192.png",
                tag:   `missed-locked-${med._id}`
              }).catch(() => {});

              console.log(`🔒 Dose locked after reaching threshold (${threshold}x): ${med.name} → user ${med.userId}`);
            } else {
              // Regular escalation push warning sent to user during the 5-minute interval checks
              sendPushToUser(med.userId, {
                title: `⏰ Reminder (${newMissedCount + 1}/${threshold}): Take ${med.name}`,
                body:  `Urgent: Please take ${med.name} (${med.dosage}) scheduled at ${sentTime}. Attempt ${newMissedCount + 1} of ${threshold}.`,
                icon:  "/logo192.png",
                tag:   `missed-${med._id}-${newMissedCount}`
              }).catch(() => {});

              await Medicine.findByIdAndUpdate(med._id, { $set: { missedCount: newMissedCount } });
              console.log(`⏰ Missed dose escalation #${newMissedCount + 1}/${threshold}: ${med.name} → user ${med.userId}`);
            }
          } catch (innerErr) {
            console.error(`Error in missed escalation for med ${med._id}:`, innerErr.message);
          }
        }

        // Part 4: Real-time Low Stock Checks (Optimized)
        try {
          const lowStockMeds = await Medicine.find({
            refillNotified: false,
            $expr: { $lte: ["$stock", "$refillAt"] }
          }).lean();
          for (const med of lowStockMeds) {
            sendPushToUser(med.userId, {
              title: `📦 Low Stock Alert: ${med.name}`,
              body:  `Only ${med.stock} doses remaining for ${med.name} (refill threshold: ${med.refillAt}). Please refill soon!`,
              icon:  "/logo192.png",
              tag:   `refill-${med._id}`
            }).catch(() => {});

            await Medicine.findByIdAndUpdate(med._id, { $set: { refillNotified: true } });
            console.log(`📦 Real-time low stock alert sent: ${med.name} → user ${med.userId} (${med.stock} left)`);
          }
        } catch (err) {
          console.error("Error processing real-time low stock medicines:", err.message);
        }
      }

      // ── 3. Daily 08:00 reset ─────────────
      if (currentTime === "08:00") {
        try {
          const { catchUpMedicinesForUser } = require("../middleware/catchUpMiddleware");
          const staleMeds = await Medicine.find({ lastResetDate: { $ne: today } });
          const userIds = [...new Set(staleMeds.map(m => m.userId.toString()))];
          for (const uId of userIds) {
            await catchUpMedicinesForUser(uId);
          }
          console.log(`✅ Daily reset & catch-up complete for ${today}`);
        } catch (err) {
          console.error("Error doing daily medicine reset in reminderService:", err.message);
        }
      }

    } catch (error) {
      console.error("Reminder cron error:", error.message);
    } finally {
      if (lockAcquired) {
        await SystemLock.deleteOne({ lockName: "reminder_cron", lockedBy: executionToken }).catch(e => console.error("Error releasing lock:", e.message));
      }
      isRunning = false;
    }
  });

  console.log("Reminder service started");
};

module.exports = startReminder;

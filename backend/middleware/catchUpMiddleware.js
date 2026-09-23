const Medicine = require("../models/Medicine");
const DoseLog = require("../models/DoseLog");

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

const catchUpMedicinesForUser = async (userId) => {
  const today = getLocalDate();
  const stale = await Medicine.find({ userId, lastResetDate: { $ne: today } });

  if (stale.length === 0) return;

  const minDate = stale.reduce((min, med) => {
    if (!med.lastResetDate) return min;
    if (!min) return med.lastResetDate;
    return med.lastResetDate < min ? med.lastResetDate : min;
  }, null);

  if (minDate) {
    // Fetch ALL logs regardless of status — the unique index is on (medicineId, date, scheduledTime)
    // so a 'taken' log already occupies the slot and we must NOT insert a 'missed' log for it.
    const existingLogs = await DoseLog.find({
      userId,
      date: { $gte: minDate, $lt: today }
    }).select("medicineId date scheduledTime status").lean();

    const existingSet = new Set(
      existingLogs.map(l => `${l.medicineId.toString()}_${l.date}_${l.scheduledTime}`)
    );

    const logsToInsert = [];

    for (const med of stale) {
      if (!med.lastResetDate) continue;

      const [y, m, dayVal] = med.lastResetDate.split("-").map(Number);
      let checkDate = new Date(Date.UTC(y, m - 1, dayVal));
      
      const formatDate = (dateObj) => {
        const yr = dateObj.getUTCFullYear();
        const mon = String(dateObj.getUTCMonth() + 1).padStart(2, "0");
        const dy = String(dateObj.getUTCDate()).padStart(2, "0");
        return `${yr}-${mon}-${dy}`;
      };

      let loopCount = 0;
      // Loop day-by-day up to yesterday
      while (formatDate(checkDate) < today && loopCount < 365) {
        loopCount++;
        const checkDateStr = formatDate(checkDate);
        const isStartOk = !med.startDate || checkDateStr >= med.startDate;
        const isEndOk = !med.endDate || checkDateStr <= med.endDate;

        if (isStartOk && isEndOk) {
          const allTimes = med.times && med.times.length > 0 ? med.times : [med.time];
          for (const t of allTimes) {
            const key = `${med._id.toString()}_${checkDateStr}_${t}`;
            if (!existingSet.has(key)) {
              logsToInsert.push({
                userId: med.userId,
                medicineId: med._id,
                medicineName: med.name,
                dosage: med.dosage,
                date: checkDateStr,
                scheduledTime: t,
                status: "missed"
              });
              existingSet.add(key); // Prevent duplicate pushing
            }
          }
        }
        checkDate.setUTCDate(checkDate.getUTCDate() + 1);
      }
    }

    if (logsToInsert.length > 0) {
      await DoseLog.insertMany(logsToInsert, { ordered: false }).catch(err => {
        if (err.code !== 11000 && !err.message?.includes("E11000")) {
          console.error("Bulk insert error in catchUp:", err.message);
        }
      });
    }
  }

  const staleIds = stale.map(m => m._id);
  await Medicine.updateMany(
    { _id: { $in: staleIds } },
    {
      $set: {
        taken: false,
        takenAt: null,
        confirmationPending: false,
        missedCount: 0,
        lastReminderSent: "",
        snoozedUntil: null,
        snoozeCount: 0,
        lastResetDate: today
      }
    }
  );
};

const catchUpMiddleware = async (req, res, next) => {
  if (req.user && req.user.id) {
    try {
      await catchUpMedicinesForUser(req.user.id);
    } catch (err) {
      console.error("catchUpMiddleware error:", err.message);
    }
  }
  next();
};

module.exports = { catchUpMiddleware, catchUpMedicinesForUser };

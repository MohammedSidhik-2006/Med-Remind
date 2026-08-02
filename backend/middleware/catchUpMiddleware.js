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

  for (const med of stale) {
    if (med.lastResetDate) {
      // Safely parse date elements to avoid UTC timezone offset conversions
      const [y, m, dayVal] = med.lastResetDate.split("-").map(Number);
      let checkDate = new Date(y, m - 1, dayVal);
      
      const formatDate = (dateObj) => {
        const yr = dateObj.getFullYear();
        const mon = String(dateObj.getMonth() + 1).padStart(2, "0");
        const dy = String(dateObj.getDate()).padStart(2, "0");
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
            const exists = await DoseLog.findOne({ medicineId: med._id, date: checkDateStr, scheduledTime: t });
            if (!exists) {
              await DoseLog.create({
                userId: med.userId,
                medicineId: med._id,
                medicineName: med.name,
                dosage: med.dosage,
                date: checkDateStr,
                scheduledTime: t,
                status: "missed"
              });
            }
          }
        }
        checkDate.setDate(checkDate.getDate() + 1);
      }
    }

    // Reset today's medicine fields for a clean start
    await Medicine.findByIdAndUpdate(med._id, {
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
    });
  }
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

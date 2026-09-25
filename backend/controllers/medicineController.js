const mongoose = require("mongoose");
const Medicine = require("../models/Medicine");
const DoseLog  = require("../models/DoseLog");
const AuditLog = require("../models/AuditLog");
const User     = require("../models/User");
const CaregiverRelation = require("../models/CaregiverRelation");
const { sendPushToUser } = require("../services/pushService");

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

exports.addMedicine = async (req, res) => {
  try {
    const { name, dosage, time, times, timePeriods, frequency, startDate, endDate, stock, refillAt, notes } = req.body;

    if (!name || !name.trim()) return res.status(400).json({ message: "Medicine name is required" });
    if (!dosage || !dosage.trim()) return res.status(400).json({ message: "Dosage is required" });

    const resolvedTimes = Array.isArray(times) && times.length > 0 ? times : (time ? [time] : []);
    if (resolvedTimes.length === 0) return res.status(400).json({ message: "At least one time is required" });

    const stockNum  = Number(stock);
    const refillNum = Number(refillAt);
    if (isNaN(stockNum)  || stockNum  < 0) return res.status(400).json({ message: "Invalid stock value" });
    if (isNaN(refillNum) || refillNum < 0) return res.status(400).json({ message: "Invalid refill threshold" });

    const medicine = await Medicine.create({
      userId: req.user.id,
      name: name.trim(),
      dosage: dosage.trim(),
      time: resolvedTimes[0],
      times: resolvedTimes,
      timePeriods: Array.isArray(timePeriods) ? timePeriods : [],
      frequency: frequency || "once",
      startDate: startDate || new Date().toISOString().slice(0, 10),
      endDate: endDate || "",
      stock: stockNum,
      refillAt: refillNum,
      notes: (notes || "").trim()
    });

    User.findById(req.user.id).select("email").then(u => {
      AuditLog.create({ userId: req.user.id, userEmail: u?.email || "", action: "medicine_added", details: `Added: ${medicine.name} (${medicine.dosage})` }).catch(() => {});
    }).catch(() => {});

    res.status(201).json({ message: "Medicine added successfully", medicine });
  } catch (error) {
    console.error("addMedicine:", error.message);
    res.status(500).json({ message: "Server error" });
  }
};

exports.getMedicines = async (req, res) => {
  try {
    const today = getLocalDate();

    const user = await User.findById(req.user.id).select("maxMissedThreshold").lean();
    const maxMissedThreshold = user?.maxMissedThreshold || 3;

    const medicines = await Medicine.find({ userId: req.user.id }).sort({ createdAt: 1 }).lean();
    const todayLogs = await DoseLog.find({ userId: req.user.id, date: today }).lean();
    
    // Natively calculate taken doses directly for precise Fractional Daily Progress Ring updates
    const augMeds = await Promise.all(medicines.map(async (med) => {
      const takenCount = todayLogs.filter(l => l.medicineId.toString() === med._id.toString() && l.status === "taken").length;
      const medLogs = todayLogs.filter(l => l.medicineId.toString() === med._id.toString());
      return { ...med, takenTodayCount: takenCount, maxMissedThreshold, todayLogs: medLogs };
    }));

    res.json(augMeds);
  } catch (error) {
    console.error("getMedicines:", error.message);
    res.status(500).json({ message: "Server error" });
  }
};

exports.deleteMedicine = async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id))
      return res.status(400).json({ message: "Invalid medicine ID" });

    const med = await Medicine.findOne({ _id: req.params.id, userId: req.user.id });
    if (!med) return res.status(404).json({ message: "Medicine not found" });

    // Delete the medicine
    await Medicine.findByIdAndDelete(req.params.id);

    // CASCADE: Delete all associated DoseLog entries to prevent orphaned records
    await DoseLog.deleteMany({ medicineId: req.params.id });

    User.findById(req.user.id).select("email").then(u => {
      AuditLog.create({ userId: req.user.id, userEmail: u?.email || "", action: "medicine_deleted", details: `Deleted: ${med.name} (and ${med._id} dose history)` }).catch(() => {});
    }).catch(() => {});

    res.json({ message: "Medicine deleted successfully" });
  } catch (error) {
    console.error("deleteMedicine:", error.message);
    res.status(500).json({ message: "Server error" });
  }
};

exports.markTaken = async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id))
      return res.status(400).json({ message: "Invalid medicine ID" });

    const medicine = await Medicine.findOne({ _id: req.params.id, userId: req.user.id });
    if (!medicine) return res.status(404).json({ message: "Medicine not found" });
    // NOTE: Do NOT add an early-return on medicine.taken here.
    // medicine.taken=true only means ALL slots for today are done.
    // For multi-dose medicines, this guard would block the 2nd/3rd slot from being recorded.

    const today         = getLocalDate();
    const allTimes      = medicine.times?.length > 0 ? medicine.times : [medicine.time];

    // Find already taken times for today to decide which dose we are recording
    const takenLogs     = await DoseLog.find({ medicineId: medicine._id, date: today, status: "taken" }).select("scheduledTime").lean();
    const takenTimes    = takenLogs.map(l => l.scheduledTime);
    const remainingTimes = allTimes.filter(t => !takenTimes.includes(t));

    if (remainingTimes.length === 0) {
      // If all scheduled doses are already taken, prevent additional dose logs
      return res.json(medicine);
    }

    const scheduledTime = req.body.scheduledTime || remainingTimes[0];

    // Evaluate Idempotent collision: If already logged gracefully skip to prevent frontend errors
    const exists = await DoseLog.findOne({ medicineId: medicine._id, date: today, scheduledTime, status: "taken" });
    if (exists) {
      // Safely ensure full array coverage in case it was a UI de-sync
      const allTimes       = medicine.times?.length > 0 ? medicine.times : [medicine.time];
      const takenLogsCount = await DoseLog.countDocuments({ medicineId: medicine._id, date: today, status: "taken" });
      const isFullyTaken   = takenLogsCount >= allTimes.length;
      if (medicine.taken !== isFullyTaken) await Medicine.findByIdAndUpdate(medicine._id, { taken: isFullyTaken });
      return res.json(medicine);
    }

    // FIX FOR BUG-001-RACE: Create DoseLog first (atomic via unique index),
    // then decrement stock only if DoseLog creation succeeds.
    // This ensures: (1) exactly one dose logs per scheduledTime, (2) exactly one stock decrement per successful log.
    let doseLogCreated = false;
    try {
      const pastMissed = await DoseLog.findOne({ medicineId: medicine._id, date: today, scheduledTime, status: "missed" });
      if (pastMissed) {
        pastMissed.status  = "taken";
        pastMissed.takenAt = new Date();
        await pastMissed.save();
      } else {
        await DoseLog.create({ 
          userId: medicine.userId, 
          medicineId: medicine._id, 
          medicineName: medicine.name, 
          dosage: medicine.dosage, 
          date: today, 
          scheduledTime, 
          status: "taken", 
          takenAt: new Date() 
        });
      }
      doseLogCreated = true;
    } catch (err) {
      if (err.code === 11000) {
        console.warn(`Idempotent collision caught for medicine ${medicine._id} scheduledTime ${scheduledTime}`);
        const freshMedicine = await Medicine.findById(medicine._id);
        return res.json(freshMedicine || medicine);
      }
      throw err;
    }

    // Evaluate if ALL doses for this particular day are completed
    const takenLogsCount   = await DoseLog.countDocuments({ medicineId: medicine._id, date: today, status: "taken" });
    const isFullyTaken     = takenLogsCount >= allTimes.length;

    // Determine if refill notification should be sent
    // refillNotified is set to true when stock reaches refillAt threshold
    const currentStock = medicine.stock || 0;
    const shouldNotifyRefill = currentStock > 0 && (currentStock - 1) <= medicine.refillAt && !medicine.refillNotified;

    // FIX FOR BUG-001-RACE: Use atomic $inc operator instead of $set for stock decrement.
    // This ensures concurrent requests atomically decrement stock, preventing race condition.
    // Stock will never become negative due to min: 0 constraint in schema.
    const updated = await Medicine.findByIdAndUpdate(
      req.params.id,
      [
        {
          $set: { 
            taken: isFullyTaken, 
            takenAt: new Date(), 
            confirmationPending: false, 
            snoozedUntil: null, 
            snoozeCount: 0,
            missedCount: 0,
            refillNotified: shouldNotifyRefill ? true : (currentStock - 1 > medicine.refillAt ? false : medicine.refillNotified),
            stock: { $max: [0, { $subtract: [{ $ifNull: ["$stock", 0] }, 1] }] }
          }
        }
      ],
      { returnDocument: "after" }
    );

    // Notify caregivers
    try {
      const relations = await CaregiverRelation.find({ patientId: medicine.userId });
      for (const rel of relations) {
        sendPushToUser(rel.caregiverId, {
          title: `💊 Medicine Taken: ${req.user.name || "Patient"}`,
          body: `${req.user.name || "Patient"} took ${medicine.name} (${medicine.dosage}) at ${new Date().toLocaleTimeString("en-US", { timeZone: process.env.TZ || "Asia/Kolkata", hour12: true, hour: "2-digit", minute: "2-digit" })}.`,
          icon: "/medremind-icon-192.svg",
          // Stable tag per patient+medicine+slot: replaces, doesn't stack on caregiver's phone
          tag: `taken-${medicine.userId}-${medicine._id}-${scheduledTime}`
        }).catch(e => console.error("Error sending push to caregiver:", e.message));
      }
    } catch (caregiverErr) {
      console.error("Error checking caregiver relations in markTaken:", caregiverErr.message);
    }

    // Use the updated medicine from database to get accurate stock for notification
    if (shouldNotifyRefill) {
      sendPushToUser(medicine.userId, {
        title: `📦 Low Stock: ${medicine.name}`,
        body:  `Only ${updated.stock} doses remaining. Please refill soon.`,
        icon:  "/logo192.png",
        tag:   `refill-${medicine._id}`
      }).catch(e => console.error("Error sending immediate refill alert:", e.message));
    }

    res.json(updated);
  } catch (error) {
    console.error("markTaken:", error.message);
    res.status(500).json({ message: "Server error" });
  }
};

exports.snoozeMedicine = async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id))
      return res.status(400).json({ message: "Invalid medicine ID" });

    const minutes = parseInt(req.body.minutes);
    if (isNaN(minutes) || minutes < 1 || minutes > 60)
      return res.status(400).json({ message: "Minutes must be between 1 and 60" });

    const med = await Medicine.findOne({ _id: req.params.id, userId: req.user.id });
    if (!med) return res.status(404).json({ message: "Medicine not found" });

    const newSnoozeCount = (med.snoozeCount || 0) + 1;

    const updated = await Medicine.findByIdAndUpdate(
      req.params.id,
      { 
        $set: { 
          snoozedUntil: new Date(Date.now() + minutes * 60 * 1000), 
          confirmationPending: false,
          snoozeCount: newSnoozeCount
        } 
      },
      { returnDocument: "after" }
    );

    if (newSnoozeCount > 3) {
      try {
        const relations = await CaregiverRelation.find({ patientId: med.userId });
        for (const rel of relations) {
          sendPushToUser(rel.caregiverId, {
            title: `⚠️ Snooze Alert: ${req.user.name || "Patient"}`,
            body: `${req.user.name || "Patient"} has snoozed their medicine ${med.name} (${med.dosage}) ${newSnoozeCount} times consecutively.`,
            icon: "/logo192.png",
            tag: `snooze-warn-${med._id}-${newSnoozeCount}`
          }).catch(e => console.error("Error sending snooze warn to caregiver:", e.message));
        }
      } catch (caregiverErr) {
        console.error("Error checking caregiver relations in snoozeMedicine:", caregiverErr.message);
      }
    }

    res.json(updated);
  } catch (error) {
    console.error("snoozeMedicine:", error.message);
    res.status(500).json({ message: "Server error" });
  }
};

exports.updateStock = async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id))
      return res.status(400).json({ message: "Invalid medicine ID" });

    const stock = parseInt(req.body.stock);
    if (isNaN(stock) || stock < 0)
      return res.status(400).json({ message: "Stock must be a non-negative number" });

    const med = await Medicine.findOne({ _id: req.params.id, userId: req.user.id });
    if (!med) return res.status(404).json({ message: "Medicine not found" });

    const refillThreshold = req.body.refillAt !== undefined && !isNaN(parseInt(req.body.refillAt))
      ? Math.max(0, parseInt(req.body.refillAt))
      : (med.refillAt !== undefined ? med.refillAt : 7);

    const isLow = stock <= refillThreshold;
    const updated = await Medicine.findByIdAndUpdate(
      req.params.id, 
      { $set: { stock, refillAt: refillThreshold, refillNotified: isLow } }, 
      { returnDocument: "after" }
    );

    if (isLow) {
      sendPushToUser(med.userId, {
        title: `📦 Low Stock Alert: ${med.name}`,
        body:  `Only ${stock} doses remaining for ${med.name} (refill threshold: ${med.refillAt}). Please refill soon!`,
        icon:  "/logo192.png",
        tag:   `refill-${med._id}`
      }).catch(e => console.error("Error sending updateStock low stock alert:", e.message));
    }

    res.json(updated);
  } catch (error) {
    console.error("updateStock:", error.message);
    res.status(500).json({ message: "Server error" });
  }
};

exports.resetTaken = async (req, res) => {
  try {
    await Medicine.updateMany({ userId: req.user.id }, { $set: { taken: false, takenAt: null, confirmationPending: false } });
    res.json({ message: "Reset successful" });
  } catch (error) {
    console.error("resetTaken:", error.message);
    res.status(500).json({ message: "Server error" });
  }
};

exports.getReports = async (req, res) => {
  try {
    const days   = req.query.period === "month" ? 30 : 7;
    const userId = req.user.id;

    const end   = new Date();
    const start = new Date();
    start.setDate(end.getDate() - (days - 1));

    const dateRange = [];
    for (let i = 0; i < days; i++) {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      dateRange.push(getLocalDate(d));
    }

    const logs = await DoseLog.find({ userId, date: { $gte: dateRange[0], $lte: dateRange[dateRange.length - 1] } }).lean();

    const dailyMap = {};
    dateRange.forEach(d => { dailyMap[d] = { taken: 0, missed: 0, doseLogs: [] }; });
    logs.forEach(log => {
      if (dailyMap[log.date]) {
        dailyMap[log.date][log.status]++;
        dailyMap[log.date].doseLogs.push({
          medicineName: log.medicineName,
          dosage: log.dosage,
          scheduledTime: log.scheduledTime,
          status: log.status,
          takenAt: log.takenAt
        });
      }
    });

    const dailyData = dateRange.map(date => {
      const { taken, missed, doseLogs } = dailyMap[date];
      const total = taken + missed;
      return { date, taken, missed, total, adherence: total > 0 ? Math.round((taken / total) * 100) : null, doseLogs };
    });

    const totalTaken  = logs.filter(l => l.status === "taken").length;
    const totalMissed = logs.filter(l => l.status === "missed").length;
    const totalDoses  = totalTaken + totalMissed;

    const allLogs = await DoseLog.find({ userId }).sort({ date: -1 }).lean();
    const byDate  = {};
    allLogs.forEach(l => {
      if (!byDate[l.date]) byDate[l.date] = { taken: 0, missed: 0 };
      byDate[l.date][l.status]++;
    });

    let streak    = 0;
    let checkDate = new Date();
    // If today has no taken doses yet (user hasn't had a chance to take them),
    // don't penalise the streak — start checking from yesterday instead.
    const todayStr  = getLocalDate(checkDate);
    const todayData = byDate[todayStr];
    if (!todayData || todayData.taken === 0) {
      checkDate.setDate(checkDate.getDate() - 1);
    }
    for (let i = 0; i < 365; i++) {
      const ds  = getLocalDate(checkDate);
      const day = byDate[ds];
      if (!day || day.taken === 0 || day.missed > 0) break;
      streak++;
      checkDate.setDate(checkDate.getDate() - 1);
    }

    res.json({ dailyData, totalTaken, totalMissed, overallAdherence: totalDoses > 0 ? Math.round((totalTaken / totalDoses) * 100) : 0, streak, period: req.query.period || "week" });
  } catch (error) {
    console.error("getReports:", error.message);
    res.status(500).json({ message: "Server error" });
  }
};

// Return raw dose log entries for the logged-in user (newest first)
exports.getDoseLogs = async (req, res) => {
  try {
    const limit = Math.min(500, parseInt(req.query.limit) || 200);
    const logs = await DoseLog.find({ userId: req.user.id })
      .sort({ date: -1, createdAt: -1 })
      .limit(limit)
      .lean();
    res.json(logs);
  } catch (error) {
    console.error("getDoseLogs:", error.message);
    res.status(500).json({ message: "Server error" });
  }
};

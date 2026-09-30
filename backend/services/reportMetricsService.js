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

/**
 * Calculates factual adherence and dose report statistics for a given user.
 * Single source of truth shared by Reports API and AI Report Insights.
 *
 * @param {string} userId - User's MongoDB ObjectId string
 * @param {string} period - "week" (7 days) or "month" (30 days)
 * @returns {Promise<Object>} Factual reports data
 */
async function calculateReportMetrics(userId, period = "week") {
  const days = period === "month" ? 30 : 7;

  const end = new Date();
  const start = new Date();
  start.setDate(end.getDate() - (days - 1));

  const dateRange = [];
  for (let i = 0; i < days; i++) {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    dateRange.push(getLocalDate(d));
  }

  const logs = await DoseLog.find({
    userId,
    date: { $gte: dateRange[0], $lte: dateRange[dateRange.length - 1] }
  }).lean();

  const dailyMap = {};
  dateRange.forEach(d => {
    dailyMap[d] = { taken: 0, missed: 0, doseLogs: [] };
  });

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
    return {
      date,
      taken,
      missed,
      total,
      adherence: total > 0 ? Math.round((taken / total) * 100) : null,
      doseLogs
    };
  });

  const totalTaken = logs.filter(l => l.status === "taken").length;
  const totalMissed = logs.filter(l => l.status === "missed").length;
  const totalDoses = totalTaken + totalMissed;
  const overallAdherence = totalDoses > 0 ? Math.round((totalTaken / totalDoses) * 100) : 0;

  // Streak calculation: walks backwards up to 365 days
  const allLogs = await DoseLog.find({ userId }).sort({ date: -1 }).lean();
  const byDate = {};
  allLogs.forEach(l => {
    if (!byDate[l.date]) byDate[l.date] = { taken: 0, missed: 0 };
    byDate[l.date][l.status]++;
  });

  let streak = 0;
  let checkDate = new Date();
  const todayStr = getLocalDate(checkDate);
  const todayData = byDate[todayStr];

  // If today has no taken doses yet, don't penalize active streak — start from yesterday
  if (!todayData || todayData.taken === 0) {
    checkDate.setDate(checkDate.getDate() - 1);
  }

  for (let i = 0; i < 365; i++) {
    const ds = getLocalDate(checkDate);
    const day = byDate[ds];
    if (!day || day.taken === 0 || day.missed > 0) break;
    streak++;
    checkDate.setDate(checkDate.getDate() - 1);
  }

  return {
    dailyData,
    totalTaken,
    totalMissed,
    totalDoses,
    overallAdherence,
    streak,
    period: period === "month" ? "month" : "week",
    dateRange,
    rawLogs: logs
  };
}

module.exports = {
  calculateReportMetrics,
  getLocalDate
};

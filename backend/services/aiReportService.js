const { GoogleGenAI } = require("@google/genai");
const { calculateReportMetrics } = require("./reportMetricsService");

const MODEL_CANDIDATES = [
  process.env.GEMINI_MODEL,
  "gemini-3.5-flash-lite",
  "gemini-flash-lite-latest",
  "gemini-flash-latest",
  "gemini-3.8-flash"
].filter(Boolean);

// In-memory cache to prevent quota exhaustion when user repeatedly views or clicks Generate Insights
const insightCache = new Map();
const CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes TTL

/**
 * Resilient multi-model executor: tries high-quota candidates sequentially.
 * Prevents 429 quota exhaustion or single-model outages from failing requests.
 */
async function executeModelCascade(ai, prompt, logTag = "AI Service") {
  let lastError = null;
  for (const model of MODEL_CANDIDATES) {
    try {
      const res = await ai.models.generateContent({
        model,
        contents: prompt,
        config: {
          responseMimeType: "application/json",
          temperature: 0.2
        }
      });
      if (res && res.text) {
        return res.text;
      }
    } catch (err) {
      console.warn(`[${logTag}] Model (${model}) attempt note: ${err.message?.slice(0, 100)}. Falling back to next candidate...`);
      lastError = err;
    }
  }
  console.error(`[${logTag}] All candidate models failed.`);
  const finalErr = new Error(lastError?.message || "Gemini service unavailable");
  finalErr.status = lastError?.status || 503;
  throw finalErr;
}


/**
 * Maps HH:MM time strings into standard day phases
 */
const getTimeOfDayCategory = (timeStr) => {
  if (!timeStr || typeof timeStr !== "string") return "morning";
  const [h] = timeStr.split(":").map(Number);
  if (isNaN(h)) return "morning";
  if (h >= 5 && h < 12) return "morning";
  if (h >= 12 && h < 17) return "afternoon";
  if (h >= 17 && h < 21) return "evening";
  return "night";
};

/**
 * Sanitizes and aggregates raw report metrics into a minimal, privacy-safe AI payload.
 * Strictly excludes user IDs, emails, database internals, and secrets.
 *
 * @param {string} userId
 * @param {string} period - "week" or "month"
 * @returns {Promise<Object>} Factual sanitized payload for Gemini
 */
async function buildAiInsightPayload(userId, period = "week") {
  const metrics = await calculateReportMetrics(userId, period);

  const timeOfDay = {
    morning: { taken: 0, missed: 0 },
    afternoon: { taken: 0, missed: 0 },
    evening: { taken: 0, missed: 0 },
    night: { taken: 0, missed: 0 }
  };

  const medMap = {};

  (metrics.rawLogs || []).forEach(log => {
    // Time-of-day aggregation
    const slot = getTimeOfDayCategory(log.scheduledTime);
    if (timeOfDay[slot] && (log.status === "taken" || log.status === "missed")) {
      timeOfDay[slot][log.status]++;
    }

    // Medication-wise aggregation
    const name = (log.medicineName || "Unknown Medication").trim();
    if (!medMap[name]) {
      medMap[name] = { name, scheduled: 0, taken: 0, missed: 0 };
    }
    medMap[name].scheduled++;
    if (log.status === "taken") medMap[name].taken++;
    if (log.status === "missed") medMap[name].missed++;
  });

  const medications = Object.values(medMap).map(m => ({
    name: m.name,
    scheduled: m.scheduled,
    taken: m.taken,
    missed: m.missed,
    adherence: m.scheduled > 0 ? Math.round((m.taken / m.scheduled) * 100) : 0
  }));

  const activeDays = (metrics.dailyData || []).filter(d => d.total > 0);
  const perfectDaysCount = activeDays.filter(d => d.taken > 0 && d.missed === 0).length;
  const daysWithMissesCount = activeDays.filter(d => d.missed > 0).length;

  return {
    period: period === "month" ? "30-day" : "7-day",
    overallAdherence: metrics.overallAdherence,
    totalTaken: metrics.totalTaken,
    totalMissed: metrics.totalMissed,
    currentStreak: metrics.streak,
    timeOfDay,
    medications,
    trackingOverview: {
      activeTrackingDays: activeDays.length,
      perfectDays: perfectDaysCount,
      daysWithMisses: daysWithMissesCount
    },
    totalDoses: metrics.totalDoses
  };
}

/**
 * Validates and normalizes structured response from Gemini
 */
function validateAndCleanResponse(data) {
  const disclaimerText = "These insights are based on medication tracking data and are not medical advice.";

  if (!data || typeof data !== "object") {
    throw new Error("Invalid response structure from AI model");
  }

  const summary = typeof data.summary === "string" && data.summary.trim().length > 0
    ? data.summary.trim()
    : "Adherence data has been processed for the selected period.";

  const positiveObservation = typeof data.positiveObservation === "string"
    ? data.positiveObservation.trim()
    : "";

  const patterns = Array.isArray(data.patterns)
    ? data.patterns.filter(p => typeof p === "string" && p.trim()).slice(0, 3)
    : [];

  const attentionItems = Array.isArray(data.attentionItems)
    ? data.attentionItems.filter(a => typeof a === "string" && a.trim()).slice(0, 3)
    : [];

  return {
    summary,
    positiveObservation,
    patterns,
    attentionItems,
    disclaimer: disclaimerText
  };
}

/**
 * Generates AI Report Insights using Google Gemini.
 * Gemini serves exclusively as an interpretation layer explaining pre-calculated factual data.
 *
 * @param {string} userId
 * @param {string} period - "week" or "month"
 * @returns {Promise<Object>} Safe structured insight response
 */
async function generateReportInsights(userId, period = "week") {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    const error = new Error("GEMINI_API_KEY is not configured");
    error.code = "MISSING_API_KEY";
    throw error;
  }

  const payload = await buildAiInsightPayload(userId, period);

  // Insufficient data guard: zero scheduled/logged doses
  if (payload.totalDoses === 0 || payload.medications.length === 0) {
    return {
      summary: "No medication tracking activity was recorded for this period.",
      positiveObservation: "",
      patterns: [],
      attentionItems: [
        "Start logging your scheduled medications on the dashboard to unlock personalized adherence insights."
      ],
      disclaimer: "These insights are based on medication tracking data and are not medical advice.",
      isInsufficientData: true
    };
  }

  const cacheKey = `report:${userId}:${period}:${payload.totalDoses}:${payload.overallAdherence}:${payload.currentStreak}`;
  const cached = insightCache.get(cacheKey);
  if (cached && Date.now() < cached.expiresAt) {
    return cached.data;
  }

  // Remove internal calculation counter before sending to model
  const modelPayload = {
    period: payload.period,
    overallAdherence: payload.overallAdherence,
    totalTaken: payload.totalTaken,
    totalMissed: payload.totalMissed,
    currentStreak: payload.currentStreak,
    timeOfDay: payload.timeOfDay,
    medications: payload.medications,
    trackingOverview: payload.trackingOverview
  };

  const prompt = `
You are the MedRemind AI Insight Engine.
Your role is EXCLUSIVELY to interpret and explain the provided medication adherence report data for the user.

FACTUAL DATA:
${JSON.stringify(modelPayload, null, 2)}

STRICT CONSTRAINTS:
1. Base all commentary EXCLUSIVELY on the factual data provided in the JSON payload above.
2. Do NOT invent, assume, extrapolate, or recalculate statistics or numbers.
3. Do NOT provide medical advice, medical claims, diagnosis, or clinical assessments.
4. Do NOT recommend starting, stopping, increasing, decreasing, or altering any medication or dosage.
5. Only describe observed medication-tracking habits and time-of-day patterns (e.g. morning vs evening consistency).
6. Maintain an objective, encouraging, and supportive tone. Avoid alarmist or judgmental language.
7. If adherence is 100% and there are no missed doses, attentionItems must be an empty array [].
8. Return strictly valid JSON adhering to the exact schema below.

REQUIRED JSON SCHEMA:
{
  "summary": "1-2 sentences summarizing the user's tracking adherence for this period.",
  "positiveObservation": "A brief positive observation supported directly by the data (e.g., active streak or high consistency). Empty string if none supported.",
  "patterns": [
    "Observed tracking pattern supported directly by the data (maximum 3 items)"
  ],
  "attentionItems": [
    "Observed area deserving attention supported directly by the data (maximum 3 items). Empty array if adherence is 100%."
  ],
  "disclaimer": "These insights are based on medication tracking data and are not medical advice."
}
`;

  const ai = new GoogleGenAI({ apiKey });
  const responseText = await executeModelCascade(ai, prompt, "AI Report Service");

  try {
    const parsed = JSON.parse(responseText);
    const cleanResult = validateAndCleanResponse(parsed);
    insightCache.set(cacheKey, { data: cleanResult, expiresAt: Date.now() + CACHE_TTL_MS });
    return cleanResult;
  } catch (parseErr) {
    console.error("[AI Service] JSON parsing failed from Gemini response:", parseErr.message, "Response was:", responseText);
    const err = new Error("Malformed response received from AI model");
    err.status = 502;
    throw err;
  }
}

/**
 * Validates and normalizes structured Caregiver Summary response from Gemini
 */
function validateAndCleanCaregiverResponse(data) {
  const disclaimerText = "This summary is based on medication tracking data and is not medical advice.";

  if (!data || typeof data !== "object") {
    throw new Error("Invalid response structure from AI model");
  }

  const summary = typeof data.summary === "string" && data.summary.trim().length > 0
    ? data.summary.trim()
    : "Adherence data has been processed for the selected period.";

  const positiveObservation = typeof data.positiveObservation === "string"
    ? data.positiveObservation.trim()
    : "";

  const patterns = Array.isArray(data.patterns)
    ? data.patterns.filter(p => typeof p === "string" && p.trim()).slice(0, 3)
    : [];

  const attentionItems = Array.isArray(data.attentionItems)
    ? data.attentionItems.filter(a => typeof a === "string" && a.trim()).slice(0, 3)
    : [];

  return {
    summary,
    positiveObservation,
    patterns,
    attentionItems,
    disclaimer: disclaimerText
  };
}

/**
 * Generates an AI Caregiver Summary using Google Gemini for an authorized caregiver.
 * Privacy-safe: strictly contains no IDs, emails, personal names, or relationship labels.
 *
 * @param {string} patientId
 * @param {string} period - "week" or "month"
 * @returns {Promise<Object>} Structured Caregiver Summary
 */
async function generateCaregiverSummary(patientId, period = "week") {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    const error = new Error("GEMINI_API_KEY is not configured");
    error.code = "MISSING_API_KEY";
    throw error;
  }

  const payload = await buildAiInsightPayload(patientId, period);

  // Insufficient data guard: zero scheduled/logged doses -> DO NOT call Gemini
  if (payload.totalDoses === 0 || payload.medications.length === 0) {
    return {
      summary: "Not enough medication history yet for this patient.",
      positiveObservation: "",
      patterns: [],
      attentionItems: [],
      disclaimer: "This summary is based on medication tracking data and is not medical advice.",
      isInsufficientData: true
    };
  }

  const cacheKey = `caregiver:${patientId}:${period}:${payload.totalDoses}:${payload.overallAdherence}:${payload.currentStreak}`;
  const cached = insightCache.get(cacheKey);
  if (cached && Date.now() < cached.expiresAt) {
    return cached.data;
  }

  // Remove internal calculation counter before sending to model
  // Strictly excludes patient/caregiver MongoDB IDs, names, emails, and relationship labels
  const modelPayload = {
    period: payload.period,
    overallAdherence: payload.overallAdherence,
    totalTaken: payload.totalTaken,
    totalMissed: payload.totalMissed,
    currentStreak: payload.currentStreak,
    timeOfDay: payload.timeOfDay,
    medications: payload.medications,
    trackingOverview: payload.trackingOverview
  };

  const prompt = `
You are the MedRemind AI Caregiver Assistant.
Your role is EXCLUSIVELY to interpret and summarize the provided patient medication adherence tracking data for their authorized caregiver.

FACTUAL TRACKING DATA:
${JSON.stringify(modelPayload, null, 2)}

STRICT SAFETY AND PRIVACY RULES:
1. Base all commentary EXCLUSIVELY on the factual tracking data provided in the JSON payload above.
2. Do NOT invent, assume, extrapolate, or recalculate statistics or numbers.
3. Do NOT provide medical advice, diagnosis, treatment advice, or clinical assessments.
4. Do NOT recommend starting, stopping, increasing, decreasing, or altering any medication or dosage.
5. Do NOT suggest changing medication schedules or reminder schedules.
6. Do NOT prescribe medications or tell the caregiver what medical action to take.
7. Only describe observed medication-tracking habits, adherence rates, counts, streaks, and time-of-day patterns (e.g., morning vs evening consistency).
8. Maintain an objective, professional, and supportive caregiver-oriented tone.
9. If adherence is 100% and there are no missed doses, attentionItems must be an empty array [].
10. Return strictly valid JSON adhering to the exact schema below.

REQUIRED JSON SCHEMA:
{
  "summary": "1-2 sentences summarizing the patient's medication tracking adherence for this period for the caregiver.",
  "positiveObservation": "A brief positive observation supported directly by the data (e.g., active streak or high consistency). Empty string if none supported.",
  "patterns": [
    "Observed tracking pattern supported directly by the data (maximum 3 items)"
  ],
  "attentionItems": [
    "Observed tracking area deserving caregiver attention supported directly by the data, such as missed doses (maximum 3 items). Empty array if adherence is 100% or no misses recorded."
  ],
  "disclaimer": "This summary is based on medication tracking data and is not medical advice."
}
`;

  const ai = new GoogleGenAI({ apiKey });
  const responseText = await executeModelCascade(ai, prompt, "AI Caregiver Service");

  try {
    const parsed = JSON.parse(responseText);
    const cleanResult = validateAndCleanCaregiverResponse(parsed);
    insightCache.set(cacheKey, { data: cleanResult, expiresAt: Date.now() + CACHE_TTL_MS });
    return cleanResult;
  } catch (parseErr) {
    console.error("[AI Caregiver Service] JSON parsing failed from Gemini response:", parseErr.message, "Response was:", responseText);
    const err = new Error("Malformed response received from AI model");
    err.status = 502;
    throw err;
  }
}

module.exports = {
  buildAiInsightPayload,
  generateReportInsights,
  generateCaregiverSummary
};

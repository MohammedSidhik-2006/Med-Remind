const mongoose = require("mongoose");
const CaregiverRelation = require("../models/CaregiverRelation");
const { catchUpMedicinesForUser } = require("../middleware/catchUpMiddleware");
const { generateReportInsights, generateCaregiverSummary } = require("../services/aiReportService");

/**
 * Controller to handle AI Report Insights generation.
 * GET /api/ai/report-insights?period=week
 */
exports.getReportInsights = async (req, res) => {
  try {
    const period = (req.query.period || "week").toLowerCase();

    // 1. Validate period
    if (period !== "week" && period !== "month") {
      return res.status(400).json({
        message: "Invalid period specified. Allowed values are 'week' or 'month'."
      });
    }

    // 2. User ID from auth token
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ message: "Authentication required" });
    }

    // 3. Generate insights through Gemini explanation layer
    const insights = await generateReportInsights(userId, period);

    // 4. Return safe structured response
    return res.json(insights);
  } catch (error) {
    console.error("[aiController:getReportInsights]", error.message);

    // Handle specific error conditions cleanly without leaking internals
    if (error.code === "MISSING_API_KEY") {
      return res.status(503).json({
        message: "AI service is currently not configured. Please contact administrator."
      });
    }

    if (error.status === 429 || error.message?.includes("RESOURCE_EXHAUSTED") || error.message?.includes("quota")) {
      return res.status(429).json({
        message: "AI insights request limit reached. Please try again in a few moments."
      });
    }

    if (error.status === 503 || error.message?.includes("UNAVAILABLE") || error.message?.includes("high demand")) {
      return res.status(503).json({
        message: "AI service is experiencing high demand. Please try again shortly."
      });
    }

    if (error.status === 502 || error.message?.includes("Malformed")) {
      return res.status(502).json({
        message: "Unable to parse AI insights. Please try requesting again."
      });
    }

    // Generic safe fallback for database or unexpected errors
    return res.status(500).json({
      message: "An error occurred while generating report insights."
    });
  }
};

/**
 * Controller to handle AI Caregiver Summary generation.
 * GET /api/ai/caregiver-summary/:patientId?period=week
 */
exports.getCaregiverSummary = async (req, res) => {
  try {
    const { patientId } = req.params;
    const period = (req.query.period || "week").toLowerCase();

    // 1. Validate period
    if (period !== "week" && period !== "month") {
      return res.status(400).json({
        message: "Invalid period specified. Allowed values are 'week' or 'month'."
      });
    }

    // 2. Validate patientId
    if (!patientId || !mongoose.Types.ObjectId.isValid(patientId)) {
      return res.status(400).json({ message: "Invalid patient ID." });
    }

    // 3. Caregiver authentication
    const caregiverId = req.user?.id;
    if (!caregiverId) {
      return res.status(401).json({ message: "Authentication required" });
    }

    // 4. Verify caregiver authorization relationship
    const relation = await CaregiverRelation.findOne({
      patientId,
      caregiverId
    });
    if (!relation) {
      return res.status(403).json({
        message: "Unauthorized. You are not linked to this patient."
      });
    }

    // 5. Catch up patient's medication logs before generating metrics
    try {
      await catchUpMedicinesForUser(patientId);
    } catch (err) {
      console.error("[aiController:getCaregiverSummary] CatchUp error:", err.message);
    }

    // 6. Generate summary through Gemini interpretation layer
    const summary = await generateCaregiverSummary(patientId, period);

    // 7. Return safe structured response
    return res.json(summary);
  } catch (error) {
    console.error("[aiController:getCaregiverSummary]", error.message);

    // Handle specific error conditions cleanly without leaking internals
    if (error.code === "MISSING_API_KEY") {
      return res.status(503).json({
        message: "AI service is currently not configured. Please contact administrator."
      });
    }

    if (error.status === 429 || error.message?.includes("RESOURCE_EXHAUSTED") || error.message?.includes("quota")) {
      return res.status(429).json({
        message: "AI summary request limit reached. Please try again in a few moments."
      });
    }

    if (error.status === 503 || error.message?.includes("UNAVAILABLE") || error.message?.includes("high demand")) {
      return res.status(503).json({
        message: "AI service is experiencing high demand. Please try again shortly."
      });
    }

    if (error.status === 502 || error.message?.includes("Malformed")) {
      return res.status(502).json({
        message: "Unable to parse AI summary. Please try requesting again."
      });
    }

    // Generic safe fallback for database or unexpected errors
    return res.status(500).json({
      message: "An error occurred while generating caregiver summary."
    });
  }
};

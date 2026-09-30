const express = require("express");
const router = express.Router();
const authMiddleware = require("../middleware/authMiddleware");
const { catchUpMiddleware } = require("../middleware/catchUpMiddleware");
const aiController = require("../controllers/aiController");

// Protected endpoint to generate on-demand AI Report Insights
router.get("/report-insights", authMiddleware, catchUpMiddleware, aiController.getReportInsights);

// Protected endpoint to generate on-demand AI Caregiver Summary
router.get("/caregiver-summary/:patientId", authMiddleware, aiController.getCaregiverSummary);

module.exports = router;

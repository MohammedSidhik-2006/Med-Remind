const express = require("express");
const router = express.Router();
const authMiddleware = require("../middleware/authMiddleware");
const {
  linkCaregiver,
  getMyCaregiver,
  unlinkCaregiver,
  getMyPatients,
  getPatientDashboard
} = require("../controllers/caregiverController");

router.post("/link", authMiddleware, linkCaregiver);
router.get("/my-caregiver", authMiddleware, getMyCaregiver);
router.delete("/unlink", authMiddleware, unlinkCaregiver);
router.get("/my-patients", authMiddleware, getMyPatients);
router.get("/patient/:patientId/dashboard", authMiddleware, getPatientDashboard);

module.exports = router;

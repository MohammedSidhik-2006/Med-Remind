const express = require("express");
const router = express.Router();
const {
  addMedicine, getMedicines, deleteMedicine,
  markTaken, snoozeMedicine, updateStock, resetTaken, getReports, getDoseLogs
} = require("../controllers/medicineController");
const authMiddleware = require("../middleware/authMiddleware");
const { catchUpMiddleware } = require("../middleware/catchUpMiddleware");

router.post("/add",        authMiddleware, catchUpMiddleware, addMedicine);
router.get("/",            authMiddleware, catchUpMiddleware, getMedicines);
router.get("/reports",     authMiddleware, catchUpMiddleware, getReports);
router.get("/logs",        authMiddleware, catchUpMiddleware, getDoseLogs);
router.delete("/:id",      authMiddleware, catchUpMiddleware, deleteMedicine);
router.patch("/taken/:id", authMiddleware, catchUpMiddleware, markTaken);
router.patch("/snooze/:id",authMiddleware, catchUpMiddleware, snoozeMedicine);
router.patch("/stock/:id", authMiddleware, catchUpMiddleware, updateStock);
router.post("/reset",      authMiddleware, catchUpMiddleware, resetTaken);

module.exports = router;

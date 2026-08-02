const express = require("express");
const router = express.Router();
const authMiddleware = require("../middleware/authMiddleware");
const { requireAdmin, getUsers, getAuditLogs, getMedDatabase, addMedDatabase, deleteMedDatabase, broadcastAlert, deleteUser, getAllMedicines, deleteUserMedicine } = require("../controllers/adminController");

router.use(authMiddleware, requireAdmin);

router.get("/users", getUsers);
router.get("/audit", getAuditLogs);
router.get("/med-database", getMedDatabase);
router.post("/med-database", addMedDatabase);
router.delete("/med-database/:id", deleteMedDatabase);
router.post("/broadcast", broadcastAlert);

router.delete("/users/:id", deleteUser);
router.get("/medicines", getAllMedicines);
router.delete("/medicines/:id", deleteUserMedicine);

module.exports = router;

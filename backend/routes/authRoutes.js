const express = require("express");
const router = express.Router();
const authMiddleware = require("../middleware/authMiddleware");
const { rateLimitAuth } = require("../middleware/rateLimitMiddleware");
const { register, login, getProfile, updateProfile, deleteAccount, forgotPassword, resetPassword } = require("../controllers/authController");

const { catchUpMiddleware } = require("../middleware/catchUpMiddleware");

router.post("/register", rateLimitAuth, register);
router.post("/login", rateLimitAuth, login);
router.post("/forgot-password", rateLimitAuth, forgotPassword);
router.post("/reset-password", rateLimitAuth, resetPassword);
router.get("/profile", authMiddleware, catchUpMiddleware, getProfile);
router.put("/profile", authMiddleware, updateProfile);
router.delete("/account", authMiddleware, deleteAccount);

module.exports = router;

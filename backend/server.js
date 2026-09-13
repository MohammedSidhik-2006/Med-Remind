const express = require("express");
const cors = require("cors");
require("dotenv").config();

const connectDB = require("./config/db");
const authRoutes = require("./routes/authRoutes");
const medicineRoutes = require("./routes/medicineRoutes");
const adminRoutes = require("./routes/adminRoutes");
const startReminder = require("./services/reminderService");
const { sendPushToUser } = require("./services/pushService");
const authMiddleware = require("./middleware/authMiddleware");
const User = require("./models/User");

const app = express();

// ── Security Headers ──────────────────────────────────────────
// Hardens API against standard web vulnerabilities (Helmet alternative)
app.use((req, res, next) => {
  res.setHeader("X-DNS-Prefetch-Control", "off");
  res.setHeader("X-Frame-Options", "SAMEORIGIN");
  res.setHeader("Strict-Transport-Security", "max-age=15552000; includeSubDomains");
  res.setHeader("X-Download-Options", "noopen");
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-XSS-Protection", "1; mode=block");
  next();
});

// ── CORS ──────────────────────────────────────────────────────
const corsOrigin = process.env.CORS_ORIGIN ? process.env.CORS_ORIGIN.split(',') : ['http://localhost:3000'];
app.use(cors({
  origin: function(origin, callback) {
    if (!origin || corsOrigin.includes(origin) || corsOrigin.includes('*')) {
      callback(null, true);
    } else {
      console.error(`CORS blocked origin: ${origin}`);
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true
}));

app.use(express.json({ limit: "10kb" }));




// ── Startup ───────────────────────────────────────────────────
connectDB().then(() => {
  startReminder();
  
  // Start server only after DB connection succeeds
  const PORT = process.env.PORT || 5000;
  app.listen(PORT, "0.0.0.0", () => console.log(`Server running on port ${PORT} [${process.env.NODE_ENV || "development"}]`));
}).catch((err) => {
  console.error("❌ Failed to connect to MongoDB. Server will not start.");
  process.exit(1);
});

// ── Cron monitoring ───────────────────────────────────────────
let lastCronRun = null;
let cronRunCount = 0;
global.recordCronTick = () => { lastCronRun = new Date(); cronRunCount++; };

// ── Routes ────────────────────────────────────────────────────
app.get("/", (req, res) => res.json({ status: "MedRemind API Running", version: "1.0.0" }));

app.get("/api/health", (req, res) => {
  const mem = process.memoryUsage();
  res.json({
    status: "Success",
    uptime: `${Math.round(process.uptime())}s`,
    lastCronRun,
    cronRunCount,
    memory: {
      rss: `${Math.round(mem.rss / 1024 / 1024)}MB`,
      heapUsed: `${Math.round(mem.heapUsed / 1024 / 1024)}MB`
    }
  });
});

// VAPID public key — frontend needs this to subscribe
app.get("/api/vapid-public-key", (req, res) => {
  const key = process.env.VAPID_PUBLIC_KEY;
  if (!key) return res.status(500).json({ message: "VAPID not configured" });
  res.json({ publicKey: key });
});

// Save or update push subscription for the logged-in user
app.post("/api/save-subscription", authMiddleware, async (req, res) => {
  try {
    const { endpoint, keys } = req.body;
    if (!endpoint || !keys?.p256dh || !keys?.auth) {
      return res.status(400).json({ message: "Invalid subscription object" });
    }
    await User.findByIdAndUpdate(req.user.id, {
      $set: { pushSubscription: { endpoint, keys } }
    });
    res.json({ message: "Subscription saved" });
  } catch (err) {
    console.error("save-subscription error:", err.message);
    res.status(500).json({ message: "Server error" });
  }
});

// Test push notification — sends to the logged-in user
app.post("/api/send-notification", authMiddleware, async (req, res) => {
  try {
    const title = req.body.title || "MedRemind Test";
    const body = req.body.body || "Push notifications are working!";
    const ok = await sendPushToUser(req.user.id, { title, body, icon: "/logo192.png", tag: "test" });
    if (ok) return res.json({ message: "Push notification sent" });
    res.status(400).json({ message: "No subscription found or push failed. Subscribe first." });
  } catch (err) {
    console.error("send-notification error:", err.message);
    res.status(500).json({ message: "Server error" });
  }
});

const caregiverRoutes = require("./routes/caregiverRoutes");

app.use("/api/auth", authRoutes);
app.use("/api/medicine", medicineRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/caregiver", caregiverRoutes);

// ── 404 ───────────────────────────────────────────────────────
app.use((req, res) => res.status(404).json({ message: "Route not found" }));

// ── Global Error Handler ──────────────────────────────────────
app.use((err, req, res, next) => { // eslint-disable-line no-unused-vars
  console.error("Unhandled error:", err.message);
  res.status(500).json({ message: "Internal server error" });
});

process.on("unhandledRejection", (reason) => { console.error("Unhandled Rejection:", reason); });
process.on("uncaughtException", (err) => { console.error("Uncaught Exception:", err.message); process.exit(1); });

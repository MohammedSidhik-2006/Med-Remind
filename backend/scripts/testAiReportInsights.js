const mongoose = require("mongoose");
const express = require("express");
const jwt = require("jsonwebtoken");
const path = require("path");
require("dotenv").config({ path: path.resolve(__dirname, "../.env") });

const User = require("../models/User");
const Medicine = require("../models/Medicine");
const DoseLog = require("../models/DoseLog");
const aiRoutes = require("../routes/aiRoutes");
const medicineRoutes = require("../routes/medicineRoutes");
const { getLocalDate } = require("../services/reportMetricsService");

const PORT = 5055;
const BASE_URL = `http://localhost:${PORT}/api/ai`;

const colors = {
  green: (t) => `\x1b[32m${t}\x1b[0m`,
  red: (t) => `\x1b[31m${t}\x1b[0m`,
  yellow: (t) => `\x1b[33m${t}\x1b[0m`,
  cyan: (t) => `\x1b[36m${t}\x1b[0m`,
  bold: (t) => `\x1b[1m${t}\x1b[0m`
};

let server;

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

async function request(endpoint, token = null) {
  const headers = { "Content-Type": "application/json" };
  if (token) headers["Authorization"] = `Bearer ${token}`;

  const res = await fetch(`${BASE_URL}${endpoint}`, { headers });
  let data = null;
  try {
    data = await res.json();
  } catch (e) {
    data = null;
  }
  return { status: res.status, data };
}

function verifyNoSecrets(data, user) {
  const jsonStr = JSON.stringify(data);
  if (jsonStr.includes(process.env.GEMINI_API_KEY)) {
    throw new Error("SECURITY VIOLATION: GEMINI_API_KEY leaked in response!");
  }
  if (user && user._id && jsonStr.includes(user._id.toString())) {
    throw new Error("SECURITY VIOLATION: User ObjectId leaked in response!");
  }
  if (user && user.email && jsonStr.includes(user.email)) {
    throw new Error("SECURITY VIOLATION: User email leaked in response!");
  }
  if (jsonStr.includes("password")) {
    throw new Error("SECURITY VIOLATION: Password field found in response!");
  }
}

function verifySchema(data, isInsufficient = false) {
  assert(data && typeof data === "object", "Response must be a JSON object");
  assert(typeof data.summary === "string" && data.summary.length > 0, "summary must be a non-empty string");
  assert(typeof data.positiveObservation === "string", "positiveObservation must be a string");
  assert(Array.isArray(data.patterns), "patterns must be an array");
  assert(Array.isArray(data.attentionItems), "attentionItems must be an array");
  assert(data.patterns.length <= 3, "patterns must have at most 3 items");
  assert(data.attentionItems.length <= 3, "attentionItems must have at most 3 items");
  assert(
    data.disclaimer === "These insights are based on medication tracking data and are not medical advice.",
    "disclaimer text must match exact required phrasing"
  );
}

async function runTestSuite() {
  console.log(colors.bold(colors.cyan("\n==================================================")));
  console.log(colors.bold(colors.cyan("       AI Report Insights Verification Suite      ")));
  console.log(colors.bold(colors.cyan("==================================================\n")));

  await mongoose.connect(process.env.MONGO_URI, { serverSelectionTimeoutMS: 5000 });
  console.log(colors.green("✅ Database connected."));

  const app = express();
  app.use(express.json());
  app.use("/api/ai", aiRoutes);
  app.use("/api/medicine", medicineRoutes);

  server = app.listen(PORT);
  console.log(colors.green(`✅ Test Express server running on port ${PORT}.\n`));

  let passed = 0;
  let failed = 0;

  async function test(name, fn) {
    try {
      await fn();
      console.log(`  ${colors.green("✓")} ${name}`);
      passed++;
    } catch (err) {
      console.log(`  ${colors.red("✗")} ${name}`);
      console.log(`     ${colors.red("Error:")} ${err.message}`);
      failed++;
    }
  }

  // Helper to create clean test user with token
  async function createTestUser(emailPrefix) {
    const email = `${emailPrefix}_${Date.now()}@example.com`;
    const user = await User.create({
      name: "AI Test User",
      email,
      password: "hashedPassword123",
      role: "user"
    });
    const token = jwt.sign({ id: user._id, role: user.role }, process.env.JWT_SECRET || "medremindsecret", { expiresIn: "1h" });
    return { user, token };
  }

  try {
    // ----------------------------------------------------
    // Scenario 1: User with no medication history
    // ----------------------------------------------------
    await test("Scenario 1: User with no medication history (insufficient data)", async () => {
      const { user, token } = await createTestUser("no_history");
      const res = await request("/report-insights?period=week", token);

      assert(res.status === 200, `Expected 200, got ${res.status}`);
      verifySchema(res.data, true);
      assert(res.data.isInsufficientData === true, "isInsufficientData flag should be true");
      assert(res.data.patterns.length === 0, "patterns should be empty for no history");
      assert(res.data.attentionItems.length > 0, "attentionItems should guide the user to log meds");
      verifyNoSecrets(res.data, user);
    });

    // ----------------------------------------------------
    // Scenario 2: User with one medication
    // ----------------------------------------------------
    await test("Scenario 2: User with one medication", async () => {
      const { user, token } = await createTestUser("one_med");
      const med = await Medicine.create({
        userId: user._id,
        name: "Amoxicillin",
        dosage: "250mg",
        time: "09:00",
        times: ["09:00"],
        stock: 20,
        refillAt: 5
      });

      // Create 5 taken doses for the past 5 days
      const today = new Date();
      for (let i = 0; i < 5; i++) {
        const d = new Date(today);
        d.setDate(today.getDate() - i);
        await DoseLog.create({
          userId: user._id,
          medicineId: med._id,
          medicineName: med.name,
          dosage: med.dosage,
          date: getLocalDate(d),
          scheduledTime: "09:00",
          status: "taken",
          takenAt: d
        });
      }

      const res = await request("/report-insights?period=week", token);
      assert(res.status === 200, `Expected 200, got ${res.status}`);
      verifySchema(res.data);
      verifyNoSecrets(res.data, user);
    });

    // ----------------------------------------------------
    // Scenario 3: User with multiple medications
    // ----------------------------------------------------
    await test("Scenario 3: User with multiple medications", async () => {
      const { user, token } = await createTestUser("multi_med");
      const med1 = await Medicine.create({
        userId: user._id,
        name: "Metformin",
        dosage: "500mg",
        time: "08:00",
        times: ["08:00"],
        stock: 30,
        refillAt: 5
      });
      const med2 = await Medicine.create({
        userId: user._id,
        name: "Lisinopril",
        dosage: "10mg",
        time: "20:00",
        times: ["20:00"],
        stock: 30,
        refillAt: 5
      });

      const today = new Date();
      for (let i = 0; i < 4; i++) {
        const d = new Date(today);
        d.setDate(today.getDate() - i);
        const ds = getLocalDate(d);
        await DoseLog.create({
          userId: user._id,
          medicineId: med1._id,
          medicineName: med1.name,
          dosage: med1.dosage,
          date: ds,
          scheduledTime: "08:00",
          status: "taken",
          takenAt: d
        });
        await DoseLog.create({
          userId: user._id,
          medicineId: med2._id,
          medicineName: med2.name,
          dosage: med2.dosage,
          date: ds,
          scheduledTime: "20:00",
          status: "taken",
          takenAt: d
        });
      }

      const res = await request("/report-insights?period=week", token);
      assert(res.status === 200, `Expected 200, got ${res.status}`);
      verifySchema(res.data);
      verifyNoSecrets(res.data, user);
    });

    // ----------------------------------------------------
    // Scenario 4: User with missed doses
    // ----------------------------------------------------
    await test("Scenario 4: User with missed doses", async () => {
      const { user, token } = await createTestUser("missed_doses");
      const med = await Medicine.create({
        userId: user._id,
        name: "Atorvastatin",
        dosage: "20mg",
        time: "21:00",
        times: ["21:00"],
        stock: 15,
        refillAt: 5
      });

      const today = new Date();
      // 3 taken, 2 missed
      for (let i = 0; i < 5; i++) {
        const d = new Date(today);
        d.setDate(today.getDate() - i);
        const isMissed = i < 2;
        await DoseLog.create({
          userId: user._id,
          medicineId: med._id,
          medicineName: med.name,
          dosage: med.dosage,
          date: getLocalDate(d),
          scheduledTime: "21:00",
          status: isMissed ? "missed" : "taken",
          takenAt: isMissed ? null : d
        });
      }

      const res = await request("/report-insights?period=week", token);
      assert(res.status === 200, `Expected 200, got ${res.status}`);
      verifySchema(res.data);
      assert(res.data.attentionItems.length > 0, "Should have attention items for missed doses");
      verifyNoSecrets(res.data, user);
    });

    // ----------------------------------------------------
    // Scenario 5: User with 100% adherence
    // ----------------------------------------------------
    await test("Scenario 5: User with 100% adherence", async () => {
      const { user, token } = await createTestUser("perfect_adherence");
      const med = await Medicine.create({
        userId: user._id,
        name: "Vitamin D3",
        dosage: "1000IU",
        time: "10:00",
        times: ["10:00"],
        stock: 60,
        refillAt: 10
      });

      const today = new Date();
      for (let i = 0; i < 7; i++) {
        const d = new Date(today);
        d.setDate(today.getDate() - i);
        await DoseLog.create({
          userId: user._id,
          medicineId: med._id,
          medicineName: med.name,
          dosage: med.dosage,
          date: getLocalDate(d),
          scheduledTime: "10:00",
          status: "taken",
          takenAt: d
        });
      }

      const res = await request("/report-insights?period=week", token);
      assert(res.status === 200, `Expected 200, got ${res.status}`);
      verifySchema(res.data);
      assert(res.data.attentionItems.length === 0, "attentionItems MUST be empty for 100% adherence");
      assert(res.data.positiveObservation.length > 0, "Should have a positive observation");
      verifyNoSecrets(res.data, user);
    });

    // ----------------------------------------------------
    // Scenario 6: User with mixed adherence
    // ----------------------------------------------------
    await test("Scenario 6: User with mixed adherence", async () => {
      const { user, token } = await createTestUser("mixed_adherence");
      const medMorning = await Medicine.create({
        userId: user._id,
        name: "Morning Med",
        dosage: "10mg",
        time: "08:00",
        times: ["08:00"]
      });
      const medNight = await Medicine.create({
        userId: user._id,
        name: "Night Med",
        dosage: "20mg",
        time: "22:00",
        times: ["22:00"]
      });

      const today = new Date();
      // Morning is always taken (100%), Night is frequently missed
      for (let i = 0; i < 6; i++) {
        const d = new Date(today);
        d.setDate(today.getDate() - i);
        const ds = getLocalDate(d);
        await DoseLog.create({
          userId: user._id,
          medicineId: medMorning._id,
          medicineName: medMorning.name,
          dosage: medMorning.dosage,
          date: ds,
          scheduledTime: "08:00",
          status: "taken",
          takenAt: d
        });
        await DoseLog.create({
          userId: user._id,
          medicineId: medNight._id,
          medicineName: medNight.name,
          dosage: medNight.dosage,
          date: ds,
          scheduledTime: "22:00",
          status: i % 2 === 0 ? "missed" : "taken",
          takenAt: i % 2 === 0 ? null : d
        });
      }

      const res = await request("/report-insights?period=week", token);
      assert(res.status === 200, `Expected 200, got ${res.status}`);
      verifySchema(res.data);
      verifyNoSecrets(res.data, user);
    });

    // ----------------------------------------------------
    // Scenario 7: Gemini API failure / missing key handling
    // ----------------------------------------------------
    await test("Scenario 7: Gemini API failure / missing key handling", async () => {
      const { user, token } = await createTestUser("gemini_err");
      const med = await Medicine.create({
        userId: user._id,
        name: "TestMed",
        dosage: "5mg",
        time: "10:00",
        times: ["10:00"]
      });
      await DoseLog.create({
        userId: user._id,
        medicineId: med._id,
        medicineName: med.name,
        dosage: med.dosage,
        date: getLocalDate(new Date()),
        scheduledTime: "10:00",
        status: "taken",
        takenAt: new Date()
      });

      const origKey = process.env.GEMINI_API_KEY;
      try {
        delete process.env.GEMINI_API_KEY;
        const res = await request("/report-insights?period=week", token);
        assert(res.status === 503, `Expected 503 when API key missing, got ${res.status}`);
        assert(res.data && res.data.message, "Should return safe message");
        assert(!JSON.stringify(res.data).includes(origKey), "Must not leak API key");
      } finally {
        process.env.GEMINI_API_KEY = origKey;
      }
    });

    // ----------------------------------------------------
    // Scenario 8: Unauthenticated request
    // ----------------------------------------------------
    await test("Scenario 8: Unauthenticated request", async () => {
      const res = await request("/report-insights?period=week", null); // No token
      assert(res.status === 401, `Expected 401 Unauthorized, got ${res.status}`);
      assert(res.data && res.data.message, "Should return authentication required message");
    });

  } finally {
    if (server) server.close();
    await mongoose.connection.close();
  }

  console.log(colors.bold(colors.cyan("\n--------------------------------------------------")));
  console.log(`Results: ${colors.green(`${passed} passed`)}, ${failed > 0 ? colors.red(`${failed} failed`) : "0 failed"}`);
  console.log(colors.bold(colors.cyan("==================================================\n")));

  if (failed > 0) process.exit(1);
}

runTestSuite().catch(err => {
  console.error("Fatal error:", err);
  process.exit(1);
});

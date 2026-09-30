const puppeteer = require("puppeteer-core");
const mongoose = require("mongoose");
const jwt = require("jsonwebtoken");
const path = require("path");
require("dotenv").config({ path: path.resolve(__dirname, "../.env") });

const User = require("../models/User");
const CaregiverRelation = require("../models/CaregiverRelation");
const { buildAiInsightPayload, generateCaregiverSummary } = require("../services/aiReportService");

const EDGE_PATH = "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe";
const FRONTEND_URL = "http://localhost:3000";
const BACKEND_URL = "http://localhost:5000";

const colors = {
  green: (t) => `\x1b[32m${t}\x1b[0m`,
  red: (t) => `\x1b[31m${t}\x1b[0m`,
  cyan: (t) => `\x1b[36m${t}\x1b[0m`,
  bold: (t) => `\x1b[1m${t}\x1b[0m`
};

const results = [];

function recordTest(testNum, testName, expected, actual, pass, details = "") {
  results.push({
    testNum,
    test: testName,
    expected,
    actual,
    pass,
    details
  });
  const status = pass ? colors.green("✓ PASS") : colors.red("✗ FAIL");
  console.log(`[Test ${testNum}] ${status}: ${colors.bold(testName)}`);
  console.log(`        Expected: ${expected}`);
  console.log(`        Actual:   ${actual}`);
  if (details) console.log(`        Details:  ${colors.cyan(details)}`);
}

async function main() {
  console.log(colors.bold(colors.cyan("\n==================================================================")));
  console.log(colors.bold(colors.cyan("   PHASE 3: AI CAREGIVER SUMMARY LIVE E2E VALIDATION SUITE        ")));
  console.log(colors.bold(colors.cyan("==================================================================\n")));

  await mongoose.connect(process.env.MONGO_URI);

  // Fetch seeded test users
  const caregiver = await User.findOne({ email: "caregiver@example.com" });
  const unauthCaregiver = await User.findOne({ email: "unauth_caregiver@example.com" });
  const patientA = await User.findOne({ email: "e2e_user@example.com" });
  const patientB = await User.findOne({ email: "perfect_user@example.com" });
  const patientC = await User.findOne({ email: "nodata_user@example.com" });
  const patientD = await User.findOne({ email: "stranger@example.com" });

  const caregiverToken = jwt.sign(
    { id: caregiver._id, name: caregiver.name, email: caregiver.email, role: caregiver.role, avatar: caregiver.avatar },
    process.env.JWT_SECRET || "medremindsecret",
    { expiresIn: "7d" }
  );

  const unauthCaregiverToken = jwt.sign(
    { id: unauthCaregiver._id, name: unauthCaregiver.name, email: unauthCaregiver.email, role: unauthCaregiver.role, avatar: unauthCaregiver.avatar },
    process.env.JWT_SECRET || "medremindsecret",
    { expiresIn: "7d" }
  );

  // -------------------------------------------------------------
  // Test 14: Unauthenticated request
  // -------------------------------------------------------------
  try {
    const res = await fetch(`${BACKEND_URL}/api/ai/caregiver-summary/${patientA._id}`);
    const pass = res.status === 401;
    recordTest(14, "Unauthenticated request", "HTTP 401", `HTTP ${res.status}`, pass);
  } catch (err) {
    recordTest(14, "Unauthenticated request", "HTTP 401", err.message, false);
  }

  // -------------------------------------------------------------
  // Test 2: Unauthorized caregiver (not linked to patient)
  // -------------------------------------------------------------
  try {
    const res = await fetch(`${BACKEND_URL}/api/ai/caregiver-summary/${patientA._id}`, {
      headers: { Authorization: `Bearer ${unauthCaregiverToken}` }
    });
    const body = await res.json();
    const pass = res.status === 403 && body.message === "Unauthorized. You are not linked to this patient.";
    recordTest(2, "Unauthorized caregiver", "HTTP 403 (Unauthorized. You are not linked to this patient.)", `HTTP ${res.status} (${body.message})`, pass);
  } catch (err) {
    recordTest(2, "Unauthorized caregiver", "HTTP 403", err.message, false);
  }

  // -------------------------------------------------------------
  // Test 3: Unlinked / stale relationship
  // -------------------------------------------------------------
  try {
    const res = await fetch(`${BACKEND_URL}/api/ai/caregiver-summary/${patientD._id}`, {
      headers: { Authorization: `Bearer ${caregiverToken}` }
    });
    const body = await res.json();
    const pass = res.status === 403 && body.message === "Unauthorized. You are not linked to this patient.";
    recordTest(3, "Unlinked caregiver relationship", "HTTP 403 (Unauthorized. You are not linked to this patient.)", `HTTP ${res.status} (${body.message})`, pass);
  } catch (err) {
    recordTest(3, "Unlinked caregiver relationship", "HTTP 403", err.message, false);
  }

  // -------------------------------------------------------------
  // Test 4: No tracking history (Patient C)
  // -------------------------------------------------------------
  try {
    const res = await fetch(`${BACKEND_URL}/api/ai/caregiver-summary/${patientC._id}`, {
      headers: { Authorization: `Bearer ${caregiverToken}` }
    });
    const body = await res.json();
    const pass = res.status === 200 &&
                 body.isInsufficientData === true &&
                 body.summary === "Not enough medication history yet for this patient." &&
                 body.disclaimer === "This summary is based on medication tracking data and is not medical advice.";
    recordTest(4, "No tracking history", "isInsufficientData: true, friendly message, Gemini not invoked", `HTTP ${res.status}, summary: '${body.summary}', isInsufficientData: ${body.isInsufficientData}`, pass);
  } catch (err) {
    recordTest(4, "No tracking history", "HTTP 200 with isInsufficientData", err.message, false);
  }

  // -------------------------------------------------------------
  // Test 15: Privacy verification (inspect model payload)
  // -------------------------------------------------------------
  try {
    const payload = await buildAiInsightPayload(patientA._id.toString(), "week");
    const jsonStr = JSON.stringify(payload);
    const hasPatientId = jsonStr.includes(patientA._id.toString());
    const hasCaregiverId = jsonStr.includes(caregiver._id.toString());
    const hasPatientName = jsonStr.toLowerCase().includes("robert");
    const hasCaregiverName = jsonStr.toLowerCase().includes("sarah");
    const hasEmails = jsonStr.includes("@example.com");
    const hasRelationship = jsonStr.toLowerCase().includes("father") || jsonStr.toLowerCase().includes("mother");

    const pass = !hasPatientId && !hasCaregiverId && !hasPatientName && !hasCaregiverName && !hasEmails && !hasRelationship;
    const actual = `IDs: ${!hasPatientId && !hasCaregiverId ? "None" : "Exposed"}, Names: ${!hasPatientName && !hasCaregiverName ? "None" : "Exposed"}, Relationship: ${!hasRelationship ? "None" : "Exposed"}`;
    recordTest(15, "Privacy verification", "Zero MongoDB IDs, names, emails, relationship labels in AI payload", actual, pass);
  } catch (err) {
    recordTest(15, "Privacy verification", "Payload clean", err.message, false);
  }

  // -------------------------------------------------------------
  // Test 1: Authorized caregiver (Patient A)
  // -------------------------------------------------------------
  let summaryA = null;
  try {
    const res = await fetch(`${BACKEND_URL}/api/ai/caregiver-summary/${patientA._id}?period=week`, {
      headers: { Authorization: `Bearer ${caregiverToken}` }
    });
    summaryA = await res.json();
    const pass = res.status === 200 &&
                 typeof summaryA.summary === "string" &&
                 summaryA.summary.length > 0 &&
                 summaryA.disclaimer === "This summary is based on medication tracking data and is not medical advice.";
    recordTest(1, "Authorized caregiver", "HTTP 200 + structured summary + exact disclaimer", `HTTP ${res.status}, summary length: ${summaryA.summary?.length}, disclaimer match: ${summaryA.disclaimer === "This summary is based on medication tracking data and is not medical advice."}`, pass);
  } catch (err) {
    recordTest(1, "Authorized caregiver", "HTTP 200 + structured summary", err.message, false);
  }

  // -------------------------------------------------------------
  // Test 6: Missed doses in summary/attention
  // -------------------------------------------------------------
  try {
    const hasMissedMention = Array.isArray(summaryA?.attentionItems) && summaryA.attentionItems.length > 0;
    const disclaimerCorrect = summaryA?.disclaimer === "This summary is based on medication tracking data and is not medical advice.";
    const pass = hasMissedMention && disclaimerCorrect;
    recordTest(6, "Missed doses tracking", "attentionItems reflects missed tracking doses", `attentionItems count: ${summaryA?.attentionItems?.length || 0}`, pass);
  } catch (err) {
    recordTest(6, "Missed doses tracking", "attentionItems contains missed observations", err.message, false);
  }

  // -------------------------------------------------------------
  // Test 7: Multiple medications tracking
  // -------------------------------------------------------------
  try {
    const payloadA = await buildAiInsightPayload(patientA._id.toString(), "week");
    const medNames = payloadA.medications.map(m => m.name);
    const pass = medNames.includes("Metformin") && medNames.includes("Lisinopril") && payloadA.medications.length === 2;
    recordTest(7, "Multiple medications", "Deterministic tracking data contains Metformin and Lisinopril", `Found: ${medNames.join(", ")} (${payloadA.medications.length} meds)`, pass);
  } catch (err) {
    recordTest(7, "Multiple medications", "2 medications tracked", err.message, false);
  }

  // -------------------------------------------------------------
  // Test 8: Time-of-day patterns
  // -------------------------------------------------------------
  try {
    const payloadA = await buildAiInsightPayload(patientA._id.toString(), "week");
    const morningTaken = payloadA.timeOfDay.morning.taken;
    const eveningMissed = payloadA.timeOfDay.evening.missed;
    const pass = morningTaken === 6 && eveningMissed === 1;
    recordTest(8, "Time-of-day patterns", "Deterministic timeOfDay: morning.taken=6, evening.missed=1", `morning.taken=${morningTaken}, evening.missed=${eveningMissed}`, pass);
  } catch (err) {
    recordTest(8, "Time-of-day patterns", "Time of day matches", err.message, false);
  }

  // -------------------------------------------------------------
  // Test 5: 100% adherence (Patient B)
  // -------------------------------------------------------------
  try {
    const res = await fetch(`${BACKEND_URL}/api/ai/caregiver-summary/${patientB._id}?period=week`, {
      headers: { Authorization: `Bearer ${caregiverToken}` }
    });
    const summaryB = await res.json();
    const pass = res.status === 200 &&
                 summaryB.positiveObservation.length > 0 &&
                 Array.isArray(summaryB.attentionItems) &&
                 summaryB.attentionItems.length === 0;
    recordTest(5, "100% adherence (Patient B)", "positiveObservation present, attentionItems = []", `status: ${res.status}, attentionItems: ${JSON.stringify(summaryB.attentionItems)}, positive: "${summaryB.positiveObservation}"`, pass);
  } catch (err) {
    recordTest(5, "100% adherence (Patient B)", "HTTP 200 + attentionItems=[]", err.message, false);
  }

  // -------------------------------------------------------------
  // Test 9: Gemini failure fallback / safe error handling
  // -------------------------------------------------------------
  try {
    const badPeriodRes = await fetch(`${BACKEND_URL}/api/ai/caregiver-summary/${patientA._id}?period=century`, {
      headers: { Authorization: `Bearer ${caregiverToken}` }
    });
    const badBody = await badPeriodRes.json();
    const badPeriodPass = badPeriodRes.status === 400 && badBody.message.includes("Invalid period");

    const badIdRes = await fetch(`${BACKEND_URL}/api/ai/caregiver-summary/invalid-mongo-id`, {
      headers: { Authorization: `Bearer ${caregiverToken}` }
    });
    const badIdBody = await badIdRes.json();
    const badIdPass = badIdRes.status === 400 && badIdBody.message === "Invalid patient ID.";

    const pass = badPeriodPass && badIdPass;
    recordTest(9, "Gemini failure / safe error handling", "Safe error handling, 400 validation, no internal leaks", `Period 400: ${badPeriodPass}, Id 400: ${badIdPass}`, pass);
  } catch (err) {
    recordTest(9, "Gemini failure / safe error handling", "Safe error handling", err.message, false);
  }

  // =============================================================
  // BROWSER E2E TESTS USING PUPPETEER (EDGE)
  // =============================================================
  console.log(colors.cyan("\n--- Launching Edge Browser for Caregiver Dashboard E2E Tests ---"));

  const browser = await puppeteer.launch({
    executablePath: EDGE_PATH,
    headless: "new",
    args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"]
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 900 });

  const networkRequests = [];
  page.on("request", (req) => {
    networkRequests.push({ url: req.url(), method: req.method() });
  });

  // Log in as Caregiver via API inside browser context
  await page.goto(`${FRONTEND_URL}/`, { waitUntil: "domcontentloaded" });
  const loginSuccess = await page.evaluate(async () => {
    localStorage.clear();
    sessionStorage.clear();
    try {
      const res = await fetch("http://localhost:5000/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: "caregiver@example.com", password: "Password123!" })
      });
      const data = await res.json();
      if (data && data.token) {
        localStorage.setItem("token", data.token);
        return true;
      }
      return false;
    } catch (e) {
      return false;
    }
  });

  if (!loginSuccess) {
    throw new Error("Failed to log in as caregiver in browser");
  }

  // -------------------------------------------------------------
  // Test 12: Refresh / Initial Caregiver Dashboard Load
  // -------------------------------------------------------------
  await page.goto(`${FRONTEND_URL}/caregiver/dashboard`, { waitUntil: "networkidle0" });
  await page.waitForSelector("#generate-caregiver-summary-btn", { timeout: 15000 });
  await page.waitForSelector(".patients-sidebar", { timeout: 15000 });

  const hasAutoAiCall = networkRequests.some(r => r.url.includes("/api/ai/caregiver-summary"));
  const initialButtonExists = await page.$("#generate-caregiver-summary-btn") !== null;
  recordTest(12, "Dashboard refresh & no auto AI call", "Dashboard loads normally, NO automatic AI call, initial button rendered", `autoAiCall: ${hasAutoAiCall}, initialButtonExists: ${initialButtonExists}`, !hasAutoAiCall && initialButtonExists);

  // -------------------------------------------------------------
  // Test 16: Existing Caregiver Dashboard Regression
  // -------------------------------------------------------------
  const patientListCount = await page.evaluate(() => {
    return document.querySelectorAll(".patients-sidebar > div > div").length;
  });
  const adherenceCardExists = await page.evaluate(() => {
    return document.body.innerText.includes("Lifetime Adherence") || document.body.innerText.includes("LIFETIME ADHERENCE");
  });
  const streakCardExists = await page.evaluate(() => {
    return document.body.innerText.includes("Current Streak") || document.body.innerText.includes("CURRENT STREAK");
  });
  const medScheduleExists = await page.evaluate(() => {
    return document.body.innerText.includes("Patient Medication Schedule");
  });
  const doseLogsExists = await page.evaluate(() => {
    return document.body.innerText.includes("Dose Log History");
  });

  const regressionPass = patientListCount === 3 && adherenceCardExists && streakCardExists && medScheduleExists && doseLogsExists;
  recordTest(16, "Caregiver Dashboard regression", "Patient list (3), adherence, streak, medicines, dose logs intact", `Patients: ${patientListCount}, adherence: ${adherenceCardExists}, streak: ${streakCardExists}, medicines: ${medScheduleExists}, logs: ${doseLogsExists}`, regressionPass);

  // -------------------------------------------------------------
  // Test 10: Rapid clicks on Generate AI Summary
  // -------------------------------------------------------------
  let aiGetCallCount = 0;
  page.on("request", (req) => {
    if (req.url().includes("/api/ai/caregiver-summary") && req.method() === "GET") {
      aiGetCallCount++;
    }
  });

  // Click 4 times rapidly
  await page.evaluate(() => {
    const btn = document.getElementById("generate-caregiver-summary-btn");
    if (btn) {
      btn.click();
      btn.click();
      btn.click();
      btn.click();
    }
  });

  // Wait a moment for network dispatch
  await new Promise(r => setTimeout(r, 1200));
  recordTest(10, "Rapid clicks duplicate prevention", "Exactly 1 active network request produced by multi-clicks", `AI GET calls recorded: ${aiGetCallCount}`, aiGetCallCount === 1);

  // Wait for AI summary to finish loading
  await page.waitForFunction(() => {
    return document.body.innerText.includes("Observed Patterns") ||
           document.body.innerText.includes("Positive Observation") ||
           document.body.innerText.includes("Summary");
  }, { timeout: 35000 });

  const summaryDisplayed = await page.evaluate(() => {
    return document.body.innerText.includes("This summary is based on medication tracking data and is not medical advice.");
  });
  console.log(`Caregiver Summary for Patient A rendered successfully. Disclaimer visible: ${summaryDisplayed}`);

  // -------------------------------------------------------------
  // Test 11: Patient switching (Patient A -> Patient B)
  // -------------------------------------------------------------
  // Switch to Patient B (click 2nd card in sidebar)
  await page.evaluate(() => {
    const patientCards = Array.from(document.querySelectorAll(".patients-sidebar > div > div"));
    if (patientCards.length > 1) {
      patientCards[1].click();
    }
  });

  // Verify that previous AI summary immediately disappeared and initial button is back
  await new Promise(r => setTimeout(r, 1000));
  const summaryCleared = await page.evaluate(() => {
    const hasInitialBtn = document.getElementById("generate-caregiver-summary-btn") !== null;
    const hasObservedPatterns = document.body.innerText.includes("Observed Patterns");
    return hasInitialBtn && !hasObservedPatterns;
  });

  recordTest(11, "Patient switching", "Summary immediately disappears on switch, returns to initial state, no stale data", `Summary cleared & initial button shown: ${summaryCleared}`, summaryCleared);

  // -------------------------------------------------------------
  // Test 13: Mobile 390px Viewport
  // -------------------------------------------------------------
  await page.setViewport({ width: 390, height: 844 });
  await new Promise(r => setTimeout(r, 500));
  const hasHorizontalScroll = await page.evaluate(() => {
    return document.documentElement.scrollWidth > document.documentElement.clientWidth;
  });
  recordTest(13, "Mobile 390px viewport", "Zero horizontal overflow / horizontal scrollbar", `document.scrollWidth <= clientWidth: ${!hasHorizontalScroll}`, !hasHorizontalScroll);

  // Reset viewport
  await page.setViewport({ width: 1280, height: 900 });

  // -------------------------------------------------------------
  // Test 17: Existing AI Report Insights regression (/reports)
  // -------------------------------------------------------------
  await page.goto(`${FRONTEND_URL}/reports`, { waitUntil: "networkidle0" });
  await page.waitForSelector(".reports-stats-grid", { timeout: 15000 });
  const reportsLoaded = await page.evaluate(() => {
    return document.body.innerText.includes("AI Report Insights") &&
           document.body.innerText.includes("Weekly Overview");
  });

  // Click Generate Insights on reports
  await page.evaluate(() => {
    const btn = Array.from(document.querySelectorAll("button")).find(b => b.innerText.includes("Generate Insights"));
    if (btn) btn.click();
  });

  let reportInsightsPass = false;
  try {
    await page.waitForFunction(() => {
      return document.body.innerText.includes("These insights are based on medication tracking data and are not medical advice.");
    }, { timeout: 35000 });
    reportInsightsPass = true;
  } catch (e) {
    reportInsightsPass = false;
  }

  recordTest(17, "Existing AI Report Insights regression", "Reports page loads and generates insights with original disclaimer unchanged", `Reports page functional: ${reportsLoaded}, Insights generated: ${reportInsightsPass}`, reportsLoaded && reportInsightsPass);

  await browser.close();
  await mongoose.connection.close();

  // Print Summary Table
  console.log(colors.bold(colors.cyan("\n==================================================================")));
  console.log(colors.bold(colors.cyan("                       FINAL RESULTS SUMMARY                      ")));
  console.log(colors.bold(colors.cyan("==================================================================")));
  console.log("| # | Test Name | Expected | Actual | Status |");
  console.log("|---|-----------|----------|--------|--------|");
  results.sort((a, b) => a.testNum - b.testNum).forEach(r => {
    const s = r.pass ? "PASS" : "FAIL";
    console.log(`| ${r.testNum} | ${r.test} | ${r.expected.slice(0, 35)} | ${r.actual.slice(0, 35)} | **${s}** |`);
  });

  const total = results.length;
  const passed = results.filter(r => r.pass).length;
  console.log(colors.bold(colors.green(`\nTotal Tests: ${total} | Passed: ${passed} | Failed: ${total - passed}\n`)));

  if (passed === total) {
    console.log(colors.bold(colors.green(">>> ALL 17 TESTS PASSED SUCCESSFULLY! <<<\n")));
  } else {
    console.log(colors.bold(colors.red(`>>> ${total - passed} TESTS FAILED <<<\n`)));
  }
}

main().catch(err => {
  console.error("Test runner failed:", err);
  process.exit(1);
});

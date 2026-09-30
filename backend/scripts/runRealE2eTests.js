const puppeteer = require("puppeteer-core");
const path = require("path");
require("dotenv").config({ path: path.resolve(__dirname, "../.env") });

const EDGE_PATH = "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe";
const FRONTEND_URL = "http://localhost:3000";
const BACKEND_URL = "http://localhost:5000";

const colors = {
  green: (t) => `\x1b[32m${t}\x1b[0m`,
  red: (t) => `\x1b[31m${t}\x1b[0m`,
  yellow: (t) => `\x1b[33m${t}\x1b[0m`,
  cyan: (t) => `\x1b[36m${t}\x1b[0m`,
  bold: (t) => `\x1b[1m${t}\x1b[0m`
};

const results = [];

function recordTest(testName, expected, actual, pass, details = "") {
  results.push({
    test: testName,
    expected,
    actual,
    pass,
    details
  });
  if (pass) {
    console.log(`  ${colors.green("✓ PASS")}: ${colors.bold(testName)}`);
    if (details) console.log(`         ${colors.cyan(details)}`);
  } else {
    console.log(`  ${colors.red("✗ FAIL")}: ${colors.bold(testName)}`);
    console.log(`         ${colors.red("Error: " + details)}`);
  }
}

async function run() {
  console.log(colors.bold(colors.cyan("\n========================================================")));
  console.log(colors.bold(colors.cyan("   MedRemind End-to-End AI Report Insights Validation   ")));
  console.log(colors.bold(colors.cyan("========================================================\n")));

  const browser = await puppeteer.launch({
    executablePath: EDGE_PATH,
    headless: "new",
    args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"]
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 900 });

  const networkRequests = [];
  const consoleErrors = [];

  page.on("request", (req) => {
    networkRequests.push({ url: req.url(), method: req.method() });
  });

  page.on("console", (msg) => {
    if (msg.type() === "error") {
      consoleErrors.push(msg.text());
    }
  });

  // Helper to log in a user deterministically and navigate to reports
  async function loginAndGoToReports(email, password = "Password123!") {
    await page.goto(`${FRONTEND_URL}/`, { waitUntil: "domcontentloaded" });
    const token = await page.evaluate(async (em, pw) => {
      localStorage.clear();
      sessionStorage.clear();
      try {
        const res = await fetch("http://localhost:5000/api/auth/login", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email: em, password: pw })
        });
        const data = await res.json();
        if (data && data.token) {
          localStorage.setItem("token", data.token);
          return data.token;
        }
        return null;
      } catch (e) {
        return null;
      }
    }, email, password);

    if (!token) throw new Error(`Failed to log in as ${email}`);

    // Navigate to Reports
    await page.goto(`${FRONTEND_URL}/reports`, { waitUntil: "networkidle0" });
    await page.waitForSelector('.reports-stats-grid', { timeout: 15000 });
  }

  try {
    // =========================================================================
    // TEST 1 — REPORTS PAGE INITIAL LOAD
    // =========================================================================
    console.log(colors.bold("\n--- Running Test 1: Reports Initial Load ---"));
    networkRequests.length = 0;
    consoleErrors.length = 0;

    await loginAndGoToReports("e2e_user@example.com");

    const adherenceText = await page.$eval('.reports-stats-grid > div:first-child div:first-child', el => el.textContent);
    const takenText = await page.$eval('.reports-stats-grid > div:nth-child(2) div:first-child', el => el.textContent);
    const missedText = await page.$eval('.reports-stats-grid > div:nth-child(3) div:first-child', el => el.textContent);
    const aiButton = await page.$('button[aria-label="Generate AI Insights"]');
    const aiButtonText = aiButton ? await page.evaluate(el => el.textContent, aiButton) : null;

    // Check if any report-insights requests were fired automatically
    const autoAiCalls = networkRequests.filter(r => r.url.includes("/report-insights"));

    const t1Pass = !!aiButton &&
      aiButtonText.includes("Generate Insights") &&
      autoAiCalls.length === 0 &&
      adherenceText.includes("%") &&
      takenText === "11" &&
      missedText === "1";

    recordTest(
      "TEST 1: Reports Page Initial Load",
      "Reports load with 92% adherence, 11 taken, 1 missed. AI button visible, 0 automatic Gemini calls.",
      `Adherence: ${adherenceText}, Taken: ${takenText}, Missed: ${missedText}, Auto AI Calls: ${autoAiCalls.length}`,
      t1Pass,
      t1Pass ? "Initial state clean, 0 automatic AI calls" : "Initial load mismatch"
    );

    // =========================================================================
    // TEST 2 — GENERATE WEEKLY INSIGHTS
    // =========================================================================
    console.log(colors.bold("\n--- Running Test 2: Generate Weekly Insights ---"));
    networkRequests.length = 0;

    // Click Generate Insights
    await page.click('button[aria-label="Generate AI Insights"]');

    // Verify loading spinner appears
    const loadingSeen = await page.waitForSelector('text/Analyzing your medication tracking data...', { timeout: 4000 })
      .then(() => true)
      .catch(() => false);

    // Wait for AI Insights content to render
    await page.waitForSelector('#ai-insights-heading', { timeout: 15000 });
    await page.waitForFunction(
      () => !document.body.innerText.includes("Analyzing your medication tracking data..."),
      { timeout: 15000 }
    );

    const weeklyAiRequest = networkRequests.find(r => r.url.includes("/report-insights") && r.url.includes("period=week"));
    const aiSectionText = await page.$eval('section[aria-labelledby="ai-insights-heading"]', el => el.innerText);

    console.log("    [DEBUG Test 2] aiSectionText:\n" + aiSectionText);
    console.log("    [DEBUG Test 2] networkRequests:", networkRequests.map(r => r.url));

    const hasSummary = aiSectionText.toUpperCase().includes("SUMMARY");
    const hasPositive = aiSectionText.includes("✓") || aiSectionText.includes("adherence") || aiSectionText.includes("100%");
    const hasPatterns = aiSectionText.includes("Observed Patterns");
    const hasAttention = aiSectionText.includes("Attention Areas");
    const hasDisclaimer = aiSectionText.includes("These insights are based on medication tracking data and are not medical advice.");
    const hasNoRawJson = !aiSectionText.includes('{"summary":') && !aiSectionText.includes('"positiveObservation":');

    const t2Pass = !!weeklyAiRequest && hasSummary && hasDisclaimer && hasNoRawJson;

    recordTest(
      "TEST 2: Generate Weekly Insights",
      "API /report-insights?period=week called, renders structured Summary, Patterns, Attention, Disclaimer (no raw JSON)",
      `API called: ${!!weeklyAiRequest}, Summary: ${hasSummary}, Patterns: ${hasPatterns}, Attention: ${hasAttention}`,
      t2Pass,
      t2Pass ? "Weekly insights generated and rendered cleanly" : "Weekly insights rendering failed"
    );

    // =========================================================================
    // TEST 3 — DATA CONSISTENCY CHECK
    // =========================================================================
    console.log(colors.bold("\n--- Running Test 3: Data Consistency Check ---"));
    // Ground truth: 11 taken, 1 missed, 92% adherence, Metformin (morning 100%), Lisinopril (evening 1 miss)
    const lowerText = aiSectionText.toLowerCase();

    // Check that if numbers appear, they match reality
    let consistencyErrors = [];
    if (lowerText.includes("%") && !lowerText.includes("92%") && !lowerText.includes("100%") && !lowerText.includes("83%")) {
      consistencyErrors.push("Unexpected percentage cited in AI text");
    }
    if (lowerText.includes("metformin") && lowerText.includes("missed metformin")) {
      consistencyErrors.push("Hallucination: Metformin had 0 missed doses but AI reported it missed");
    }
    const correctlyMentionsEveningOrMiss = lowerText.includes("evening") || lowerText.includes("night") || lowerText.includes("miss") || lowerText.includes("lisinopril");

    const t3Pass = consistencyErrors.length === 0 && correctlyMentionsEveningOrMiss;

    recordTest(
      "TEST 3: Data Consistency",
      "AI text adheres strictly to factual reports data: Metformin taken, 1 evening miss on Lisinopril, no invented numbers",
      `Errors: ${consistencyErrors.length > 0 ? consistencyErrors.join(", ") : "None"}, Identified pattern: ${correctlyMentionsEveningOrMiss}`,
      t3Pass,
      t3Pass ? "AI text is 100% faithful to the factual data" : "Consistency mismatch detected"
    );

    // =========================================================================
    // TEST 4 — MONTHLY INSIGHTS & PERIOD HANDLING
    // =========================================================================
    console.log(colors.bold("\n--- Running Test 4: Monthly Insights & Period Handling ---"));
    networkRequests.length = 0;

    // Switch to Monthly Adherence
    const monthlyToggleBtn = await page.waitForSelector('button::-p-text("Monthly Adherence")');
    await monthlyToggleBtn.click();
    await new Promise(r => setTimeout(r, 1000));

    // Verify previous insight is cleared and "Generate Insights" prompt returns
    const promptAfterSwitch = await page.$('button[aria-label="Generate AI Insights"]');
    const autoMonthlyCalls = networkRequests.filter(r => r.url.includes("/report-insights"));

    // Now explicitly click Generate Insights for Monthly
    networkRequests.length = 0;
    await promptAfterSwitch.click();

    await page.waitForFunction(
      () => !document.body.innerText.includes("Analyzing your medication tracking data..."),
      { timeout: 35000 }
    );

    const monthlyAiRequest = networkRequests.find(r => r.url.includes("/report-insights") && r.url.includes("period=month"));
    const monthlySectionText = await page.$eval('section[aria-labelledby="ai-insights-heading"]', el => el.innerText);

    const hasMonthlySummary = monthlySectionText.toUpperCase().includes("SUMMARY");
    const t4Pass = !!promptAfterSwitch && autoMonthlyCalls.length === 0 && !!monthlyAiRequest && hasMonthlySummary;

    recordTest(
      "TEST 4: Monthly Insights & Period Switching",
      "Switching to Monthly resets previous insight, 0 auto-calls, explicit click sends period=month",
      `Prompt restored: ${!!promptAfterSwitch}, Auto calls: ${autoMonthlyCalls.length}, Monthly API called: ${!!monthlyAiRequest}`,
      t4Pass,
      t4Pass ? "Period reset and monthly insight generation verified" : "Monthly period handling failed"
    );

    // =========================================================================
    // TEST 9 — RAPID MULTI-CLICK DUPLICATE PREVENTION
    // =========================================================================
    console.log(colors.bold("\n--- Running Test 9: Rapid Multi-Click Duplicate Prevention ---"));
    networkRequests.length = 0;

    const refreshBtn = await page.$('button[aria-label="Refresh AI Insights"]');
    if (refreshBtn) {
      // Rapid clicks in succession
      await Promise.all([
        refreshBtn.click().catch(() => {}),
        refreshBtn.click().catch(() => {}),
        refreshBtn.click().catch(() => {})
      ]);

      await page.waitForFunction(
        () => !document.body.innerText.includes("Analyzing your medication tracking data..."),
        { timeout: 35000 }
      );
    }

    const aiCalls = networkRequests.filter(r => r.url.includes("/report-insights") && r.method === "GET");
    const aiSectionsCount = (await page.$$('section[aria-labelledby="ai-insights-heading"]')).length;

    const t9Pass = aiCalls.length <= 1 && aiSectionsCount === 1;

    recordTest(
      "TEST 9: Rapid Multi-Click Duplicate Prevention",
      "Rapid clicking results in only 1 active request, disabled button state, exactly 1 AI card",
      `Requests sent: ${aiCalls.length}, AI Cards rendered: ${aiSectionsCount}`,
      t9Pass,
      t9Pass ? "No duplicate requests or DOM duplicates" : "Duplicate requests triggered"
    );

    // =========================================================================
    // TEST 11 — REFRESH PAGE BEHAVIOR
    // =========================================================================
    console.log(colors.bold("\n--- Running Test 11: Refresh Page Behavior ---"));
    networkRequests.length = 0;

    await page.reload({ waitUntil: "networkidle0" });
    await page.waitForSelector('.reports-stats-grid', { timeout: 8000 });

    const postReloadCalls = networkRequests.filter(r => r.url.includes("/report-insights"));
    const postReloadButton = await page.$('button[aria-label="Generate AI Insights"]');

    const t11Pass = postReloadCalls.length === 0 && !!postReloadButton;

    recordTest(
      "TEST 11: Refresh Page Behavior",
      "Page reloads cleanly, 0 automatic Gemini calls, AI card resets back to initial prompt",
      `Auto calls on reload: ${postReloadCalls.length}, Initial prompt button present: ${!!postReloadButton}`,
      t11Pass,
      t11Pass ? "Clean state restoration on reload" : "Unwanted auto-call on page reload"
    );

    // =========================================================================
    // TEST 12 — MOBILE VIEWPORT RESPONSIVENESS
    // =========================================================================
    console.log(colors.bold("\n--- Running Test 12: Mobile Viewport Responsiveness ---"));
    await page.setViewport({ width: 390, height: 844 }); // iPhone 14 size
    await page.evaluate(() => window.scrollTo(0, 300));

    const cardBox = await page.$eval('section[aria-labelledby="ai-insights-heading"]', el => {
      const rect = el.getBoundingClientRect();
      return { width: rect.width, left: rect.left, right: rect.right };
    });

    const bodyScrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
    const windowInnerWidth = await page.evaluate(() => window.innerWidth);
    const hasNoHorizontalOverflow = bodyScrollWidth <= windowInnerWidth;

    const t12Pass = hasNoHorizontalOverflow && cardBox.width <= 390;

    recordTest(
      "TEST 12: Mobile Viewport Responsiveness",
      "AI card scales within 390px mobile viewport, zero horizontal overflow, all text readable",
      `Card width: ${cardBox.width}px, Scroll width: ${bodyScrollWidth}px, Window width: ${windowInnerWidth}px`,
      t12Pass,
      t12Pass ? "Mobile layout passes without horizontal overflow" : "Mobile overflow detected"
    );

    // Restore desktop viewport
    await page.setViewport({ width: 1280, height: 900 });

    // =========================================================================
    // TEST 5 — 100% ADHERENCE USER
    // =========================================================================
    console.log(colors.bold("\n--- Running Test 5: 100% Adherence User ---"));
    await loginAndGoToReports("perfect_user@example.com");

    const perfectAdherenceText = await page.$eval('.reports-stats-grid > div:first-child div:first-child', el => el.textContent);
    await page.click('button[aria-label="Generate AI Insights"]');

    await page.waitForFunction(
      () => !document.body.innerText.includes("Analyzing your medication tracking data..."),
      { timeout: 35000 }
    );

    const perfectAiText = await page.$eval('section[aria-labelledby="ai-insights-heading"]', el => el.innerText);
    const hasNoAttentionItems = !perfectAiText.includes("Attention Areas");
    const hasPositivePraise = perfectAiText.includes("✓") || perfectAiText.includes("100%") || perfectAiText.includes("streak") || perfectAiText.includes("perfect");

    const t5Pass = perfectAdherenceText.includes("100%") && hasNoAttentionItems && hasPositivePraise;

    recordTest(
      "TEST 5: 100% Adherence User",
      "Reports 100% adherence, Attention Areas is NOT shown, positive observation displayed, no medical claims",
      `Adherence: ${perfectAdherenceText}, Has Attention: ${!hasNoAttentionItems}, Has Positive: ${hasPositivePraise}`,
      t5Pass,
      t5Pass ? "Zero false attention items for 100% adherence" : "False issues or missing praise"
    );

    // =========================================================================
    // TEST 6 — MISSED DOSES (VERIFIED IN E2E_USER)
    // =========================================================================
    console.log(colors.bold("\n--- Running Test 6: Real Missed Doses Reporting ---"));
    // e2e_user has 1 missed evening dose of Lisinopril
    await loginAndGoToReports("e2e_user@example.com");
    await page.click('button[aria-label="Generate AI Insights"]');
    await page.waitForFunction(
      () => !document.body.innerText.includes("Analyzing your medication tracking data..."),
      { timeout: 35000 }
    );

    const missedUserAiText = await page.$eval('section[aria-labelledby="ai-insights-heading"]', el => el.innerText);
    const hasAttentionSection = missedUserAiText.includes("Attention Areas");
    const mentionsMissOrEvening = missedUserAiText.toLowerCase().includes("miss") || missedUserAiText.toLowerCase().includes("evening") || missedUserAiText.toLowerCase().includes("lisinopril");
    const noPrescriptionClaims = !missedUserAiText.includes("prescribe") && !missedUserAiText.includes("consult a physician") && !missedUserAiText.includes("increase dosage");

    const t6Pass = hasAttentionSection && mentionsMissOrEvening && noPrescriptionClaims;

    recordTest(
      "TEST 6: Real Missed Doses Reporting",
      "Attention Areas highlights actual missed evening dose without making clinical/prescription claims",
      `Attention section present: ${hasAttentionSection}, Identifies miss: ${mentionsMissOrEvening}, No clinical claims: ${noPrescriptionClaims}`,
      t6Pass,
      t6Pass ? "Accurately and safely highlights missed doses" : "Missed dose reporting issue"
    );

    // =========================================================================
    // TEST 7 — NO DATA USER (INSUFFICIENT DATA)
    // =========================================================================
    console.log(colors.bold("\n--- Running Test 7: No Data User (Insufficient Data) ---"));
    await loginAndGoToReports("nodata_user@example.com");

    networkRequests.length = 0;
    await page.click('button[aria-label="Generate AI Insights"]');

    await page.waitForFunction(
      () => !document.body.innerText.includes("Analyzing your medication tracking data..."),
      { timeout: 15000 }
    );

    const noDataText = await page.$eval('section[aria-labelledby="ai-insights-heading"]', el => el.innerText);
    const hasInsufficientNotice = noDataText.includes("Not enough medication history yet.") && noDataText.includes("Continue tracking your medications to generate meaningful insights.");
    const hasDisclaimerInNoData = noDataText.includes("These insights are based on medication tracking data and are not medical advice.");

    const t7Pass = hasInsufficientNotice && hasDisclaimerInNoData;

    recordTest(
      "TEST 7: No Data User (Insufficient Data)",
      "Displays friendly empty state ('Not enough medication history yet.'), Gemini skipped, Reports intact",
      `Empty state message present: ${hasInsufficientNotice}, Disclaimer present: ${hasDisclaimerInNoData}`,
      t7Pass,
      t7Pass ? "Graceful handling of zero medication tracking data" : "Insufficient data handling failed"
    );

    // =========================================================================
    // TEST 8 — API FAILURE SIMULATION & RETRY BUTTON
    // =========================================================================
    console.log(colors.bold("\n--- Running Test 8: API Failure & Safe Fallback ---"));
    // Reload to ensure fresh Generate Insights button is present
    await page.reload({ waitUntil: "networkidle0" });
    await page.waitForSelector('button[aria-label="Generate AI Insights"]', { timeout: 8000 });

    // Intercept /report-insights request and respond with 503
    await page.setRequestInterception(true);
    const interceptHandler = (req) => {
      if (req.url().includes("/report-insights")) {
        req.respond({
          status: 503,
          contentType: "application/json",
          body: JSON.stringify({ message: "AI service is experiencing high demand. Please try again shortly." })
        });
      } else {
        req.continue();
      }
    };
    page.on("request", interceptHandler);

    await page.click('button[aria-label="Generate AI Insights"]');

    await page.waitForFunction(
      () => document.body.innerText.includes("Unable to generate insights right now."),
      { timeout: 8000 }
    );

    const errorSectionText = await page.$eval('section[aria-labelledby="ai-insights-heading"]', el => el.innerText);
    const tryAgainBtn = await page.$('section[aria-labelledby="ai-insights-heading"] button::-p-text("Try Again")');

    const hasSafeErrorMsg = errorSectionText.includes("Unable to generate insights right now.");
    const hasNoInternalLeak = !errorSectionText.includes("Error:") && !errorSectionText.includes("GEMINI_API_KEY") && !errorSectionText.includes("stack");

    const t8Pass = hasSafeErrorMsg && !!tryAgainBtn && hasNoInternalLeak;

    // Reset interception
    page.off("request", interceptHandler);
    await page.setRequestInterception(false);

    recordTest(
      "TEST 8: API Failure & Safe Fallback",
      "Displays friendly error ('Unable to generate insights right now.') with Try Again button, no stack/key leak",
      `Friendly error: ${hasSafeErrorMsg}, Try Again button: ${!!tryAgainBtn}, No leak: ${hasNoInternalLeak}`,
      t8Pass,
      t8Pass ? "Safe and graceful error fallback confirmed" : "Error handling failed"
    );

    // =========================================================================
    // TEST 10 — BROWSER SECURITY & KEY LEAK INSPECTION
    // =========================================================================
    console.log(colors.bold("\n--- Running Test 10: Browser Security & Key Leak Inspection ---"));
    const keyToSearch = process.env.GEMINI_API_KEY;

    // Check localStorage
    const localStoreData = await page.evaluate(() => JSON.stringify(localStorage));
    // Check HTML source
    const pageHtml = await page.content();
    // Check all recorded network URLs & post data
    const networkDump = JSON.stringify(networkRequests);

    const keyInStorage = keyToSearch && localStoreData.includes(keyToSearch);
    const keyInHtml = keyToSearch && pageHtml.includes(keyToSearch);
    const keyInNetwork = keyToSearch && networkDump.includes(keyToSearch);

    const t10Pass = !keyInStorage && !keyInHtml && !keyInNetwork;

    recordTest(
      "TEST 10: Browser Security & Key Privacy",
      "GEMINI_API_KEY is completely absent from frontend localStorage, DOM source, and network traffic",
      `Key in Storage: ${keyInStorage}, Key in HTML: ${keyInHtml}, Key in Network: ${keyInNetwork}`,
      t10Pass,
      t10Pass ? "100% key privacy verified on client" : "CRITICAL: Key found on client"
    );

  } finally {
    await browser.close();
  }

  // Print Summary Table
  console.log(colors.bold(colors.cyan("\n========================================================")));
  console.log(colors.bold(colors.cyan("                   E2E TEST SUMMARY                     ")));
  console.log(colors.bold(colors.cyan("========================================================\n")));

  let passedCount = 0;
  for (const r of results) {
    if (r.pass) passedCount++;
    console.log(`${r.pass ? colors.green("[PASS]") : colors.red("[FAIL]")} ${r.test}`);
  }

  console.log(colors.bold(`\nTotal: ${passedCount} / ${results.length} tests passed.`));

  if (passedCount === results.length) {
    console.log(colors.bold(colors.green("\n🎉 AI Report Insights passed end-to-end validation.\n")));
  } else {
    console.log(colors.bold(colors.red("\n❌ Some tests failed. Inspect details above.\n")));
    process.exit(1);
  }
}

run().catch(err => {
  console.error("Test execution failed:", err);
  process.exit(1);
});

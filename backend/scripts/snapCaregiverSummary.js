const puppeteer = require("puppeteer-core");
const path = require("path");

const EDGE_PATH = "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe";
const FRONTEND_URL = "http://localhost:3000";

async function snap() {
  const browser = await puppeteer.launch({
    executablePath: EDGE_PATH,
    headless: "new",
    args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"]
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 950 });

  await page.goto(`${FRONTEND_URL}/`, { waitUntil: "domcontentloaded" });
  await page.evaluate(async () => {
    localStorage.clear();
    const res = await fetch("http://localhost:5000/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "caregiver@example.com", password: "Password123!" })
    });
    const data = await res.json();
    localStorage.setItem("token", data.token);
  });

  await page.goto(`${FRONTEND_URL}/caregiver/dashboard`, { waitUntil: "networkidle0" });
  await page.waitForSelector("#generate-caregiver-summary-btn", { timeout: 15000 });

  // Click generate
  await page.click("#generate-caregiver-summary-btn");

  // Wait for AI summary to complete and render disclaimer
  await page.waitForFunction(() => {
    return document.body.innerText.includes("This summary is based on medication tracking data and is not medical advice.");
  }, { timeout: 35000 });

  const artifactPath = "C:\\Users\\DELL\\.gemini\\antigravity-ide\\brain\\cfbd9adf-5ff4-4221-aa53-61ab6ebc09fb\\caregiver_ai_summary.png";
  await page.screenshot({ path: artifactPath, fullPage: true });
  console.log("Screenshot saved to:", artifactPath);

  await browser.close();
}

snap().catch(err => {
  console.error("Screenshot failed:", err);
  process.exit(1);
});

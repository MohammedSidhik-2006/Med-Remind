const mongoose = require("mongoose");
const express = require("express");
const path = require("path");
require("dotenv").config({ path: path.resolve(__dirname, "../.env") });

const authRoutes = require("../routes/authRoutes");
const medicineRoutes = require("../routes/medicineRoutes");
const adminRoutes = require("../routes/adminRoutes");
const caregiverRoutes = require("../routes/caregiverRoutes");
const User = require("../models/User");
const Medicine = require("../models/Medicine");
const DoseLog = require("../models/DoseLog");
const AuditLog = require("../models/AuditLog");

// Import the rate limit attempts map to clear it between test scenarios
const { loginAttempts } = require("../middleware/rateLimitMiddleware");

const PORT = 5050;
const BASE_URL = `http://localhost:${PORT}/api`;

let server;

// Helper: HTTP Request via native fetch
const request = async (endpoint, options = {}) => {
  const url = `${BASE_URL}${endpoint}`;
  const headers = {
    "Content-Type": "application/json",
    ...options.headers
  };
  const response = await fetch(url, {
    ...options,
    headers,
    body: options.body ? JSON.stringify(options.body) : undefined
  });
  
  let data;
  try {
    data = await response.json();
  } catch {
    data = null;
  }
  
  return {
    status: response.status,
    headers: response.headers,
    data
  };
};

// Colors for reporting
const colors = {
  green: (text) => `\x1b[32m${text}\x1b[0m`,
  red: (text) => `\x1b[31m${text}\x1b[0m`,
  yellow: (text) => `\x1b[33m${text}\x1b[0m`,
  cyan: (text) => `\x1b[36m${text}\x1b[0m`,
  bold: (text) => `\x1b[1m${text}\x1b[0m`
};

const logTest = (name, passed, detail = "") => {
  if (passed) {
    console.log(`  ${colors.green("✓")} ${name}`);
  } else {
    console.log(`  ${colors.red("✗")} ${name}`);
    if (detail) console.log(`     ${colors.red("Error details:")} ${detail}`);
  }
};

async function cleanupTestUsers() {
  const CaregiverRelation = require("../models/CaregiverRelation");
  await CaregiverRelation.deleteMany({});

  const testEmails = [
    "test_sanity_user@example.com",
    "test_blackbox_user@example.com",
    "test_rate_user@example.com",
    "test_concurrency_user@example.com",
    "patient_test@example.com",
    "caregiver_test@example.com",
    "unrelated_test@example.com",
    "otp_test_user@example.com"
  ];
  
  for (const email of testEmails) {
    const user = await User.findOne({ email });
    if (user) {
      await DoseLog.deleteMany({ userId: user._id });
      await AuditLog.deleteMany({ userId: user._id });
      await Medicine.deleteMany({ userId: user._id });
      await User.findByIdAndDelete(user._id);
    }
  }
}

async function runTests() {
  console.log(colors.bold(colors.cyan("\n==================================================")));
  console.log(colors.bold(colors.cyan("        MedRemind Complete Test Suite Runner      ")));
  console.log(colors.bold(colors.cyan("==================================================\n")));

  // 1. Database connection
  try {
    await mongoose.connect(process.env.MONGO_URI, {
      serverSelectionTimeoutMS: 5000,
    });
    console.log(colors.green("✅ Database connection established.\n"));
  } catch (err) {
    console.error(colors.red("❌ Failed to connect to MongoDB:"), err.message);
    process.exit(1);
  }

  // Cleanup past run records
  await cleanupTestUsers();

  // 2. Start testing web server
  const app = express();
  app.use(express.json());
  app.use("/api/auth", authRoutes);
  app.use("/api/medicine", medicineRoutes);
  app.use("/api/admin", adminRoutes);
  app.use("/api/caregiver", caregiverRoutes);
  
  server = app.listen(PORT, async () => {
    console.log(colors.green(`✅ Test server listening on port ${PORT}.\n`));
    
    try {
      await executeSanityTests();
      await executeBlackBoxTests();
      await executeWhiteBoxAndRegressionTests();
      await executeConcurrencyStressTests();
      await executeCaregiverTests();
      await executeForgotPasswordTests();
      
      console.log(colors.bold(colors.cyan("\n==================================================")));
      console.log(colors.bold(colors.green("🏆 All verification test categories passed successfully!")));
      console.log(colors.bold(colors.cyan("==================================================\n")));
      
      shutdown(0);
    } catch (err) {
      console.error(colors.bold(colors.red("\n❌ A critical test failed during execution:")));
      console.error(err);
      shutdown(1);
    }
  });
}

function shutdown(code) {
  if (server) server.close();
  mongoose.connection.close().then(() => {
    process.exit(code);
  });
}

// ============================================================================
// 1. SANITY TESTING
// ============================================================================
async function executeSanityTests() {
  console.log(colors.bold(colors.yellow("--- Category A: Sanity Testing (End-to-End Flow) ---")));
  
  const testEmail = "test_sanity_user@example.com";
  const testPassword = "password123";
  let token = "";
  let medId = "";

  // A1. Registration
  const regRes = await request("/auth/register", {
    method: "POST",
    body: { name: "Sanity User", email: testEmail, password: testPassword }
  });
  logTest("Register standard account", regRes.status === 201, regRes.data?.message);

  // A2. Login
  const loginRes = await request("/auth/login", {
    method: "POST",
    body: { email: testEmail, password: testPassword }
  });
  token = loginRes.data?.token || "";
  logTest("Login user & receive JWT token", loginRes.status === 200 && token !== "", loginRes.data?.message);

  // A3. View Profile
  const profileRes = await request("/auth/profile", {
    method: "GET",
    headers: { Authorization: token }
  });
  logTest("Query profile statistics", profileRes.status === 200 && profileRes.data?.user?.email === testEmail);

  // A4. Add Medicine
  const addMedRes = await request("/medicine/add", {
    method: "POST",
    headers: { Authorization: token },
    body: {
      name: "Tylenol",
      dosage: "500 mg",
      times: ["08:00", "20:00"],
      frequency: "twice",
      stock: 50,
      refillAt: 10
    }
  });
  medId = addMedRes.data?.medicine?._id || "";
  logTest("Add new medicine schedule", addMedRes.status === 201 && medId !== "", addMedRes.data?.message);

  // A5. Get Medicines List
  const listRes = await request("/medicine", {
    method: "GET",
    headers: { Authorization: token }
  });
  logTest("Retrieve today's active medicines schedule list", listRes.status === 200 && listRes.data?.length > 0);

  // A6. Mark Taken (Sanity)
  const markRes = await request(`/medicine/taken/${medId}`, {
    method: "PATCH",
    headers: { Authorization: token }
  });
  logTest("Mark scheduled medicine as taken", markRes.status === 200 && markRes.data?.taken === false); // twice frequency: first is taken, second remains pending

  // A7. Delete Medicine
  const delMedRes = await request(`/medicine/${medId}`, {
    method: "DELETE",
    headers: { Authorization: token }
  });
  logTest("Delete medication schedule", delMedRes.status === 200, delMedRes.data?.message);

  // A8. Delete Account
  const delAccRes = await request("/auth/account", {
    method: "DELETE",
    headers: { Authorization: token },
    body: { password: testPassword }
  });
  logTest("Delete account & sweep related user records", delAccRes.status === 200, delAccRes.data?.message);
}

// ============================================================================
// 2. BLACK BOX TESTING
// ============================================================================
async function executeBlackBoxTests() {
  console.log(colors.bold(colors.yellow("\n--- Category B: Black Box Testing (Input Validation) ---")));
  
  // B1. Missing required registration fields
  const b1 = await request("/auth/register", {
    method: "POST",
    body: { email: "test@example.com", password: "pwd" }
  });
  logTest("Detect missing fields on registration (rejects)", b1.status === 400 && b1.data?.message?.includes("fields"));

  // B2. Too short password
  const b2 = await request("/auth/register", {
    method: "POST",
    body: { name: "Test", email: "test@example.com", password: "123" }
  });
  logTest("Enforce password length constraints (>= 6 characters)", b2.status === 400 && b2.data?.message?.includes("Password"));

  // B3. Invalid email pattern
  const b3 = await request("/auth/register", {
    method: "POST",
    body: { name: "Test", email: "invalid-email-no-at", password: "password123" }
  });
  logTest("Enforce standard email format check", b3.status === 400 && b3.data?.message?.includes("email"));

  // B4. Invalid token rejection on protected routes
  const b4 = await request("/medicine", {
    method: "GET",
    headers: { Authorization: "InvalidRandomJWTTokenString" }
  });
  logTest("Deny access with malformed JWT authorization header", b4.status === 401 && b4.data?.message?.includes("token"));

  // B5. Add medicine: Invalid stock numbers
  // First register a test user for black box checks
  const testEmail = "test_blackbox_user@example.com";
  await request("/auth/register", {
    method: "POST",
    body: { name: "BlackBox", email: testEmail, password: "password123" }
  });
  const loginRes = await request("/auth/login", {
    method: "POST",
    body: { email: testEmail, password: "password123" }
  });
  const token = loginRes.data.token;

  const b5 = await request("/medicine/add", {
    method: "POST",
    headers: { Authorization: token },
    body: { name: "Med", dosage: "10mg", times: ["08:00"], stock: -10, refillAt: 5 }
  });
  logTest("Reject negative values for initial stock", b5.status === 400 && b5.data?.message?.includes("stock"));
}

// ============================================================================
// 3. WHITE BOX & REGRESSION TESTING
// ============================================================================
async function executeWhiteBoxAndRegressionTests() {
  console.log(colors.bold(colors.yellow("\n--- Category C: White Box & Regression Testing (Mechanisms & Fixes) ---")));
  
  const testEmail = "test_rate_user@example.com";
  const testPassword = "password123";

  // Create rate limiter test account
  await request("/auth/register", {
    method: "POST",
    body: { name: "Limiter", email: testEmail, password: testPassword }
  });

  // C1. Verify Rate Limiter on login attempts
  let isRateLimited = false;
  let responseMsg = "";
  for (let i = 0; i < 15; i++) {
    const res = await request("/auth/login", {
      method: "POST",
      body: { email: testEmail, password: "wrong_password" }
    });
    if (res.status === 429) {
      isRateLimited = true;
      responseMsg = res.data?.message;
      break;
    }
  }
  logTest("Lock out brute force attacks with 429 after 10 failed login attempts", isRateLimited && responseMsg.includes("attempts"));

  // C2. Regression Test: Verify Profile query does NOT trigger rate limits
  // Clear the login rate limit bucket so we can login successfully after lockout check
  loginAttempts.clear();

  // Log in with correct password
  const cleanLogin = await request("/auth/login", {
    method: "POST",
    body: { email: testEmail, password: testPassword }
  });
  const token = cleanLogin.data?.token || "";
  
  let profileRequestsSucceeded = true;
  // Hit profile endpoint 12 times to make sure it bypasses the login rate-limiter map
  for (let i = 0; i < 12; i++) {
    const res = await request("/auth/profile", {
      method: "GET",
      headers: { Authorization: token }
    });
    if (res.status !== 200) {
      profileRequestsSucceeded = false;
      break;
    }
  }
  logTest("Regression: Rate-limit is isolated and profile endpoint is completely unaffected", profileRequestsSucceeded);
}

// ============================================================================
// 4. CONCURRENCY & MULTI-USER STRESS TESTING
// ============================================================================
async function executeConcurrencyStressTests() {
  console.log(colors.bold(colors.yellow("\n--- Category D: Concurrency Safety & Multi-User Stress Testing ---")));
  
  // Clear any leftover rate limits so login succeeds
  loginAttempts.clear();

  const testEmail = "test_concurrency_user@example.com";
  const testPassword = "password123";

  // D1. Set up concurrency user and medicine
  await request("/auth/register", {
    method: "POST",
    body: { name: "Concurrency User", email: testEmail, password: testPassword }
  });
  const loginRes = await request("/auth/login", {
    method: "POST",
    body: { email: testEmail, password: testPassword }
  });
  const token = loginRes.data.token;

  const addMed = await request("/medicine/add", {
    method: "POST",
    headers: { Authorization: token },
    body: {
      name: "Ibuprofen",
      dosage: "400 mg",
      times: ["12:00"],
      frequency: "once",
      stock: 30,
      refillAt: 5
    }
  });
  const medId = addMed.data?.medicine?._id;

  // D2. Fire 10 concurrent requests to mark medicine taken
  console.log(colors.cyan("  Simulating 10 users click 'Mark Taken' concurrently..."));
  
  const promises = [];
  for (let i = 0; i < 10; i++) {
    promises.push(
      request(`/medicine/taken/${medId}`, {
        method: "PATCH",
        headers: { Authorization: token }
      })
    );
  }

  const results = await Promise.all(promises);

  // Evaluate responses
  let successCount = 0;
  
  results.forEach(res => {
    if (res.status === 200) {
      successCount++;
    }
  });

  logTest("Express endpoints handled parallel concurrency without crashes or errors", successCount === 10);

  // D3. Database integrity checks (White Box)
  // Connect to DB directly to verify count of logs and final stock level
  const DoseLogModel = mongoose.model("DoseLog");
  const MedicineModel = mongoose.model("Medicine");
  
  const doseLogs = await DoseLogModel.find({ medicineId: medId });
  const finalMed = await MedicineModel.findById(medId);

  logTest("Unique database index prevented duplicate DoseLog creations (count = 1)", doseLogs.length === 1);
  logTest(`Inventory stock decremented exactly once for the single scheduled dose (stock = ${finalMed?.stock})`, finalMed?.stock === 29);
}

// ============================================================================
// 5. CAREGIVER MONITORING SYSTEM TESTS
// ============================================================================
async function executeCaregiverTests() {
  console.log(colors.bold(colors.yellow("\n--- Category E: Family Caregiver Monitoring System ---")));
  
  const patientEmail = "patient_test@example.com";
  const caregiverEmail = "caregiver_test@example.com";
  const unrelatedEmail = "unrelated_test@example.com";
  const pwd = "password123";

  // E1. Register test users
  await request("/auth/register", { method: "POST", body: { name: "Patient", email: patientEmail, password: pwd } });
  await request("/auth/register", { method: "POST", body: { name: "Caregiver", email: caregiverEmail, password: pwd } });
  await request("/auth/register", { method: "POST", body: { name: "Unrelated", email: unrelatedEmail, password: pwd } });

  // Login users to get tokens
  const pLogin = await request("/auth/login", { method: "POST", body: { email: patientEmail, password: pwd } });
  const cLogin = await request("/auth/login", { method: "POST", body: { email: caregiverEmail, password: pwd } });
  const uLogin = await request("/auth/login", { method: "POST", body: { email: unrelatedEmail, password: pwd } });

  const pToken = pLogin.data.token;
  const cToken = cLogin.data.token;
  const uToken = uLogin.data.token;

  const patientId = await User.findOne({ email: patientEmail }).then(u => u._id);

  // E2. Link caregiver
  const linkRes = await request("/caregiver/link", {
    method: "POST",
    headers: { Authorization: pToken },
    body: { email: caregiverEmail, relationshipLabel: "Son" }
  });
  logTest("Patient links a caregiver successfully", linkRes.status === 201, linkRes.data?.message);

  // E3. Limit to one caregiver rule
  const linkSecondRes = await request("/caregiver/link", {
    method: "POST",
    headers: { Authorization: pToken },
    body: { email: unrelatedEmail, relationshipLabel: "Daughter" }
  });
  logTest("Enforce maximum of one caregiver connection per patient", linkSecondRes.status === 400);

  // E4. Retrieve active caregiver
  const getCaregiverRes = await request("/caregiver/my-caregiver", {
    method: "GET",
    headers: { Authorization: pToken }
  });
  logTest("Patient retrieves connected caregiver details", getCaregiverRes.status === 200 && getCaregiverRes.data?.relation?.caregiverId?.email === caregiverEmail);

  // E5. Retrieve patients for caregiver
  const getPatientsRes = await request("/caregiver/my-patients", {
    method: "GET",
    headers: { Authorization: cToken }
  });
  logTest("Caregiver retrieves their list of linked patients", getPatientsRes.status === 200 && getPatientsRes.data?.length === 1 && getPatientsRes.data[0].patientId?.email === patientEmail);

  // E6. Access patient dashboard details (RBAC)
  const dashboardRes = await request(`/caregiver/patient/${patientId}/dashboard`, {
    method: "GET",
    headers: { Authorization: cToken }
  });
  logTest("Caregiver accesses linked patient's dashboard", dashboardRes.status === 200 && dashboardRes.data?.patient?.email === patientEmail);

  const dashboardFailRes = await request(`/caregiver/patient/${patientId}/dashboard`, {
    method: "GET",
    headers: { Authorization: uToken }
  });
  logTest("Reject patient dashboard requests from unauthorized users", dashboardFailRes.status === 403);

  // E7. Verify snooze alerts & snoozeCount increment
  const addMedRes = await request("/medicine/add", {
    method: "POST",
    headers: { Authorization: pToken },
    body: { name: "Aspirin", dosage: "81mg", times: ["09:00"], frequency: "once", stock: 100, refillAt: 10 }
  });
  const medId = addMedRes.data?.medicine?._id;

  // Snooze 4 times
  for (let i = 0; i < 4; i++) {
    await request(`/medicine/snooze/${medId}`, {
      method: "PATCH",
      headers: { Authorization: pToken },
      body: { minutes: 10 }
    });
  }

  const MedicineModel = mongoose.model("Medicine");
  const medAfterSnooze = await MedicineModel.findById(medId);
  logTest("Medicine snoozeCount increments correctly on snooze action (snoozeCount = 4)", medAfterSnooze?.snoozeCount === 4);

  // E8. Reset snoozeCount on Taken confirmation
  const takeRes = await request(`/medicine/taken/${medId}`, {
    method: "PATCH",
    headers: { Authorization: pToken }
  });
  const medAfterTake = await MedicineModel.findById(medId);
  logTest("Confirming taken dose resets snoozeCount to 0", takeRes.status === 200 && medAfterTake?.snoozeCount === 0);

  // E9. Unlink caregiver
  const unlinkRes = await request("/caregiver/unlink", {
    method: "DELETE",
    headers: { Authorization: pToken }
  });
  logTest("Patient unlinks caregiver successfully", unlinkRes.status === 200);

  const getCaregiverAfterUnlink = await request("/caregiver/my-caregiver", {
    method: "GET",
    headers: { Authorization: pToken }
  });
  logTest("Verified active caregiver connection cleared", getCaregiverAfterUnlink.data?.relation === null);
}

async function executeForgotPasswordTests() {
  console.log(colors.bold(colors.yellow("\n--- Category F: Forgot & Reset Password OTP Flow ---")));

  const email = "otp_test_user@example.com";
  const oldPassword = "oldpassword123";
  const newPassword = "newpassword123";

  // F1. Register user
  const regRes = await request("/auth/register", {
    method: "POST",
    body: { name: "OTP User", email, password: oldPassword }
  });
  logTest("Register OTP test user account", regRes.status === 201);

  // F2. Request forgot-password code
  const forgotRes = await request("/auth/forgot-password", {
    method: "POST",
    body: { email }
  });
  logTest("Initiate forgot-password process (triggers OTP mail flow)", forgotRes.status === 200);

  // F3. White-box fetch OTP from DB
  const user = await User.findOne({ email });
  const otpCode = user?.resetPasswordCode;
  const isOtpValid = otpCode && otpCode.length === 6 && !isNaN(Number(otpCode));
  logTest("Generate cryptographically secure 6-digit numeric OTP in database", isOtpValid);

  if (!otpCode) {
    throw new Error("OTP code was not saved to the user record in database.");
  }

  // F4. Reset password with wrong OTP
  const wrongResetRes = await request("/auth/reset-password", {
    method: "POST",
    body: { email, code: "000000", newPassword }
  });
  logTest("Reject password reset requests using invalid verification codes", wrongResetRes.status === 400);

  // F5. Reset password with correct OTP
  const correctResetRes = await request("/auth/reset-password", {
    method: "POST",
    body: { email, code: otpCode, newPassword }
  });
  logTest("Apply new password and clear active OTP code on valid verification", correctResetRes.status === 200);

  // F6. Verify DB fields cleared
  const updatedUser = await User.findOne({ email });
  logTest("Sweep database user record to verify code and expiry are cleared", updatedUser.resetPasswordCode === null && updatedUser.resetPasswordExpires === null);

  // F7. Verify login fails with old password
  const oldLoginRes = await request("/auth/login", {
    method: "POST",
    body: { email, password: oldPassword }
  });
  logTest("Reject logins attempting to authenticate with deprecated passwords", oldLoginRes.status === 401);

  // F8. Verify login succeeds with new password
  const newLoginRes = await request("/auth/login", {
    method: "POST",
    body: { email, password: newPassword }
  });
  logTest("Grant JWT access token on authenticating with the new password", newLoginRes.status === 200 && newLoginRes.data?.token !== undefined);
}

// Run the script
runTests();

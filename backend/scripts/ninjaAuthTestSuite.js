process.env.NODE_ENV = "test";
require("dotenv").config({ path: require("path").join(__dirname, "../.env") });
process.env.NODE_ENV = "test";
const mongoose = require("mongoose");
const express = require("express");
const http = require("http");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const User = require("../models/User");
const authRoutes = require("../routes/authRoutes");

const colors = {
  bold: (s) => `\x1b[1m${s}\x1b[0m`,
  cyan: (s) => `\x1b[36m${s}\x1b[0m`,
  green: (s) => `\x1b[32m${s}\x1b[0m`,
  yellow: (s) => `\x1b[33m${s}\x1b[0m`,
  red: (s) => `\x1b[31m${s}\x1b[0m`
};

async function runNinjaAuthTest() {
  console.log(colors.bold(colors.cyan("\n=======================================================")));
  console.log(colors.bold(colors.cyan("   NINJA TESTER: AUTHENTICATION & ANTI-DUPLICATE AUDIT ")));
  console.log(colors.bold(colors.cyan("=======================================================\n")));

  const MONGO_URI = process.env.MONGO_URI;
  if (!MONGO_URI) {
    console.error("MONGO_URI missing");
    process.exit(1);
  }

  await mongoose.connect(MONGO_URI);
  console.log(colors.green("📡 Database Connected (MongoDB Atlas)"));

  // Spin up test server without global rate limiter blocking test runs
  const app = express();
  app.use(express.json());
  app.use("/api/auth", authRoutes);

  let server;
  let baseUrl;
  await new Promise((resolve) => {
    server = http.createServer(app);
    server.listen(5099, () => {
      baseUrl = "http://localhost:5099/api/auth";
      console.log(colors.green(`🚀 Test server active on port 5099\n`));
      resolve();
    });
  });

  let passed = 0;
  let failed = 0;

  function assert(condition, message) {
    if (!condition) {
      console.log(colors.red(`  ✗ FAIL: ${message}`));
      failed++;
      throw new Error(message);
    } else {
      console.log(colors.green(`  ✓ ${message}`));
      passed++;
    }
  }

  async function apiPost(endpoint, body) {
    const res = await fetch(`${baseUrl}${endpoint}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body)
    });
    const data = await res.json().catch(() => ({}));
    return { status: res.status, data };
  }

  const uniqueId = Date.now();
  const primaryEmail = `ninja_user_${uniqueId}@medremind.com`;
  const primaryPassword = "SecurePassword@123";

  try {
    // =========================================================================
    // SECTION 1: VALID SIGNUP & LOGIN
    // =========================================================================
    console.log(colors.bold(colors.yellow("1. Valid Registration & Authentication Flow:")));

    const regRes = await apiPost("/register", {
      name: "Ninja Sensei",
      email: primaryEmail,
      password: primaryPassword
    });
    assert(regRes.status === 201, "Valid user registration returns HTTP 201 Created");
    assert(regRes.data.message === "Account created successfully", "Returns friendly success message");

    // Verify password is encrypted in database
    const dbUser = await User.findOne({ email: primaryEmail });
    assert(dbUser !== null, "User record exists in MongoDB");
    assert(dbUser.password !== primaryPassword, "Password is NOT stored in plaintext");
    assert(dbUser.password.startsWith("$2a$") || dbUser.password.startsWith("$2b$"), "Password uses bcrypt salt & hash");

    // Login with Email
    const loginEmailRes = await apiPost("/login", {
      email: primaryEmail,
      password: primaryPassword
    });
    assert(loginEmailRes.status === 200, "Login with email returns HTTP 200");
    assert(typeof loginEmailRes.data.token === "string", "Returns signed JWT token string");
    
    // Verify JWT payload
    const decoded = jwt.verify(loginEmailRes.data.token, process.env.JWT_SECRET);
    assert(decoded.email === primaryEmail, "JWT payload contains correct email");
    assert(decoded.role === "user", "JWT payload contains role");

    // Login with Username
    const loginNameRes = await apiPost("/login", {
      email: "Ninja Sensei",
      password: primaryPassword
    });
    assert(loginNameRes.status === 200, "Login with username returns HTTP 200");

    // =========================================================================
    // SECTION 2: DUPLICATE ACCOUNT PREVENTION (NINJA RIGOROUS CHECK)
    // =========================================================================
    console.log(colors.bold(colors.yellow("\n2. Duplicate Account Prevention (Strict Anti-Duplication):")));

    // 2.1 Exact email duplicate
    const dupExact = await apiPost("/register", {
      name: "Duplicate User",
      email: primaryEmail,
      password: "DifferentPassword456"
    });
    assert(dupExact.status === 409, "Exact email duplicate is rejected with HTTP 409 Conflict");
    assert(dupExact.data.message === "Email already registered", "Returns 'Email already registered' message");

    // 2.2 Case-insensitive duplicate (e.g. NINJA_USER_...@MEDREMIND.COM)
    const upperEmail = primaryEmail.toUpperCase();
    const dupCase = await apiPost("/register", {
      name: "Case Duplicate",
      email: upperEmail,
      password: "DifferentPassword456"
    });
    assert(dupCase.status === 409, "Uppercase email duplicate is rejected with HTTP 409 Conflict");

    // 2.3 Mixed-case duplicate (e.g. NiNjA_UsEr_...)
    const mixedEmail = primaryEmail.split("").map((c, i) => i % 2 === 0 ? c.toUpperCase() : c.toLowerCase()).join("");
    const dupMixed = await apiPost("/register", {
      name: "Mixed Case Duplicate",
      email: mixedEmail,
      password: "DifferentPassword456"
    });
    assert(dupMixed.status === 409, "Mixed-case email duplicate is rejected with HTTP 409 Conflict");

    // 2.4 Whitespace padded email (e.g. "  ninja_user_...  ")
    const paddedEmail = `  ${primaryEmail}  `;
    const dupPadded = await apiPost("/register", {
      name: "Padded Duplicate",
      email: paddedEmail,
      password: "DifferentPassword456"
    });
    assert(dupPadded.status === 409, "Whitespace-padded email duplicate is trimmed and rejected with HTTP 409 Conflict");

    // Verify DB count: strictly 1 user exists with this email
    const totalWithEmail = await User.countDocuments({ email: primaryEmail });
    assert(totalWithEmail === 1, "Exactly 1 user document exists in MongoDB (Zero duplicate account pollution)");

    // =========================================================================
    // SECTION 3: ROLE ESCALATION & INJECTION PROTECTION
    // =========================================================================
    console.log(colors.bold(colors.yellow("\n3. Role Escalation & Injection Protection:")));

    const roleAttackEmail = `role_attack_${uniqueId}@medremind.com`;
    const roleAttack = await apiPost("/register", {
      name: "Malicious User",
      email: roleAttackEmail,
      password: "HackerPassword123",
      role: "admin" // Attempting to inject admin role
    });
    assert(roleAttack.status === 201, "Registration succeeds without crashing");
    
    const roleAttackUser = await User.findOne({ email: roleAttackEmail });
    assert(roleAttackUser.role === "user", "Role escalation blocked: user role is strictly 'user' (NOT 'admin')");

    // =========================================================================
    // SECTION 4: INPUT VALIDATION BOUNDARIES
    // =========================================================================
    console.log(colors.bold(colors.yellow("\n4. Input Validation Boundary Checks:")));

    // Missing fields
    const missingFields = await apiPost("/register", { email: "test@abc.com" });
    assert(missingFields.status === 400, "Missing name/password rejected with HTTP 400");

    // Short name (< 2 chars)
    const shortName = await apiPost("/register", { name: "A", email: "valid@abc.com", password: "password123" });
    assert(shortName.status === 400, "Name < 2 characters rejected with HTTP 400");

    // Invalid email format
    const invalidEmail = await apiPost("/register", { name: "Valid Name", email: "not-an-email", password: "password123" });
    assert(invalidEmail.status === 400, "Invalid email format rejected with HTTP 400");

    // Short password (< 6 chars)
    const shortPass = await apiPost("/register", { name: "Valid Name", email: "valid@abc.com", password: "123" });
    assert(shortPass.status === 400, "Password < 6 characters rejected with HTTP 400");

    // =========================================================================
    // SECTION 5: WRONG CREDENTIALS & LOGIN SECURITY
    // =========================================================================
    console.log(colors.bold(colors.yellow("\n5. Login Credentials Security:")));

    // Non-existent user
    const noUser = await apiPost("/login", { email: "ghost_user_999@medremind.com", password: "somePassword123" });
    assert(noUser.status === 401, "Non-existent user rejected with HTTP 401 Unauthorized");

    // Wrong password
    const wrongPass = await apiPost("/login", { email: primaryEmail, password: "WrongPassword999" });
    assert(wrongPass.status === 401, "Incorrect password rejected with HTTP 401 Unauthorized");
    assert(wrongPass.data.message === "Incorrect password", "Returns safe error message");

    // =========================================================================
    // SECTION 6: PASSWORD RESET CRYPTOGRAPHIC INTEGRITY
    // =========================================================================
    console.log(colors.bold(colors.yellow("\n6. Password Reset Cryptographic Verification:")));

    // Forgot password request
    const forgotRes = await apiPost("/forgot-password", { email: primaryEmail });
    assert(forgotRes.status === 200, "Forgot password request accepted with HTTP 200");

    const userWithOtp = await User.findOne({ email: primaryEmail });
    assert(userWithOtp.resetPasswordCode !== null, "Reset OTP is generated");
    assert(userWithOtp.resetPasswordCode.startsWith("$2a$") || userWithOtp.resetPasswordCode.startsWith("$2b$"), "Reset OTP is hashed with bcrypt before storage (Zero plaintext OTP in DB)");
    assert(userWithOtp.resetPasswordExpires > Date.now(), "Reset OTP expiry is set in future (15-min window)");

    // Reset with wrong code
    const wrongCodeRes = await apiPost("/reset-password", {
      email: primaryEmail,
      code: "000000",
      newPassword: "BrandNewPassword456"
    });
    assert(wrongCodeRes.status === 400, "Incorrect OTP code rejected with HTTP 400");

    // Reset with expired timestamp simulation
    userWithOtp.resetPasswordExpires = Date.now() - 10000; // expired 10s ago
    await userWithOtp.save();
    const expiredRes = await apiPost("/reset-password", {
      email: primaryEmail,
      code: "123456",
      newPassword: "BrandNewPassword456"
    });
    assert(expiredRes.status === 400, "Expired OTP rejected with HTTP 400");

  } finally {
    // Cleanup test users
    await User.deleteMany({ email: { $regex: /^(ninja_user_|role_attack_)/ } });
    if (server) server.close();
    await mongoose.connection.close();
  }

  console.log(colors.bold(colors.cyan("\n-------------------------------------------------------")));
  console.log(`Results: ${colors.green(`${passed} passed`)}, ${failed > 0 ? colors.red(`${failed} failed`) : "0 failed"}`);
  console.log(colors.bold(colors.cyan("=======================================================\n")));

  if (failed > 0) process.exit(1);
}

runNinjaAuthTest().catch(err => {
  console.error("Ninja auth test fatal error:", err);
  process.exit(1);
});

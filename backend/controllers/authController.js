const User = require("../models/User");
const Medicine = require("../models/Medicine");
const DoseLog = require("../models/DoseLog");
const AuditLog = require("../models/AuditLog");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const crypto = require("crypto");
const nodemailer = require("nodemailer");

const getLocalDate = (d = new Date()) => {
  const tz = process.env.TZ || "Asia/Kolkata";
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour12: false
  });
  const parts = formatter.formatToParts(d);
  const getPart = type => parts.find(p => p.type === type).value;
  return `${getPart("year")}-${getPart("month")}-${getPart("day")}`;
};

const isValidEmail = (email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

const signToken = (user) =>
  jwt.sign(
    { id: user._id, name: user.name, email: user.email, role: user.role || "user", avatar: user.avatar || "👤" },
    process.env.JWT_SECRET,
    { expiresIn: "7d" }
  );

exports.register = async (req, res) => {
  try {
    const name     = (req.body.name     || "").trim();
    const email    = (req.body.email    || "").trim().toLowerCase();
    const password = (req.body.password || "").trim();
    const avatar   = (req.body.avatar   || "👤").trim();

    if (!name || !email || !password)
      return res.status(400).json({ message: "All fields are required" });
    if (name.length < 2)
      return res.status(400).json({ message: "Name must be at least 2 characters" });
    if (!isValidEmail(email))
      return res.status(400).json({ message: "Invalid email address" });
    if (password.length < 6)
      return res.status(400).json({ message: "Password must be at least 6 characters" });

    const existing = await User.findOne({ email });
    if (existing)
      return res.status(409).json({ message: "Email already registered" });

    const hashedPassword = await bcrypt.hash(password, 12);
    await User.create({ name, email, password: hashedPassword, avatar });

    console.log(`✅ Registered: ${email}`);
    res.status(201).json({ message: "Account created successfully" });
  } catch (error) {
    console.error("Register error:", error.message);
    res.status(500).json({ message: "Server error" });
  }
};

exports.login = async (req, res) => {
  try {
    const identifier = (req.body.email || "").trim();
    const password   = (req.body.password || "").trim();

    if (!identifier || !password)
      return res.status(400).json({ message: "Email or Username and password are required" });

    let user;
    if (isValidEmail(identifier)) {
      user = await User.findOne({ email: identifier.toLowerCase() });
    } else {
      user = await User.findOne({ name: { $regex: new RegExp(`^${identifier.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&')}$`, "i") } });
    }

    if (!user) {
      return res.status(401).json({ message: "No account found with this email or username" });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch)
      return res.status(401).json({ message: "Incorrect password" });

    const token = signToken(user);
    console.log(`✅ Login: ${user.email}`);
    res.json({ message: "Login successful", token, name: user.name, role: user.role || "user" });
  } catch (error) {
    console.error("Login error:", error.message);
    res.status(500).json({ message: "Server error" });
  }
};

exports.getProfile = async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select("-password");
    if (!user) return res.status(404).json({ message: "User not found" });

    const today = getLocalDate();
    const medicines = await Medicine.find({ userId: req.user.id });

    const active = medicines.filter(m => {
      if (m.startDate && today < m.startDate) return false;
      if (m.endDate   && today > m.endDate)   return false;
      return true;
    });

    res.json({
      user,
      stats: {
        totalMedicines:  medicines.length,
        activeMedicines: active.length,
        takenToday:      active.filter(m => m.taken).length,
        lowStock:        medicines.filter(m => m.stock <= m.refillAt).length
      }
    });
  } catch (error) {
    console.error("Profile error:", error.message);
    res.status(500).json({ message: "Server error" });
  }
};

exports.updateProfile = async (req, res) => {
  try {
    const { name, avatar, currentPassword, newPassword, maxMissedThreshold } = req.body;
    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ message: "User not found" });

    if (name && name.trim().length >= 2) user.name = name.trim();
    if (avatar) user.avatar = avatar;

    if (maxMissedThreshold !== undefined) {
      const val = parseInt(maxMissedThreshold, 10);
      if (Number.isInteger(val) && val >= 1 && val <= 5) {
        user.maxMissedThreshold = val;
      }
    }

    if (newPassword) {
      if (!currentPassword)
        return res.status(400).json({ message: "Current password is required" });
      const isMatch = await bcrypt.compare(currentPassword, user.password);
      if (!isMatch)
        return res.status(401).json({ message: "Current password is incorrect" });
      if (newPassword.length < 6)
        return res.status(400).json({ message: "New password must be at least 6 characters" });
      user.password = await bcrypt.hash(newPassword, 12);
    }

    await user.save();
    const token = signToken(user); // include role in refreshed token
    res.json({ message: "Profile updated", token, name: user.name, avatar: user.avatar, maxMissedThreshold: user.maxMissedThreshold });
  } catch (error) {
    console.error("Update profile error:", error.message);
    res.status(500).json({ message: "Server error" });
  }
};

exports.deleteAccount = async (req, res) => {
  try {
    const { password } = req.body || {};
    if (!password) return res.status(400).json({ message: "Password is required" });

    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ message: "User not found" });

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return res.status(401).json({ message: "Incorrect password" });

    await DoseLog.deleteMany({ userId: req.user.id });
    await AuditLog.deleteMany({ userId: req.user.id });
    await Medicine.deleteMany({ userId: req.user.id });
    await User.findByIdAndDelete(req.user.id);

    res.json({ message: "Account completely deleted along with all data logs" });
  } catch (error) {
    console.error("Delete account error:", error.message);
    res.status(500).json({ message: "Server error" });
  }
};

const sendResetEmail = async (email, code) => {
  // Always log the OTP code to the console for ease of retrieval/development
  console.log("\n========================================");
  console.log(`📧 RESET PASSWORD OTP GENERATED`);
  console.log(`   Recipient: ${email}`);
  console.log(`   Code:      ${code}`);
  console.log("========================================\n");

  let transporter;
  if (process.env.SMTP_HOST) {
    transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: parseInt(process.env.SMTP_PORT, 10) || 587,
      secure: process.env.SMTP_SECURE === "true",
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS
      }
    });
  } else if (process.env.EMAIL_USER && process.env.EMAIL_PASS) {
    transporter = nodemailer.createTransport({
      service: process.env.EMAIL_SERVICE || "gmail",
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
      }
    });
  } else {
    try {
      const testAccount = await nodemailer.createTestAccount();
      transporter = nodemailer.createTransport({
        host: "smtp.ethereal.email",
        port: 587,
        secure: false,
        auth: {
          user: testAccount.user,
          pass: testAccount.pass
        }
      });
    } catch (e) {
      console.log("Failed to initialize ethereal test mail transporter, falling back to console logging.");
    }
  }

  const mailOptions = {
    from: process.env.SMTP_FROM || process.env.EMAIL_USER || '"MedRemind Support" <support@medremind.com>',
    to: email,
    subject: "MedRemind Password Reset Code",
    text: `Your password reset verification code is: ${code}. It is valid for 15 minutes.`,
    html: `<h3>MedRemind Password Reset</h3>
           <p>You requested a password reset. Please use the verification code below to reset your password:</p>
           <h2 style="color: #4f46e5; letter-spacing: 2px;">${code}</h2>
           <p>This code is valid for 15 minutes. If you did not request this, you can safely ignore this email.</p>`
  };

  if (transporter) {
    try {
      const info = await transporter.sendMail(mailOptions);
      console.log(`Reset email sent: ${info.messageId}`);
      const testUrl = nodemailer.getTestMessageUrl(info);
      if (testUrl) {
        console.log(`Ethereal Reset Mail URL: ${testUrl}`);
      }
    } catch (err) {
      console.error("Error sending reset email:", err.message);
    }
  }
};

exports.forgotPassword = async (req, res) => {
  try {
    const email = (req.body.email || "").trim().toLowerCase();
    if (!email || !isValidEmail(email)) {
      return res.status(400).json({ message: "A valid email address is required" });
    }

    const user = await User.findOne({ email });
    // Secure pattern: generic response to prevent user enumeration
    if (!user) {
      return res.json({ message: "If an account with that email exists, we have sent a verification code to reset your password" });
    }

    // Cryptographically secure 6-digit numeric OTP generator
    const code = crypto.randomInt(100000, 999999).toString();
    user.resetPasswordCode = code;
    user.resetPasswordExpires = Date.now() + 15 * 60 * 1000; // 15 mins expiry
    await user.save();

    await sendResetEmail(user.email, code);

    res.json({ message: "If an account with that email exists, we have sent a verification code to reset your password" });
  } catch (error) {
    console.error("forgotPassword error:", error.message);
    res.status(500).json({ message: "Server error" });
  }
};

exports.resetPassword = async (req, res) => {
  try {
    const email = (req.body.email || "").trim().toLowerCase();
    const code = (req.body.code || "").trim();
    const newPassword = (req.body.newPassword || "").trim();

    if (!email || !code || !newPassword) {
      return res.status(400).json({ message: "All fields are required" });
    }
    if (newPassword.length < 6) {
      return res.status(400).json({ message: "New password must be at least 6 characters" });
    }

    const user = await User.findOne({ email });
    if (!user || !user.resetPasswordCode || user.resetPasswordCode !== code || !user.resetPasswordExpires || user.resetPasswordExpires < Date.now()) {
      return res.status(400).json({ message: "Invalid or expired verification code" });
    }

    // Reset password
    user.password = await bcrypt.hash(newPassword, 12);
    user.resetPasswordCode = null;
    user.resetPasswordExpires = null;
    await user.save();

    res.json({ message: "Password has been reset successfully" });
  } catch (error) {
    console.error("resetPassword error:", error.message);
    res.status(500).json({ message: "Server error" });
  }
};

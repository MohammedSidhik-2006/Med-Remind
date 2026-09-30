const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const path = require("path");
require("dotenv").config({ path: path.resolve(__dirname, "../.env") });

const User = require("../models/User");
const Medicine = require("../models/Medicine");
const DoseLog = require("../models/DoseLog");
const { getLocalDate } = require("../services/reportMetricsService");

async function setup() {
  await mongoose.connect(process.env.MONGO_URI);
  console.log("Connected to MongoDB.");

  // Password for all test users
  const hashedPassword = await bcrypt.hash("Password123!", 10);

  // Helper to cleanup and create user
  async function makeUser(email, name) {
    const existing = await User.findOne({ email });
    if (existing) {
      await DoseLog.deleteMany({ userId: existing._id });
      await Medicine.deleteMany({ userId: existing._id });
      await User.findByIdAndDelete(existing._id);
    }
    const user = await User.create({
      name,
      email,
      password: hashedPassword,
      role: "user"
    });
    const token = jwt.sign(
      { id: user._id, name: user.name, email: user.email, role: user.role, avatar: "👤" },
      process.env.JWT_SECRET || "medremindsecret",
      { expiresIn: "7d" }
    );
    return { user, token };
  }

  // 1. User with real mixed tracking data (User A: Metformin + Lisinopril)
  const { user: userA, token: tokenA } = await makeUser("e2e_user@example.com", "E2E Test User");
  const med1 = await Medicine.create({
    userId: userA._id,
    name: "Metformin",
    dosage: "500mg",
    time: "08:00",
    times: ["08:00"],
    stock: 30,
    refillAt: 5
  });
  const med2 = await Medicine.create({
    userId: userA._id,
    name: "Lisinopril",
    dosage: "10mg",
    time: "20:00",
    times: ["20:00"],
    stock: 30,
    refillAt: 5
  });

  const today = new Date();
  // 6 days of data: Metformin all 6 taken at 08:00 (morning)
  // Lisinopril: 5 taken at 20:00 (evening), 1 missed on day 2
  for (let i = 0; i < 6; i++) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    const ds = getLocalDate(d);

    // Metformin morning taken
    await DoseLog.create({
      userId: userA._id,
      medicineId: med1._id,
      medicineName: med1.name,
      dosage: med1.dosage,
      date: ds,
      scheduledTime: "08:00",
      status: "taken",
      takenAt: d
    });

    // Lisinopril evening: day 2 is missed, others taken
    const isMissed = i === 2;
    await DoseLog.create({
      userId: userA._id,
      medicineId: med2._id,
      medicineName: med2.name,
      dosage: med2.dosage,
      date: ds,
      scheduledTime: "20:00",
      status: isMissed ? "missed" : "taken",
      takenAt: isMissed ? null : d
    });
  }
  console.log(`Created User A (e2e_user@example.com): 11 taken, 1 missed (92% adherence). Token: ${tokenA}`);

  // 2. User with 100% adherence (User B)
  const { user: userB, token: tokenB } = await makeUser("perfect_user@example.com", "Perfect Compliance User");
  const medB = await Medicine.create({
    userId: userB._id,
    name: "Vitamin D3",
    dosage: "1000IU",
    time: "09:00",
    times: ["09:00"],
    stock: 60,
    refillAt: 10
  });
  for (let i = 0; i < 7; i++) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    await DoseLog.create({
      userId: userB._id,
      medicineId: medB._id,
      medicineName: medB.name,
      dosage: medB.dosage,
      date: getLocalDate(d),
      scheduledTime: "09:00",
      status: "taken",
      takenAt: d
    });
  }
  console.log(`Created User B (perfect_user@example.com): 7/7 taken (100% adherence). Token: ${tokenB}`);

  // 3. User with No Data (User C)
  const { user: userC, token: tokenC } = await makeUser("nodata_user@example.com", "No Data User");
  console.log(`Created User C (nodata_user@example.com): 0 doses. Token: ${tokenC}`);

  await mongoose.connection.close();
}

setup().catch(err => {
  console.error("Setup error:", err);
  process.exit(1);
});

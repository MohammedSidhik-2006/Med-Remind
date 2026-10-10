require("dotenv").config({ path: require("path").resolve(__dirname, "../.env") });
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const User = require("../models/User");
const Medicine = require("../models/Medicine");
const DoseLog = require("../models/DoseLog");
const CaregiverRelation = require("../models/CaregiverRelation");
const { getLocalDate } = require("../services/reportMetricsService");

async function setup() {
  await mongoose.connect(process.env.MONGO_URI);
  console.log("Connected to MongoDB Atlas\n");

  const email = "sidhikmohammad745@gmail.com";
  let user = await User.findOne({ email });

  const hashedPassword = await bcrypt.hash("Sidhik@20", 10);

  if (!user) {
    user = await User.create({
      name: "sidhik",
      email,
      password: hashedPassword,
      role: "admin",
      streak: 7,
      maxMissedThreshold: 3
    });
    console.log("Created user:", user.email);
  } else {
    user.name = "sidhik";
    user.password = hashedPassword;
    user.streak = 7;
    user.maxMissedThreshold = 3;
    await user.save();
    console.log("Updated user password to Sidhik@20, streak: 7, id:", user._id);
  }

  // Ensure caregiver account (Yasmin) also has a known password if needed for demo
  const caregiverUser = await User.findOne({ email: "mohammedsidhik1818@gmail.com" });
  if (caregiverUser) {
    caregiverUser.password = hashedPassword;
    await caregiverUser.save();
    console.log("Updated caregiver (Yasmin - mohammedsidhik1818@gmail.com) password to Sidhik@20");
  }

  // Clear existing medicines and dose logs for Sidhik to build a clean, clinical profile
  await Medicine.deleteMany({ userId: user._id });
  await DoseLog.deleteMany({ userId: user._id });
  console.log("Cleared old demo logs and medicines for clean state");

  const today = getLocalDate();

  // Create high-quality regular clinical medications
  const medsConfig = [
    {
      name: "Metformin",
      dosage: "500 mg",
      time: "08:00",
      times: ["08:00", "20:00"],
      timePeriods: ["morning", "night"],
      frequency: "twice_daily",
      startDate: "2026-10-01",
      stock: 42,
      refillAt: 10,
      notes: "Take with meals to minimize gastrointestinal discomfort",
      lastResetDate: today
    },
    {
      name: "Lisinopril",
      dosage: "10 mg",
      time: "08:30",
      times: ["08:30"],
      timePeriods: ["morning"],
      frequency: "once_daily",
      startDate: "2026-10-01",
      stock: 25,
      refillAt: 5,
      notes: "Blood pressure support - take with full glass of water",
      lastResetDate: today
    },
    {
      name: "Multivitamin & D3",
      dosage: "1 tablet",
      time: "09:00",
      times: ["09:00"],
      timePeriods: ["morning"],
      frequency: "once_daily",
      startDate: "2026-10-01",
      stock: 55,
      refillAt: 10,
      notes: "Immune support - take after breakfast",
      lastResetDate: today
    },
    {
      name: "Omega-3 Fish Oil",
      dosage: "1000 mg",
      time: "13:30",
      times: ["13:30"],
      timePeriods: ["afternoon"],
      frequency: "once_daily",
      startDate: "2026-10-01",
      stock: 30,
      refillAt: 5,
      notes: "Cardiovascular health - take with lunch",
      lastResetDate: today
    },
    {
      name: "Atorvastatin",
      dosage: "20 mg",
      time: "21:00",
      times: ["21:00"],
      timePeriods: ["night"],
      frequency: "once_daily",
      startDate: "2026-10-01",
      stock: 28,
      refillAt: 7,
      notes: "Cholesterol management - take before bedtime",
      lastResetDate: today
    }
  ];

  const createdMeds = [];
  for (const cfg of medsConfig) {
    const med = await Medicine.create({
      ...cfg,
      userId: user._id
    });
    createdMeds.push(med);
    console.log(`Created medicine: ${med.name} (${med.dosage}) - Times: ${med.times.join(", ")}`);
  }

  // Generate 9 days of perfect historical DoseLogs (from 2026-10-01 to 2026-10-09)
  const logsToInsert = [];
  for (let i = 9; i >= 1; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const dateStr = getLocalDate(d);

    for (const med of createdMeds) {
      for (const slot of med.times) {
        const [h, m] = slot.split(":").map(Number);
        const takenTime = new Date(d);
        takenTime.setHours(h, m + Math.floor(Math.random() * 8), 0, 0);

        logsToInsert.push({
          userId: user._id,
          medicineId: med._id,
          medicineName: med.name,
          dosage: med.dosage,
          date: dateStr,
          scheduledTime: slot,
          status: "taken",
          takenAt: takenTime
        });
      }
    }
  }

  // For Today (2026-10-10): Mark 2 morning doses as taken, leave remaining 4 pending
  const medMetformin = createdMeds.find(m => m.name === "Metformin");
  const medLisinopril = createdMeds.find(m => m.name === "Lisinopril");

  // Metformin 08:00 slot taken
  const morningTaken1 = new Date();
  morningTaken1.setHours(8, 5, 0, 0);
  logsToInsert.push({
    userId: user._id,
    medicineId: medMetformin._id,
    medicineName: medMetformin.name,
    dosage: medMetformin.dosage,
    date: today,
    scheduledTime: "08:00",
    status: "taken",
    takenAt: morningTaken1
  });

  // Lisinopril 08:30 slot taken
  const morningTaken2 = new Date();
  morningTaken2.setHours(8, 32, 0, 0);
  logsToInsert.push({
    userId: user._id,
    medicineId: medLisinopril._id,
    medicineName: medLisinopril.name,
    dosage: medLisinopril.dosage,
    date: today,
    scheduledTime: "08:30",
    status: "taken",
    takenAt: morningTaken2
  });

  await DoseLog.insertMany(logsToInsert);
  console.log(`Inserted ${logsToInsert.length} historical dose logs`);

  // Ensure caregiver link exists
  if (caregiverUser) {
    const existingRel = await CaregiverRelation.findOne({
      patientId: user._id,
      caregiverId: caregiverUser._id
    });
    if (!existingRel) {
      await CaregiverRelation.create({
        patientId: user._id,
        caregiverId: caregiverUser._id,
        relationshipLabel: "Caregiver"
      });
      console.log("Created caregiver relation between Sidhik and Yasmin");
    } else {
      console.log("Caregiver relation already active between Sidhik and Yasmin");
    }
  }

  console.log("\n=======================================================");
  console.log("  ✅ SIDHIK ACCOUNT SETUP COMPLETE FOR INTERVIEW DEMO   ");
  console.log("=======================================================");
  console.log("Email:    sidhikmohammad745@gmail.com");
  console.log("Password: Sidhik@20");
  console.log("Medicines: 5 active medications");
  console.log("Today:     2 doses completed, 4 pending (perfect for live test)");
  console.log("Streak:    7-day consecutive streak");
  console.log("Adherence: 100% on historical days");
  console.log("=======================================================\n");

  await mongoose.disconnect();
}

setup().catch(err => {
  console.error("Setup error:", err);
  process.exit(1);
});

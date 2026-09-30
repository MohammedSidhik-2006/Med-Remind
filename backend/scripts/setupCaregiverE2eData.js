const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const path = require("path");
require("dotenv").config({ path: path.resolve(__dirname, "../.env") });

const User = require("../models/User");
const Medicine = require("../models/Medicine");
const DoseLog = require("../models/DoseLog");
const CaregiverRelation = require("../models/CaregiverRelation");
const { getLocalDate } = require("../services/reportMetricsService");

async function setup() {
  await mongoose.connect(process.env.MONGO_URI);
  console.log("Connected to MongoDB.");

  const hashedPassword = await bcrypt.hash("Password123!", 10);

  async function makeUser(email, name, role = "user") {
    let user = await User.findOne({ email });
    if (!user) {
      user = await User.create({
        name,
        email,
        password: hashedPassword,
        role
      });
    } else {
      user.name = name;
      user.role = role;
      await user.save();
    }
    const token = jwt.sign(
      { id: user._id, name: user.name, email: user.email, role: user.role, avatar: "👤" },
      process.env.JWT_SECRET || "medremindsecret",
      { expiresIn: "7d" }
    );
    return { user, token };
  }

  // 1. Caregiver User
  const { user: caregiver, token: caregiverToken } = await makeUser("caregiver@example.com", "Sarah Caregiver", "user");
  
  // 2. Unauthorized Caregiver
  const { user: unauthCaregiver, token: unauthCaregiverToken } = await makeUser("unauth_caregiver@example.com", "Evil Stranger", "user");

  // 3. Patient A (e2e_user@example.com) with 11 taken, 1 missed
  const { user: patientA, token: patientAToken } = await makeUser("e2e_user@example.com", "Father Robert", "user");
  await DoseLog.deleteMany({ userId: patientA._id });
  await Medicine.deleteMany({ userId: patientA._id });
  const med1 = await Medicine.create({
    userId: patientA._id,
    name: "Metformin",
    dosage: "500mg",
    time: "08:00",
    times: ["08:00"],
    stock: 30,
    refillAt: 5
  });
  const med2 = await Medicine.create({
    userId: patientA._id,
    name: "Lisinopril",
    dosage: "10mg",
    time: "20:00",
    times: ["20:00"],
    stock: 30,
    refillAt: 5
  });

  const today = new Date();
  for (let i = 0; i < 6; i++) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    const ds = getLocalDate(d);

    await DoseLog.create({
      userId: patientA._id,
      medicineId: med1._id,
      medicineName: med1.name,
      dosage: med1.dosage,
      date: ds,
      scheduledTime: "08:00",
      status: "taken",
      takenAt: d
    });

    const isMissed = i === 2;
    await DoseLog.create({
      userId: patientA._id,
      medicineId: med2._id,
      medicineName: med2.name,
      dosage: med2.dosage,
      date: ds,
      scheduledTime: "20:00",
      status: isMissed ? "missed" : "taken",
      takenAt: isMissed ? null : d
    });
  }

  // 4. Patient B (perfect_user@example.com) with 100% adherence
  const { user: patientB, token: patientBToken } = await makeUser("perfect_user@example.com", "Mother Mary", "user");
  await DoseLog.deleteMany({ userId: patientB._id });
  await Medicine.deleteMany({ userId: patientB._id });
  const medB = await Medicine.create({
    userId: patientB._id,
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
      userId: patientB._id,
      medicineId: medB._id,
      medicineName: medB.name,
      dosage: medB.dosage,
      date: getLocalDate(d),
      scheduledTime: "09:00",
      status: "taken",
      takenAt: d
    });
  }

  // 5. Patient C (nodata_user@example.com) with 0 logs
  const { user: patientC, token: patientCToken } = await makeUser("nodata_user@example.com", "Daughter Clara", "user");
  await DoseLog.deleteMany({ userId: patientC._id });
  await Medicine.deleteMany({ userId: patientC._id });

  // 6. Unlinked Patient D (stranger@example.com)
  const { user: patientD, token: patientDToken } = await makeUser("stranger@example.com", "Stranger Dan", "user");

  // Reset and seed Caregiver Relations
  await CaregiverRelation.deleteMany({ caregiverId: caregiver._id });
  await CaregiverRelation.deleteMany({ caregiverId: unauthCaregiver._id });

  await CaregiverRelation.create({
    patientId: patientA._id,
    caregiverId: caregiver._id,
    relationshipLabel: "Father"
  });
  await CaregiverRelation.create({
    patientId: patientB._id,
    caregiverId: caregiver._id,
    relationshipLabel: "Mother"
  });
  await CaregiverRelation.create({
    patientId: patientC._id,
    caregiverId: caregiver._id,
    relationshipLabel: "Daughter"
  });

  console.log("Seeded caregiver relations for Sarah Caregiver (caregiver@example.com):");
  console.log(`- Patient A (Father Robert, ${patientA._id}) - Mixed adherence`);
  console.log(`- Patient B (Mother Mary, ${patientB._id}) - 100% adherence`);
  console.log(`- Patient C (Daughter Clara, ${patientC._id}) - 0 history`);
  console.log(`- Unlinked Patient D (${patientD._id})`);
  console.log(`Caregiver Token: ${caregiverToken}`);

  await mongoose.connection.close();
}

setup().catch(err => {
  console.error("Caregiver setup error:", err);
  process.exit(1);
});

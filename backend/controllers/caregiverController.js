const mongoose = require("mongoose");
const CaregiverRelation = require("../models/CaregiverRelation");
const User = require("../models/User");
const Medicine = require("../models/Medicine");
const DoseLog = require("../models/DoseLog");
const AuditLog = require("../models/AuditLog");

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

// 1. Link caregiver (Patient -> Caregiver)
exports.linkCaregiver = async (req, res) => {
  try {
    const { email, relationshipLabel } = req.body;
    if (!email || !email.trim()) {
      return res.status(400).json({ message: "Caregiver email is required." });
    }
    const cleanEmail = email.trim().toLowerCase();
    const label = relationshipLabel || "Other";

    // Enforce relationship labels
    const validLabels = ["Father", "Mother", "Husband", "Wife", "Son", "Daughter", "Other"];
    if (!validLabels.includes(label)) {
      return res.status(400).json({ message: "Invalid relationship label." });
    }

    const caregiver = await User.findOne({ email: cleanEmail });
    if (!caregiver) {
      return res.status(404).json({ message: "Caregiver with this email was not found." });
    }

    if (caregiver._id.toString() === req.user.id) {
      return res.status(400).json({ message: "You cannot link yourself as your own caregiver." });
    }

    // Limit to one caregiver per patient (UI/business logic enforcement)
    const existingRelation = await CaregiverRelation.findOne({ patientId: req.user.id });
    if (existingRelation) {
      return res.status(400).json({ 
        message: "You already have a linked caregiver. Please unlink them before adding a new one." 
      });
    }

    // Create the link
    const newRelation = await CaregiverRelation.create({
      patientId: req.user.id,
      caregiverId: caregiver._id,
      relationshipLabel: label
    });

    const populated = await CaregiverRelation.findById(newRelation._id)
      .populate("caregiverId", "name email avatar");

    // Add Audit Log
    AuditLog.create({
      userId: req.user.id,
      userEmail: req.user.email,
      action: "caregiver_linked",
      details: `Linked ${caregiver.name} (${caregiver.email}) as ${label}`
    }).catch(() => {});

    res.status(201).json({
      message: "Caregiver linked successfully.",
      relation: populated
    });
  } catch (error) {
    console.error("linkCaregiver error:", error.message);
    if (error.code === 11000) {
      return res.status(400).json({ message: "This caregiver link already exists." });
    }
    res.status(500).json({ message: "Server error." });
  }
};

// 2. Get active caregiver relation for the patient
exports.getMyCaregiver = async (req, res) => {
  try {
    const relation = await CaregiverRelation.findOne({ patientId: req.user.id })
      .populate("caregiverId", "name email avatar");
    res.json({ relation });
  } catch (error) {
    console.error("getMyCaregiver error:", error.message);
    res.status(500).json({ message: "Server error." });
  }
};

// 3. Unlink caregiver (Patient -> Caregiver)
exports.unlinkCaregiver = async (req, res) => {
  try {
    const relation = await CaregiverRelation.findOne({ patientId: req.user.id })
      .populate("caregiverId", "name email");

    if (!relation) {
      return res.status(404).json({ message: "No active caregiver relation found to unlink." });
    }

    await CaregiverRelation.findByIdAndDelete(relation._id);

    // Add Audit Log
    AuditLog.create({
      userId: req.user.id,
      userEmail: req.user.email,
      action: "caregiver_unlinked",
      details: `Unlinked ${relation.caregiverId?.name || "Caregiver"} (${relation.caregiverId?.email || "Unknown"})`
    }).catch(() => {});

    res.json({ message: "Caregiver unlinked successfully." });
  } catch (error) {
    console.error("unlinkCaregiver error:", error.message);
    res.status(500).json({ message: "Server error." });
  }
};

// 4. Caregiver gets list of patients they monitor
exports.getMyPatients = async (req, res) => {
  try {
    const relations = await CaregiverRelation.find({ caregiverId: req.user.id })
      .populate("patientId", "name email avatar");
    const valid = relations.filter(r => r.patientId != null);
    res.json(valid);
  } catch (error) {
    console.error("getMyPatients error:", error.message);
    res.status(500).json({ message: "Server error." });
  }
};

// 5. Caregiver gets patient dashboard details (RBAC checked)
exports.getPatientDashboard = async (req, res) => {
  try {
    const { patientId } = req.params;
    if (!mongoose.Types.ObjectId.isValid(patientId)) {
      return res.status(400).json({ message: "Invalid patient ID." });
    }

    // Verify authorized caregiver relationship
    const relation = await CaregiverRelation.findOne({ patientId, caregiverId: req.user.id });
    if (!relation) {
      return res.status(403).json({ message: "Unauthorized. You are not linked as a caregiver for this patient." });
    }

    // Catch up missed doses first in case patient has not logged in today
    try {
      const { catchUpMedicinesForUser } = require("../middleware/catchUpMiddleware");
      await catchUpMedicinesForUser(patientId);
    } catch (err) {
      console.error("Error catching up patient medicines in caregiverController:", err.message);
    }

    const patient = await User.findById(patientId).select("name email avatar maxMissedThreshold");
    if (!patient) {
      return res.status(404).json({ message: "Patient user not found." });
    }

    const today = getLocalDate();
    const maxMissedThreshold = patient.maxMissedThreshold !== undefined ? patient.maxMissedThreshold : 3;
    
    // Fetch patient's medicines and calculate taken counts today
    const medicines = await Medicine.find({ userId: patientId }).sort({ createdAt: 1 }).lean();
    const augMeds = await Promise.all(medicines.map(async (med) => {
      const takenCount = await DoseLog.countDocuments({ medicineId: med._id, date: today, status: "taken" });
      return { ...med, takenTodayCount: takenCount, maxMissedThreshold };
    }));

    // DoseLog history — load once, derive display slice and metrics from same array
    const allLogs = await DoseLog.find({ userId: patientId })
      .sort({ date: -1, createdAt: -1 })
      .lean();

    // Display subset (newest 50) — no extra query
    const logs = allLogs.slice(0, 50);

    // Compliance metrics
    const totalTaken  = allLogs.filter(l => l.status === "taken").length;
    const totalMissed = allLogs.filter(l => l.status === "missed").length;
    const totalDoses  = totalTaken + totalMissed;
    const overallAdherence = totalDoses > 0 ? Math.round((totalTaken / totalDoses) * 100) : 0;

    // Streak calculation
    const byDate = {};
    allLogs.forEach(l => {
      if (!byDate[l.date]) byDate[l.date] = { taken: 0, missed: 0 };
      byDate[l.date][l.status]++;
    });

    let streak = 0;
    let checkDate = new Date();
    const todayStrC  = getLocalDate(checkDate);
    const todayDataC = byDate[todayStrC];
    if (!todayDataC || todayDataC.taken === 0) {
      checkDate.setDate(checkDate.getDate() - 1);
    }
    for (let i = 0; i < 365; i++) {
      const ds = getLocalDate(checkDate);
      const day = byDate[ds];
      if (!day || day.taken === 0 || day.missed > 0) break;
      streak++;
      checkDate.setDate(checkDate.getDate() - 1);
    }

    // Last active time — first entry in allLogs (already sorted newest-first)
    const lastActiveTime = allLogs.length > 0 ? allLogs[0].createdAt : null;

    res.json({
      patient: {
        id: patient._id,
        name: patient.name,
        email: patient.email,
        avatar: patient.avatar,
        relationshipLabel: relation.relationshipLabel
      },
      medicines: augMeds,
      logs,
      overallAdherence,
      streak,
      lastActiveTime
    });
  } catch (error) {
    console.error("getPatientDashboard error:", error.message);
    res.status(500).json({ message: "Server error." });
  }
};

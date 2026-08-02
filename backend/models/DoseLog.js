const mongoose = require("mongoose");

const doseLogSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  medicineId: { type: mongoose.Schema.Types.ObjectId, ref: "Medicine", required: true },
  medicineName: { type: String, required: true },
  dosage: { type: String, default: "" },
  date: { type: String, required: true },
  scheduledTime: { type: String, default: "" },
  status: { type: String, enum: ["taken", "missed"], required: true },
  takenAt: { type: Date, default: null }
}, { timestamps: true });

// Indexes for fast report queries
doseLogSchema.index({ userId: 1, date: -1 });
doseLogSchema.index({ medicineId: 1, date: 1, status: 1 });
doseLogSchema.index({ medicineId: 1, date: 1, scheduledTime: 1 }, { unique: true });

module.exports = mongoose.model("DoseLog", doseLogSchema);

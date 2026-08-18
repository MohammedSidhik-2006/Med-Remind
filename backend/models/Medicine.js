const mongoose = require("mongoose");

const medicineSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  name: { type: String, required: true, trim: true },
  dosage: { type: String, required: true, trim: true },
  time: { type: String, required: true },
  times: { type: [String], default: [] },
  timePeriods: { type: [String], default: [] },
  frequency: { type: String, default: "once" },
  startDate: { type: String, default: "" },
  endDate: { type: String, default: "" },
  taken: { type: Boolean, default: false },
  takenAt: { type: Date, default: null },
  confirmationPending: { type: Boolean, default: false },
  missedCount: { type: Number, default: 0, min: 0 },
  lastReminderSent: { type: String, default: "" },
  stock: { type: Number, default: 30, min: 0 },
  refillAt: { type: Number, default: 7, min: 0 },
  refillNotified: { type: Boolean, default: false },
  notes: { type: String, default: "", trim: true },
  lastResetDate: { type: String, default: "" },
  snoozedUntil: { type: Date, default: null },
  snoozeCount: { type: Number, default: 0, min: 0 }
}, { timestamps: true });

// Indexes for performance
medicineSchema.index({ userId: 1, lastResetDate: 1 });
medicineSchema.index({ taken: 1 });
medicineSchema.index({ userId: 1, createdAt: 1 });
medicineSchema.index({ confirmationPending: 1, taken: 1 }); // For escalation check
medicineSchema.index({ refillNotified: 1 }); // For low stock check

module.exports = mongoose.model("Medicine", medicineSchema);

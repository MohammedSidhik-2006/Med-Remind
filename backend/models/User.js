const mongoose = require("mongoose");

const pushSubscriptionSchema = new mongoose.Schema({
  endpoint: { type: String, required: true },
  keys: {
    p256dh: { type: String, required: true },
    auth:   { type: String, required: true }
  },
  userAgent: { type: String, default: "" },
  updatedAt: { type: Date, default: Date.now }
}, { _id: false });

const userSchema = new mongoose.Schema({
  name:     { type: String, required: true, trim: true, minlength: 2 },
  email:    { type: String, required: true, unique: true, lowercase: true, trim: true, index: true },
  password: { type: String, required: true },
  role:     { type: String, enum: ["user", "admin"], default: "user" },
  avatar:   { type: String, default: "👤" },
  pushSubscription: { type: pushSubscriptionSchema, default: null },
  pushSubscriptions: { type: [pushSubscriptionSchema], default: [] },
  streak:         { type: Number, default: 0 },
  longestStreak:  { type: Number, default: 0 },
  lastStreakDate: { type: String, default: "" },
  resetPasswordCode: { type: String, default: null },
  resetPasswordExpires: { type: Date, default: null },
  maxMissedThreshold: { type: Number, default: 3 }
}, { timestamps: true });

module.exports = mongoose.model("User", userSchema);

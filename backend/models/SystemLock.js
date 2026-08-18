const mongoose = require("mongoose");

const lockSchema = new mongoose.Schema({
  lockName: { type: String, required: true, unique: true },
  lockedAt: { type: Date, required: true },
  expiresAt: { type: Date, required: true },
  lockedBy: { type: String, required: true }
});

module.exports = mongoose.model("SystemLock", lockSchema);

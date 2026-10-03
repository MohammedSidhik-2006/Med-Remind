const mongoose = require("mongoose");

const lockSchema = new mongoose.Schema({
  lockName: { type: String, required: true, unique: true },
  lockedAt: { type: Date, required: true },
  expiresAt: { type: Date, required: true },
  lockedBy: { type: String, required: true }
});

// TTL index: MongoDB auto-deletes the lock document after expiresAt passes.
// This guarantees that a crashed server can NEVER permanently block the cron
// across restarts. MongoDB's TTL sweeper runs every 60 seconds so locks
// self-heal within 1 minute of a crash.
lockSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

module.exports = mongoose.model("SystemLock", lockSchema);

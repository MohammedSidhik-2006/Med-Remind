const mongoose = require("mongoose");

const auditLogSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  userEmail: { type: String, default: "" },
  action: { type: String, required: true }, // "medicine_added", "medicine_deleted", "login", "register"
  details: { type: String, default: "" },
  ip: { type: String, default: "" }
}, { timestamps: true });

module.exports = mongoose.model("AuditLog", auditLogSchema);

const mongoose = require("mongoose");

const caregiverRelationSchema = new mongoose.Schema({
  patientId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  caregiverId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  relationshipLabel: { 
    type: String, 
    enum: ["Father", "Mother", "Husband", "Wife", "Son", "Daughter", "Other"],
    default: "Other",
    required:true
  }
}, { timestamps: true });

// A patient-caregiver pair must be unique, but a patient can have multiple caregivers and a caregiver can have multiple patients
caregiverRelationSchema.index({ patientId: 1, caregiverId: 1 }, { unique: true });
caregiverRelationSchema.index({ patientId: 1 });
caregiverRelationSchema.index({ caregiverId: 1 });

module.exports = mongoose.model("CaregiverRelation", caregiverRelationSchema);
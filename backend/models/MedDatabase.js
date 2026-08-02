const mongoose = require("mongoose");

const medDatabaseSchema = new mongoose.Schema({
  name: { type: String, required: true, unique: true },
  commonDosages: { type: [String], default: [] }, // ["500mg", "250mg"]
  category: { type: String, default: "" },        // "Antibiotic", "Painkiller" etc.
  notes: { type: String, default: "" }
}, { timestamps: true });

module.exports = mongoose.model("MedDatabase", medDatabaseSchema);

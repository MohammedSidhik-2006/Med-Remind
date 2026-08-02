/**
 * Usage: node scripts/makeAdmin.js admin@example.com
 */

const mongoose = require("mongoose");
const User     = require("../models/User");
require("dotenv").config({ path: "../.env" });

const email = process.argv[2];
if (!email) { console.error("Usage: node scripts/makeAdmin.js <email>"); process.exit(1); }

mongoose.connect(process.env.MONGO_URI).then(async () => {
  const user = await User.findOne({ email });
  if (!user) { console.error(`❌ No user found with email: ${email}`); process.exit(1); }
  await User.updateOne({ email }, { $set: { role: "admin" } });
  console.log(`✅ Admin role granted to: ${email}`);
  process.exit(0);
}).catch(err => { console.error("DB error:", err.message); process.exit(1); });


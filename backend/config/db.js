const mongoose = require("mongoose");

const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI, {
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000
    });
    console.log("✅ MongoDB Connected");

    // Safe index cleanup: Drop legacy index that blocked multi-dose daily logging
    try {
      await mongoose.connection.collection("doselogs").dropIndex("userId_1_medicineId_1_date_1").catch(() => {});
    } catch {}

    mongoose.connection.on("disconnected", () => {
      console.warn("⚠️  MongoDB disconnected — attempting reconnect...");
    });

    mongoose.connection.on("error", (err) => {
      console.error("❌ MongoDB error:", err.message);
    });
  } catch (err) {
    console.error("❌ MongoDB connection failed:", err.message);
    process.exit(1);
  }
};

module.exports = connectDB;

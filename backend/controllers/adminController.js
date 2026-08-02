const mongoose   = require("mongoose");
const User        = require("../models/User");
const Medicine    = require("../models/Medicine");
const AuditLog    = require("../models/AuditLog");
const MedDatabase = require("../models/MedDatabase");
const DoseLog     = require("../models/DoseLog");
const { sendPushNotification } = require("../services/pushService");

const getLocalDate = (d = new Date()) => {
  const tz = process.env.TZ || "Asia/Kolkata";
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour12: false
  });
  const parts = formatter.formatToParts(d);
  const getPart = type => parts.find(p => p.type === type).value;
  return `${getPart("year")}-${getPart("month")}-${getPart("day")}`;
};

exports.requireAdmin = (req, res, next) => {
  if (!req.user || req.user.role !== "admin") {
    return res.status(403).json({ message: "Admin access required" });
  }
  next();
};

exports.getUsers = async (req, res) => {
  try {
    const today = getLocalDate();
    const users = await User.find({}).select("-password").lean();

    const result = await Promise.all(users.map(async (u) => {
      const meds   = await Medicine.find({ userId: u._id }).lean();
      const active = meds.filter(m => {
        if (m.startDate && today < m.startDate) return false;
        if (m.endDate   && today > m.endDate)   return false;
        return true;
      });
      const taken     = active.filter(m => m.taken).length;
      const adherence = active.length > 0 ? Math.round((taken / active.length) * 100) : null;
      return { ...u, todayAdherence: adherence, totalMeds: meds.length, activeMeds: active.length };
    }));

    res.json(result);
  } catch (err) {
    console.error("getUsers:", err.message);
    res.status(500).json({ message: "Server error" });
  }
};

exports.getAuditLogs = async (req, res) => {
  try {
    const page  = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(200, parseInt(req.query.limit) || 100);
    const logs  = await AuditLog.find({}).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit);
    res.json(logs);
  } catch (err) {
    console.error("getAuditLogs:", err.message);
    res.status(500).json({ message: "Server error" });
  }
};

exports.getMedDatabase = async (req, res) => {
  try {
    const meds = await MedDatabase.find({}).sort({ name: 1 });
    res.json(meds);
  } catch (err) {
    console.error("getMedDatabase:", err.message);
    res.status(500).json({ message: "Server error" });
  }
};

exports.addMedDatabase = async (req, res) => {
  try {
    const name          = (req.body.name     || "").trim();
    const category      = (req.body.category || "").trim();
    const notes         = (req.body.notes    || "").trim();
    const commonDosages = Array.isArray(req.body.commonDosages) ? req.body.commonDosages : [];

    if (!name) return res.status(400).json({ message: "Name is required" });

    const med = await MedDatabase.create({ name, commonDosages, category, notes });
    AuditLog.create({ userId: req.user.id, userEmail: req.user.email || "", action: "med_db_added", details: `Added to DB: ${name}` }).catch(() => {});
    res.status(201).json(med);
  } catch (err) {
    if (err.code === 11000) return res.status(409).json({ message: "Medicine already exists in database" });
    console.error("addMedDatabase:", err.message);
    res.status(500).json({ message: "Server error" });
  }
};

exports.deleteMedDatabase = async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id))
      return res.status(400).json({ message: "Invalid ID" });

    const med = await MedDatabase.findByIdAndDelete(req.params.id);
    if (!med) return res.status(404).json({ message: "Not found" });

    AuditLog.create({ userId: req.user.id, userEmail: req.user.email || "", action: "med_db_deleted", details: `Removed from DB: ${med.name}` }).catch(() => {});
    res.json({ message: "Deleted" });
  } catch (err) {
    console.error("deleteMedDatabase:", err.message);
    res.status(500).json({ message: "Server error" });
  }
};

// Broadcast push notification to all users who have a subscription
exports.broadcastAlert = async (req, res) => {
  try {
    const title   = (req.body.subject || req.body.title || "").trim();
    const message = (req.body.message || "").trim();

    if (!title || !message)
      return res.status(400).json({ message: "Title and message are required" });

    const users = await User.find({ "pushSubscription.endpoint": { $exists: true } })
      .select("_id pushSubscription")
      .lean();

    let sent = 0;
    for (const user of users) {
      const ok = await sendPushNotification(user.pushSubscription, {
        title,
        body: message,
        icon: "/logo192.png",
        tag:  "broadcast"
      }, user._id);
      if (ok) sent++;
    }

    AuditLog.create({
      userId: req.user.id,
      userEmail: req.user.email || "",
      action: "broadcast_sent",
      details: `"${title}" → ${sent}/${users.length} users (push)`
    }).catch(() => {});

    res.json({ message: `Broadcast push sent to ${sent} of ${users.length} subscribed users` });
  } catch (err) {
    console.error("broadcastAlert:", err.message);
    res.status(500).json({ message: "Server error" });
  }
};

exports.deleteUser = async (req, res) => {
  try {
    const userId = req.params.id;
    if (userId === req.user.id) {
      return res.status(400).json({ message: "Cannot delete your own admin account" });
    }
    const userRoleConf = await User.findById(userId);
    if(userRoleConf && userRoleConf.role === 'admin') {
       return res.status(400).json({ message: "Cannot delete another admin account directly" });
    }
    
    // Cascading delete
    await Medicine.deleteMany({ userId });
    await DoseLog.deleteMany({ userId });
    await AuditLog.deleteMany({ userId });
    await User.findByIdAndDelete(userId);

    // Optional: Log it via admin
    await AuditLog.create({
      userId: req.user.id,
      userEmail: req.user.email,
      action: "user_deleted",
      details: `Admin deleted user account ${userRoleConf ? userRoleConf.email : userId}`,
      ip: req.ip
    });

    res.json({ message: "User completely deleted along with all data" });
  } catch (error) {
    console.error("Delete user error:", error.message);
    res.status(500).json({ message: "Server error" });
  }
};

exports.getAllMedicines = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20; // Pagination
    const skip = (page - 1) * limit;

    const totalMedicines = await Medicine.countDocuments();
    const medicines = await Medicine.find()
      .populate("userId", "name email") // Fetch the owner details gracefully
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean();

    res.json({
      medicines,
      currentPage: page,
      totalPages: Math.ceil(totalMedicines / limit),
      totalMedicines,
    });
  } catch (error) {
    console.error("Get all medicines error:", error.message);
    res.status(500).json({ message: "Server error" });
  }
};

exports.deleteUserMedicine = async (req, res) => {
  try {
    const { id } = req.params;
    const medicine = await Medicine.findById(id);
    if (!medicine) return res.status(404).json({ message: "Medicine not found" });

    await DoseLog.deleteMany({ medicineId: id });
    await Medicine.findByIdAndDelete(id);

    await AuditLog.create({
      userId: req.user.id,
      userEmail: req.user.email,
      action: "medicine_deleted_by_admin",
      details: `Admin deleted medicine ${medicine.name} (ID: ${id})`,
      ip: req.ip
    });

    res.json({ message: "Medicine and related logs permanently deleted" });
  } catch (error) {
    console.error("Delete user medicine error:", error.message);
    res.status(500).json({ message: "Server error" });
  }
};

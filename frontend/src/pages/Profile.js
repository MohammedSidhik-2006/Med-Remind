import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import Navbar from "../components/Navbar";
import Sidebar from "../components/Sidebar";
import Footer from "../components/Footer";
import API from "../services/api";
import { setupPushNotifications, isPushSubscribed, unsubscribePush } from "../services/notifications";

function Modal({ title, message, icon, onConfirm, onCancel, confirmText = "OK", showCancel = false, confirmClass }) {
  return (
    <div style={{
      position: "fixed", inset: 0, background: "rgba(15,23,42,0.6)",
      display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000,
      backdropFilter: "blur(4px)"
    }}>
      <div className="form-card" style={{
        maxWidth: "400px", width: "90%", textAlign: "center",
        boxShadow: "var(--shadow-lg)"
      }}>
        <div style={{ fontSize: "52px", marginBottom: "15px" }}>{icon}</div>
        <h3 style={{ color: "var(--text-main)", marginBottom: "10px", fontSize: "20px", fontWeight: "800" }}>{title}</h3>
        <p style={{ color: "var(--text-light)", marginBottom: "25px", lineHeight: "1.6", fontSize: "14px" }}>{message}</p>
        <div style={{ display: "flex", gap: "12px", justifyContent: "center" }}>
          {showCancel && (
            <button onClick={onCancel} style={{
              flex: 1, padding: "12px", background: "#e2e8f0", color: "var(--text-muted)",
              border: "none", borderRadius: "10px", fontSize: "15px",
              fontWeight: "700", cursor: "pointer"
            }}>Cancel</button>
          )}
          <button onClick={onConfirm} style={{
            flex: 1, padding: "12px", color: "white", border: "none",
            borderRadius: "10px", fontSize: "15px", fontWeight: "700", cursor: "pointer",
            background: confirmClass === "danger" ? "var(--danger)" : "var(--primary)"
          }}>{confirmText}</button>
        </div>
      </div>
    </div>
  );
}

function Profile() {
  const navigate = useNavigate();
  const [profile, setProfile] = useState(null);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [infoModal, setInfoModal] = useState(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  // Edit name
  const [editName, setEditName] = useState("");
  const [nameMsg, setNameMsg] = useState("");

  // Change password
  const [currentPwd, setCurrentPwd] = useState("");
  const [newPwd, setNewPwd] = useState("");
  const [confirmPwd, setConfirmPwd] = useState("");
  const [pwdMsg, setPwdMsg] = useState("");
  const [pwdError, setPwdError] = useState("");

  // Delete account
  const [showDelete, setShowDelete] = useState(false);
  const [deletePwd, setDeletePwd] = useState("");
  const [deleteError, setDeleteError] = useState("");

  const [saving, setSaving] = useState(false);

  // Push notifications state
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [maxMissedThreshold, setMaxMissedThreshold] = useState(3);

  useEffect(() => {
    const checkPush = async () => {
      const sub = await isPushSubscribed();
      setIsSubscribed(sub);
    };
    checkPush();
  }, []);

  const handleTogglePush = async () => {
    if (isSubscribed) {
      await unsubscribePush();
      setIsSubscribed(false);
    } else {
      const ok = await setupPushNotifications();
      if (ok) {
        setIsSubscribed(true);
      } else {
        setInfoModal({ 
          title: "Setup Blocked", 
          message: "Failed to enable notifications. Please ensure you allow notifications in your browser settings.", 
          icon: "⚠️" 
        });
      }
    }
  };

  const fetchProfile = useCallback(async () => {
    try {
      const res = await API.get("/auth/profile");
      setProfile(res.data.user);
      setStats(res.data.stats);
      setEditName(res.data.user.name);
      setMaxMissedThreshold(res.data.user.maxMissedThreshold !== undefined ? res.data.user.maxMissedThreshold : 3);
    } catch (err) {
      console.error("fetchProfile error:", err);
      if (err.response?.status === 401) {
        navigate("/");
      }
    } finally {
      setLoading(false);
    }
  }, [navigate]);

  const handleUpdateThreshold = async (e) => {
    const val = parseInt(e.target.value, 10);
    setMaxMissedThreshold(val);
    try {
      await API.put("/auth/profile", { maxMissedThreshold: val });
      setInfoModal({ title: "Updated", message: "Missed dose alert threshold updated successfully.", icon: "✓" });
    } catch (err) {
      setInfoModal({ title: "Update Failed", message: "Failed to update threshold.", icon: "✗" });
    }
  };

  const handleLogout = () => {
    setShowLogoutConfirm(true);
  };

  const handleLogoutConfirm = () => {
    localStorage.removeItem("token");
    navigate("/");
  };

  useEffect(() => {
    fetchProfile();
  }, [fetchProfile]);

  const handleUpdateName = async () => {
    if (!editName.trim()) return;
    setSaving(true);
    setNameMsg("");
    try {
      const res = await API.put("/auth/profile", { name: editName.trim() });
      localStorage.setItem("token", res.data.token);
      setProfile(p => ({ ...p, name: res.data.name }));
      setNameMsg("Name updated successfully!");
    } catch (err) {
      setNameMsg(err.response?.data?.message || "Failed to update name");
    } finally {
      setSaving(false);
    }
  };

  const handleChangePassword = async () => {
    setPwdMsg(""); setPwdError("");
    if (!currentPwd || !newPwd || !confirmPwd) {
      setPwdError("All password fields are required."); return;
    }
    if (newPwd !== confirmPwd) {
      setPwdError("New passwords do not match."); return;
    }
    if (newPwd.length < 6) {
      setPwdError("New password must be at least 6 characters."); return;
    }
    setSaving(true);
    try {
      const res = await API.put("/auth/profile", { currentPassword: currentPwd, newPassword: newPwd });
      localStorage.setItem("token", res.data.token);
      setCurrentPwd(""); setNewPwd(""); setConfirmPwd("");
      setPwdMsg("Password changed successfully!");
    } catch (err) {
      setPwdError(err.response?.data?.message || "Failed to change password");
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteAccount = async () => {
    setDeleteError("");
    if (!deletePwd) { setDeleteError("Please enter your password."); return; }
    try {
      await API.delete("/auth/account", { data: { password: deletePwd } });
      localStorage.removeItem("token");
      navigate("/");
    } catch (err) {
      setDeleteError(err.response?.data?.message || "Failed to delete account");
    }
  };

  if (loading) {
    return (
      <div style={{ minHeight: "100vh", background: "var(--bg-app)", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <p style={{ color: "var(--text-light)", fontWeight: "600" }}>Loading profile metrics...</p>
      </div>
    );
  }

  const memberSince = profile?.createdAt
    ? new Date(profile.createdAt).toLocaleDateString("en-US", { year: "numeric", month: "long" })
    : "—";

  return (
    <div className="dashboard-container">
      {/* Sidebar navigation */}
      <Sidebar isOpen={isSidebarOpen} onClose={() => setIsSidebarOpen(false)} />

      {/* Main Layout Area */}
      <div className="main-layout-content">
        <Navbar onToggleSidebar={() => setIsSidebarOpen(true)} />

        <header className="page-header">
          <button className="back-btn" onClick={() => navigate("/dashboard")}>←</button>
          <h2 className="page-title">Profile & Settings</h2>
        </header>

        <main className="dashboard" style={{ maxWidth: "800px", margin: "0 auto", width: "100%", padding: "24px 20px" }}>
          
          {/* Avatar + Info Card */}
          <div className="profile-header-card" style={{ 
            display: "flex", alignItems: "center", gap: "24px", flexWrap: "wrap",
            background: "white", border: "1px solid var(--border-light)", borderRadius: "16px",
            padding: "32px", marginBottom: "32px", boxShadow: "var(--shadow-sm)" 
          }}>
            <div style={{
              width: "72px", height: "72px", borderRadius: "50%",
              background: "var(--primary-light)", border: "2px solid var(--primary)",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: "22px", fontWeight: "800", color: "var(--primary)",
              flexShrink: 0, boxShadow: "var(--shadow-sm)"
            }}>{profile?.name ? profile.name.split(" ").filter(Boolean).map(w => w[0]).join("").toUpperCase().slice(0, 2) : "U"}</div>
            <div style={{ flex: 1, textAlign: "left" }}>
              <div style={{ fontSize: "20px", fontWeight: "800", color: "var(--text-main)", letterSpacing: "-0.5px" }}>{profile?.name}</div>
              <div style={{ fontSize: "14px", color: "var(--text-light)", marginTop: "4px", fontWeight: "600" }}>{profile?.email}</div>
              <div style={{ fontSize: "12px", color: "var(--text-light)", marginTop: "4px", fontWeight: "500" }}>Member since {memberSince}</div>
            </div>
            <div>
              <button onClick={handleLogout} className="delete-btn" style={{ padding: "8px 16px", fontSize: "12px" }}>Sign Out</button>
            </div>
          </div>

          {/* Stats Row */}
          {stats && (
            <div className="profile-stats-grid" style={{ 
              display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", 
              gap: "16px", marginBottom: "32px" 
            }}>
              {[
                { label: "Total Medications", value: stats.totalMedicines, color: "var(--primary)", icon: "💊" },
                { label: "Active Today", value: stats.activeMedicines, color: "var(--info)", icon: "✓" },
                { label: "Taken Today", value: stats.takenToday, color: "var(--success)", icon: "👍" },
                { label: "Low Stock Alert", value: stats.lowStock, color: stats.lowStock > 0 ? "var(--danger)" : "var(--success)", icon: "⚠️" },
              ].map(({ label, value, color, icon }) => (
                <div key={label} style={{
                  background: "white", border: "1px solid var(--border-light)", borderRadius: "var(--radius-md)", padding: "20px 14px",
                  textAlign: "center", boxShadow: "var(--shadow-sm)"
                }}>
                  <div style={{ fontSize: "16px", marginBottom: "4px" }}>{icon}</div>
                  <div style={{ fontSize: "24px", fontWeight: "800", color, marginTop: "4px" }}>{value}</div>
                  <div style={{ fontSize: "11px", color: "var(--text-light)", marginTop: "6px", fontWeight: "750", textTransform: "uppercase", letterSpacing: "0.5px" }}>{label}</div>
                </div>
              ))}
            </div>
          )}

          {/* Settings Panels Grid */}
          <div style={{ display: "flex", flexDirection: "column", gap: "24px", marginBottom: "40px" }}>
            
            {/* Basic Info panel */}
            <div className="schedule-card">
              <h3 style={{ fontSize: "15px", fontWeight: "800", color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.8px", marginBottom: "20px" }}>Basic Information</h3>
              {nameMsg && (
                <div style={{ 
                  background: nameMsg.includes("successfully") ? "var(--success-light)" : "var(--danger-light)", 
                  color: nameMsg.includes("successfully") ? "var(--success)" : "var(--danger)", 
                  padding: "10px 14px", borderRadius: "8px", marginBottom: "16px", fontSize: "13px", fontWeight: "600",
                  border: "1px solid rgba(0,0,0,0.02)"
                }}>{nameMsg}</div>
              )}
              <div className="form-group" style={{ display: "flex", gap: "12px", alignItems: "flex-end" }}>
                <div style={{ flex: 1 }}>
                  <label>Full Name</label>
                  <input
                    value={editName}
                    onChange={e => setEditName(e.target.value)}
                    placeholder="Enter full name"
                    style={{ marginBottom: 0 }}
                  />
                </div>
                <button className="btn-primary" onClick={handleUpdateName} disabled={saving || !editName.trim()} style={{ width: "auto", padding: "14px 24px", margin: 0 }}>
                  {saving ? "Saving..." : "Save Name"}
                </button>
              </div>
            </div>

            {/* Application Configuration panel */}
            <div className="schedule-card">
              <h3 style={{ fontSize: "15px", fontWeight: "800", color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.8px", marginBottom: "20px" }}>Medication Settings</h3>
              <div className="form-group">
                <label>Missed Dose Lockout Threshold</label>
                <select value={maxMissedThreshold} onChange={handleUpdateThreshold}>
                  <option value={1}>1 Missed Dose (Strict)</option>
                  <option value={2}>2 Missed Doses</option>
                  <option value={3}>3 Missed Doses (Default)</option>
                  <option value={4}>4 Missed Doses</option>
                  <option value={5}>5 Missed Doses (Lenient)</option>
                </select>
                <span style={{ fontSize: "12px", color: "var(--text-light)", marginTop: "6px", display: "block", fontWeight: "500" }}>
                  A medicine slot is locked as "Missed" and cannot be taken once this threshold is breached. Linked caregivers receive emergency alerts at threshold limit.
                </span>
              </div>
            </div>

            {/* Push Notifications panel */}
            <div className="schedule-card">
              <h3 style={{ fontSize: "15px", fontWeight: "800", color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.8px", marginBottom: "20px" }}>Browser Push Notifications</h3>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "16px", flexWrap: "wrap" }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: "700", color: "var(--text-main)", fontSize: "14px" }}>Web Push Reminders</div>
                  <div style={{ fontSize: "12px", color: "var(--text-light)", marginTop: "4px", fontWeight: "500", lineHeight: "1.4" }}>
                    Enable browser notification prompts to alert you in real-time when a medication dose is scheduled or low stock thresholds are crossed.
                  </div>
                </div>
                <button 
                  onClick={handleTogglePush}
                  className={`btn-${isSubscribed ? "secondary" : "primary"}`} 
                  style={{ width: "auto", minWidth: "160px", margin: 0, padding: "12px 20px" }}
                >
                  {isSubscribed ? "Disable Push Alerts" : "Enable Push Alerts"}
                </button>
              </div>
            </div>

            {/* Password panel */}
            <div className="schedule-card">
              <h3 style={{ fontSize: "15px", fontWeight: "800", color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.8px", marginBottom: "20px" }}>Change Account Password</h3>
              {pwdMsg && <div style={{ background: "var(--success-light)", color: "var(--success)", padding: "10px 14px", borderRadius: "8px", marginBottom: "16px", fontSize: "13px", fontWeight: "600" }}>{pwdMsg}</div>}
              {pwdError && <div style={{ background: "var(--danger-light)", color: "var(--danger)", padding: "10px 14px", borderRadius: "8px", marginBottom: "16px", fontSize: "13px", fontWeight: "600" }}>{pwdError}</div>}
              
              <div className="form-group">
                <label>Current Password</label>
                <input type="password" value={currentPwd} onChange={e => setCurrentPwd(e.target.value)} />
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
                <div className="form-group">
                  <label>New Password</label>
                  <input type="password" value={newPwd} onChange={e => setNewPwd(e.target.value)} />
                </div>
                <div className="form-group">
                  <label>Confirm New Password</label>
                  <input type="password" value={confirmPwd} onChange={e => setConfirmPwd(e.target.value)} />
                </div>
              </div>
              <button className="btn-primary" onClick={handleChangePassword} disabled={saving} style={{ width: "auto", padding: "14px 28px", marginLeft: "auto", display: "block", margin: 0 }}>
                {saving ? "Saving..." : "Update Password"}
              </button>
            </div>

            {/* Destructive account removal */}
            <div className="schedule-card" style={{ border: "1.5px solid rgba(244, 63, 94, 0.2)", background: "var(--danger-light)" }}>
              <h3 style={{ fontSize: "15px", fontWeight: "800", color: "var(--danger)", textTransform: "uppercase", letterSpacing: "0.8px", marginBottom: "10px" }}>Danger Zone</h3>
              <p style={{ fontSize: "13px", color: "var(--text-muted)", marginBottom: "20px", fontWeight: "500", lineHeight: "1.5" }}>
                Permanently delete your profile account, caregiver linkages, and medication history logs from our servers. This action is definitive.
              </p>
              
              {showDelete ? (
                <div style={{ background: "white", padding: "20px", borderRadius: "12px", border: "1.5px solid rgba(244, 63, 94, 0.25)" }}>
                  <label style={{ fontWeight: "700", color: "var(--text-main)", fontSize: "13px", display: "block", marginBottom: "8px" }}>Enter Password to Confirm Deletion</label>
                  {deleteError && <div style={{ background: "var(--danger-light)", color: "var(--danger)", padding: "10px 14px", borderRadius: "8px", marginBottom: "12px", fontSize: "13px", fontWeight: "600" }}>{deleteError}</div>}
                  <div style={{ display: "flex", gap: "12px", alignItems: "center" }}>
                    <input type="password" value={deletePwd} onChange={e => setDeletePwd(e.target.value)} placeholder="Type password" style={{ flex: 1, marginBottom: 0 }} />
                    <button className="btn-primary" onClick={handleDeleteAccount} style={{ background: "var(--danger)", width: "auto", margin: 0, padding: "12px 24px" }}>Confirm Delete</button>
                    <button className="btn-secondary" onClick={() => { setShowDelete(false); setDeletePwd(""); setDeleteError(""); }} style={{ width: "auto", margin: 0, padding: "12px 24px" }}>Cancel</button>
                  </div>
                </div>
              ) : (
                <button onClick={() => setShowDelete(true)} className="delete-btn" style={{ width: "auto", padding: "14px 28px" }}>Delete Account Permanently</button>
              )}
            </div>

          </div>

        </main>
        <Footer />
      </div>

      {infoModal && (
        <Modal
          icon={infoModal.icon}
          title={infoModal.title}
          message={infoModal.message}
          onConfirm={() => setInfoModal(null)}
        />
      )}

      {showLogoutConfirm && (
        <Modal
          title="Sign Out"
          message="Are you sure you want to log out of MedRemind?"
          confirmText="Log Out"
          confirmClass="danger"
          showCancel={true}
          onConfirm={handleLogoutConfirm}
          onCancel={() => setShowLogoutConfirm(false)}
        />
      )}
    </div>
  );
}

export default Profile;

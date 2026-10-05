import React, { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import AppShell from "../components/AppShell";
import { Card, Button, Input, Badge } from "../components/UI";
import { useToast } from "../components/Toast";
import API from "../services/api";
import { setupPushNotifications, isPushSubscribed, unsubscribePush } from "../services/notifications";
import { clearOfflineStorage } from "../services/offlineSync";
import "./Profile.css";

const THRESHOLD_OPTIONS = [
  { val: 1, title: "1 Dose", desc: "Strict (High Risk)", icon: "🎯" },
  { val: 2, title: "2 Doses", desc: "Moderate Grace", icon: "⏱️" },
  { val: 3, title: "3 Doses", desc: "Clinical Default", icon: "🛡️" },
  { val: 4, title: "4 Doses", desc: "Extended Grace", icon: "🔄" },
  { val: 5, title: "5 Doses", desc: "Flexible Window", icon: "✨" },
];

function Profile() {
  const navigate = useNavigate();
  const { addToast } = useToast();

  const [profile, setProfile] = useState(null);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  // Edit Name State
  const [isEditingName, setIsEditingName] = useState(false);
  const [editName, setEditName] = useState("");
  const [savingName, setSavingName] = useState(false);

  // Missed Dose Threshold
  const [maxMissedThreshold, setMaxMissedThreshold] = useState(3);
  const [savingThreshold, setSavingThreshold] = useState(false);

  // Push Notifications State
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [togglingPush, setTogglingPush] = useState(false);

  // Password Update State
  const [currentPwd, setCurrentPwd] = useState("");
  const [newPwd, setNewPwd] = useState("");
  const [confirmPwd, setConfirmPwd] = useState("");
  const [showPwd, setShowPwd] = useState(false);
  const [savingPwd, setSavingPwd] = useState(false);

  // Modals
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deletePwd, setDeletePwd] = useState("");
  const [deletingAccount, setDeletingAccount] = useState(false);

  // Check push subscription
  useEffect(() => {
    const checkPush = async () => {
      const sub = await isPushSubscribed();
      setIsSubscribed(sub);
    };
    checkPush();
  }, []);

  const fetchProfile = useCallback(async () => {
    try {
      const res = await API.get("/auth/profile");
      if (res?.data?.user) {
        setProfile(res.data.user);
        setStats(res.data.stats || {});
        setEditName(res.data.user.name || "");
        setMaxMissedThreshold(
          res.data.user.maxMissedThreshold !== undefined ? res.data.user.maxMissedThreshold : 3
        );
      }
    } catch (err) {
      console.error("fetchProfile error:", err.message);
      if (err.response?.status === 401) {
        navigate("/");
      } else {
        addToast("Failed to fetch profile details", "error");
      }
    } finally {
      setLoading(false);
    }
  }, [navigate, addToast]);

  useEffect(() => {
    fetchProfile();
  }, [fetchProfile]);

  // Handle Update Name
  const handleUpdateName = async (e) => {
    e.preventDefault();
    if (!editName.trim()) {
      addToast("Please enter a valid full name", "error");
      return;
    }
    setSavingName(true);
    try {
      const res = await API.put("/auth/profile", { name: editName.trim() });
      if (res.data?.token) {
        localStorage.setItem("token", res.data.token);
      }
      setProfile((prev) => ({ ...prev, name: res.data.name || editName.trim() }));
      setIsEditingName(false);
      addToast("Profile name updated successfully!", "success");
    } catch (err) {
      addToast(err.response?.data?.message || "Failed to update profile name", "error");
    } finally {
      setSavingName(false);
    }
  };

  // Handle Update Missed Dose Threshold
  const handleSelectThreshold = async (val) => {
    if (val === maxMissedThreshold || savingThreshold) return;
    setMaxMissedThreshold(val);
    setSavingThreshold(true);
    try {
      await API.put("/auth/profile", { maxMissedThreshold: val });
      addToast(`Missed dose lockout set to ${val} ${val === 1 ? "dose" : "doses"}`, "success");
    } catch (err) {
      addToast("Failed to update missed dose threshold", "error");
    } finally {
      setSavingThreshold(false);
    }
  };

  // Handle Push Notification Toggle
  const handleTogglePush = async () => {
    setTogglingPush(true);
    try {
      if (isSubscribed) {
        await unsubscribePush();
        setIsSubscribed(false);
        addToast("Web push alerts disabled on this browser", "info");
      } else {
        const ok = await setupPushNotifications();
        if (ok) {
          setIsSubscribed(true);
          addToast("Web push alerts & alarm schedules enabled!", "success");
        } else {
          addToast("Notification permission was denied. Please allow notifications in browser settings.", "warning");
        }
      }
    } catch (err) {
      addToast("Failed to modify push notification settings", "error");
    } finally {
      setTogglingPush(false);
    }
  };

  // Handle Password Update
  const handleChangePassword = async (e) => {
    e.preventDefault();
    if (!currentPwd || !newPwd || !confirmPwd) {
      addToast("All password fields are required", "warning");
      return;
    }
    if (newPwd !== confirmPwd) {
      addToast("New password and confirmation do not match", "error");
      return;
    }
    if (newPwd.length < 6) {
      addToast("New password must be at least 6 characters long", "warning");
      return;
    }

    setSavingPwd(true);
    try {
      const res = await API.put("/auth/profile", {
        currentPassword: currentPwd,
        newPassword: newPwd
      });
      if (res.data?.token) {
        localStorage.setItem("token", res.data.token);
      }
      setCurrentPwd("");
      setNewPwd("");
      setConfirmPwd("");
      addToast("Account security password changed successfully!", "success");
    } catch (err) {
      addToast(err.response?.data?.message || "Failed to update password. Verify current password.", "error");
    } finally {
      setSavingPwd(false);
    }
  };

  // Handle Account Deletion
  const handleDeleteAccount = async (e) => {
    e.preventDefault();
    if (!deletePwd) {
      addToast("Please enter your current password to authorize account deletion", "warning");
      return;
    }
    setDeletingAccount(true);
    try {
      await API.delete("/auth/account", { data: { password: deletePwd } });
      await clearOfflineStorage();
      localStorage.removeItem("token");
      localStorage.removeItem("medremind_cached_medicines");
      localStorage.removeItem("medremind_cached_reports");
      addToast("Your MedRemind account and health records have been permanently removed", "info");
      navigate("/");
    } catch (err) {
      addToast(err.response?.data?.message || "Incorrect password. Could not delete account.", "error");
    } finally {
      setDeletingAccount(false);
    }
  };

  // Handle Logout
  const handleLogoutConfirm = async () => {
    try {
      await clearOfflineStorage();
    } catch {}
    localStorage.removeItem("token");
    navigate("/");
  };

  // Password Strength Calculation
  const getPasswordStrength = () => {
    if (!newPwd) return { pct: 0, text: "", color: "var(--border-light)" };
    let score = 0;
    if (newPwd.length >= 6) score += 33;
    if (newPwd.length >= 10) score += 25;
    if (/[A-Z]/.test(newPwd) && /[0-9]/.test(newPwd)) score += 25;
    if (/[^A-Za-z0-9]/.test(newPwd)) score += 17;

    const finalScore = Math.min(100, score);
    if (finalScore < 40) return { pct: finalScore, text: "Weak password", color: "var(--danger)" };
    if (finalScore < 75) return { pct: finalScore, text: "Moderate security", color: "var(--warning)" };
    return { pct: finalScore, text: "Strong security", color: "var(--success)" };
  };

  const pwdStrength = getPasswordStrength();

  const memberSince = profile?.createdAt
    ? new Date(profile.createdAt).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })
    : "—";

  const initials = profile?.name
    ? profile.name
        .split(" ")
        .filter(Boolean)
        .map((n) => n[0])
        .join("")
        .toUpperCase()
        .slice(0, 2)
    : "U";

  if (loading) {
    return (
      <AppShell title="Profile & Settings" showBackButton onBack={() => navigate("/dashboard")}>
        <div className="profile-page-wrapper" style={{ alignItems: "center", justifyContent: "center", minHeight: "60vh" }}>
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ animation: "spin 1s linear infinite", color: "var(--primary)" }}>
            <circle cx="12" cy="12" r="10" stroke="rgba(13, 148, 136, 0.2)" strokeWidth="3" />
            <path d="M12 2a10 10 0 0 1 10 10" stroke="var(--primary)" strokeWidth="3" />
          </svg>
          <p style={{ marginTop: "14px", color: "var(--text-muted)", fontWeight: "600", fontSize: "14px" }}>
            Loading patient profile & healthcare metrics...
          </p>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell 
      title="Profile & Settings" 
      subtitle="Manage your health records, clinical alerts, and security"
      showBackButton 
      onBack={() => navigate("/dashboard")}
    >
      <div className="profile-page-wrapper">
        
        {/* HERO PROFILE CARD */}
        <div className="profile-hero-card">
          <div className="profile-hero-left">
            <div className="profile-hero-avatar">
              {initials}
            </div>
            <div className="profile-hero-details">
              <div className="profile-hero-name-row">
                <h2 className="profile-hero-name">{profile?.name || "Patient"}</h2>
                <Badge variant={profile?.role === "admin" ? "warning" : "primary"} size="sm">
                  {profile?.role === "admin" ? "System Admin" : "Verified Patient"}
                </Badge>
              </div>
              <div className="profile-hero-email">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
                  <polyline points="22,6 12,13 2,6" />
                </svg>
                {profile?.email}
              </div>
              <div className="profile-hero-meta">
                Member since {memberSince}
              </div>
            </div>
          </div>

          <div className="profile-hero-actions">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsEditingName(!isEditingName)}
              icon={
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                  <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                </svg>
              }
            >
              {isEditingName ? "Cancel Edit" : "Edit Name"}
            </Button>
            <Button
              variant="danger"
              size="sm"
              onClick={() => setShowLogoutConfirm(true)}
              icon={
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                  <polyline points="16 17 21 12 16 7" />
                  <line x1="21" y1="12" x2="9" y2="12" />
                </svg>
              }
            >
              Sign Out
            </Button>
          </div>
        </div>

        {/* INLINE EDIT NAME EXPANDABLE PANEL */}
        {isEditingName && (
          <Card className="profile-edit-name-card">
            <div className="profile-card-body">
              <form onSubmit={handleUpdateName} style={{ display: "flex", gap: "12px", alignItems: "flex-end", flexWrap: "wrap" }}>
                <div style={{ flex: 1, minWidth: "220px" }}>
                  <Input
                    label="Edit Full Name"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    placeholder="Enter your full name"
                    required
                  />
                </div>
                <Button 
                  type="submit" 
                  variant="primary" 
                  disabled={savingName || !editName.trim()}
                  loading={savingName}
                >
                  Save Changes
                </Button>
              </form>
            </div>
          </Card>
        )}

        {/* LIVE PATIENT METRICS GRID */}
        {stats && (
          <div className="profile-metrics-grid">
            <div className="profile-metric-card">
              <div className="profile-metric-top">
                <span className="profile-metric-label">Total Medicines</span>
                <div className="profile-metric-icon-wrap" style={{ background: "var(--primary-light)", color: "var(--primary)" }}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="m10.5 20.5 10-10a4.95 4.95 0 1 0-7-7l-10 10a4.95 4.95 0 1 0 7 7Z"/>
                    <path d="m8.5 8.5 7 7"/>
                  </svg>
                </div>
              </div>
              <div className="profile-metric-value">{stats.totalMedicines ?? 0}</div>
              <div className="profile-metric-subtext">Active prescription schedules</div>
            </div>

            <div className="profile-metric-card">
              <div className="profile-metric-top">
                <span className="profile-metric-label">Active Today</span>
                <div className="profile-metric-icon-wrap" style={{ background: "var(--info-light)", color: "var(--info)" }}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
                    <line x1="16" y1="2" x2="16" y2="6"/>
                    <line x1="8" y1="2" x2="8" y2="6"/>
                    <line x1="3" y1="10" x2="21" y2="10"/>
                  </svg>
                </div>
              </div>
              <div className="profile-metric-value">{stats.activeMedicines ?? 0}</div>
              <div className="profile-metric-subtext">Doses due on today's agenda</div>
            </div>

            <div className="profile-metric-card">
              <div className="profile-metric-top">
                <span className="profile-metric-label">Taken Today</span>
                <div className="profile-metric-icon-wrap" style={{ background: "var(--success-light)", color: "var(--success)" }}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
                    <polyline points="22 4 12 14.01 9 11.01"/>
                  </svg>
                </div>
              </div>
              <div className="profile-metric-value" style={{ color: "var(--success)" }}>
                {stats.takenToday ?? 0}
              </div>
              <div className="profile-metric-subtext">Confirmed medication doses</div>
            </div>

            <div className="profile-metric-card">
              <div className="profile-metric-top">
                <span className="profile-metric-label">Stock Status</span>
                <div 
                  className="profile-metric-icon-wrap" 
                  style={{ 
                    background: (stats.lowStock ?? 0) > 0 ? "var(--danger-light)" : "var(--success-light)", 
                    color: (stats.lowStock ?? 0) > 0 ? "var(--danger)" : "var(--success)" 
                  }}
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/>
                  </svg>
                </div>
              </div>
              <div className="profile-metric-value" style={{ color: (stats.lowStock ?? 0) > 0 ? "var(--danger)" : "var(--text-primary)" }}>
                {stats.lowStock ?? 0}
              </div>
              <div className="profile-metric-subtext">
                {(stats.lowStock ?? 0) > 0 ? "Refills critically needed" : "All inventories adequate"}
              </div>
            </div>
          </div>
        )}

        {/* MEDICATION CLINICAL SETTINGS */}
        <Card>
          <div className="profile-card-header">
            <div className="profile-card-title-group">
              <div className="profile-card-icon">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
                </svg>
              </div>
              <div>
                <h3 className="profile-card-title">Missed Dose Lockout Safety Threshold</h3>
                <p className="profile-card-desc">Set how many unconfirmed doses trigger slot lockout and caregiver escalation</p>
              </div>
            </div>
          </div>

          <div className="profile-card-body">
            <div className="threshold-options-grid">
              {THRESHOLD_OPTIONS.map((opt) => {
                const isActive = maxMissedThreshold === opt.val;
                return (
                  <button
                    key={opt.val}
                    type="button"
                    className={`threshold-option-btn ${isActive ? "active" : ""}`}
                    onClick={() => handleSelectThreshold(opt.val)}
                    disabled={savingThreshold}
                  >
                    <span className="threshold-num">{opt.val}</span>
                    <span className="threshold-title">{opt.title}</span>
                    <span className="threshold-desc">{opt.desc}</span>
                  </button>
                );
              })}
            </div>

            <div className="threshold-info-banner">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ color: "var(--primary)", flexShrink: 0, marginTop: "2px" }}>
                <circle cx="12" cy="12" r="10"/>
                <line x1="12" y1="16" x2="12" y2="12"/>
                <line x1="12" y1="8" x2="12.01" y2="8"/>
              </svg>
              <div>
                <strong>Clinical Safeguard:</strong> When consecutive unacknowledged doses reach <strong>{maxMissedThreshold}</strong>, the dose slot is marked as Missed to prevent double-dosing hazard, and an automatic safety alert is dispatched to linked family caregivers.
              </div>
            </div>
          </div>
        </Card>

        {/* BROWSER PUSH & OFFLINE ALARMS */}
        <Card>
          <div className="profile-card-header">
            <div className="profile-card-title-group">
              <div className="profile-card-icon" style={{ background: "var(--info-light)", color: "var(--info)" }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
                  <path d="M13.73 21a2 2 0 0 1-3.46 0" />
                </svg>
              </div>
              <div>
                <h3 className="profile-card-title">Real-Time Push & Offline Alarms</h3>
                <p className="profile-card-desc">Scheduled notification alerts with multi-dose snooze and background sync</p>
              </div>
            </div>
          </div>

          <div className="profile-card-body">
            <div className="push-status-box">
              <div className="push-status-info">
                <div className="push-status-heading">
                  <span className="push-status-title">Web Push Reminders</span>
                  <Badge variant={isSubscribed ? "success" : "neutral"} size="sm">
                    {isSubscribed ? "● Active & Subscribed" : "○ Alerts Disabled"}
                  </Badge>
                </div>
                <p className="push-status-desc">
                  Enables native browser notification popups and device vibrations at scheduled dose times. Supports offline action handling so you can mark doses taken even without internet connectivity.
                </p>
              </div>

              <Button
                variant={isSubscribed ? "secondary" : "primary"}
                onClick={handleTogglePush}
                disabled={togglingPush}
                loading={togglingPush}
                icon={
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
                    <path d="M13.73 21a2 2 0 0 1-3.46 0" />
                  </svg>
                }
              >
                {isSubscribed ? "Disable Push Alerts" : "Enable Push Alerts"}
              </Button>
            </div>
          </div>
        </Card>

        {/* ACCOUNT SECURITY & PASSWORD UPDATE */}
        <Card>
          <div className="profile-card-header">
            <div className="profile-card-title-group">
              <div className="profile-card-icon" style={{ background: "var(--warning-light)", color: "var(--warning)" }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
                  <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
                </svg>
              </div>
              <div>
                <h3 className="profile-card-title">Security & Password</h3>
                <p className="profile-card-desc">Update your account access password and authentication security</p>
              </div>
            </div>
          </div>

          <div className="profile-card-body">
            <form onSubmit={handleChangePassword} className="password-form-grid">
              <div>
                <Input
                  label="Current Password"
                  type={showPwd ? "text" : "password"}
                  value={currentPwd}
                  onChange={(e) => setCurrentPwd(e.target.value)}
                  placeholder="Enter current password"
                  required
                />
              </div>

              <div className="password-inputs-row">
                <div>
                  <Input
                    label="New Password"
                    type={showPwd ? "text" : "password"}
                    value={newPwd}
                    onChange={(e) => setNewPwd(e.target.value)}
                    placeholder="At least 6 characters"
                    required
                  />
                  {newPwd && (
                    <>
                      <div className="password-strength-bar">
                        <div 
                          className="password-strength-fill" 
                          style={{ width: `${pwdStrength.pct}%`, backgroundColor: pwdStrength.color }} 
                        />
                      </div>
                      <span style={{ fontSize: "11px", fontWeight: "600", color: pwdStrength.color, marginTop: "4px", display: "inline-block" }}>
                        {pwdStrength.text}
                      </span>
                    </>
                  )}
                </div>

                <div>
                  <Input
                    label="Confirm New Password"
                    type={showPwd ? "text" : "password"}
                    value={confirmPwd}
                    onChange={(e) => setConfirmPwd(e.target.value)}
                    placeholder="Repeat new password"
                    required
                  />
                </div>
              </div>

              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "12px", marginTop: "6px" }}>
                <label style={{ display: "flex", alignItems: "center", gap: "8px", cursor: "pointer", fontSize: "13px", color: "var(--text-secondary)", userSelect: "none" }}>
                  <input
                    type="checkbox"
                    checked={showPwd}
                    onChange={(e) => setShowPwd(e.target.checked)}
                    style={{ width: "16px", height: "16px", accentColor: "var(--primary)" }}
                  />
                  Show passwords
                </label>

                <Button
                  type="submit"
                  variant="primary"
                  disabled={savingPwd || !currentPwd || !newPwd || !confirmPwd}
                  loading={savingPwd}
                >
                  Update Password
                </Button>
              </div>
            </form>
          </div>
        </Card>

        {/* CAREGIVER LINKING SHORTCUT */}
        <Card>
          <div className="profile-card-header">
            <div className="profile-card-title-group">
              <div className="profile-card-icon" style={{ background: "var(--teal-50)", color: "var(--primary)" }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                  <circle cx="8.5" cy="7" r="4" />
                  <line x1="20" y1="8" x2="20" y2="14" />
                  <line x1="23" y1="11" x2="17" y2="11" />
                </svg>
              </div>
              <div>
                <h3 className="profile-card-title">Caregiver & Family Linkage</h3>
                <p className="profile-card-desc">Grant trusted family members real-time access to your adherence logs</p>
              </div>
            </div>
          </div>

          <div className="profile-card-body">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "16px" }}>
              <p style={{ margin: 0, fontSize: "13px", color: "var(--text-secondary)", flex: 1, minWidth: "220px", lineHeight: "1.5" }}>
                Connect a caregiver email to receive automatic safety emails when doses are missed or medication stocks fall below safety limits.
              </p>
              <Button
                variant="outline"
                onClick={() => navigate("/caregiver/link")}
                icon={
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                    <polyline points="15 3 21 3 21 9" />
                    <line x1="10" y1="14" x2="21" y2="3" />
                  </svg>
                }
              >
                Manage Caregivers
              </Button>
            </div>
          </div>
        </Card>

        {/* DANGER ZONE CARD */}
        <Card className="danger-zone-card">
          <div className="profile-card-header danger-zone-header">
            <div className="profile-card-title-group">
              <div className="profile-card-icon danger-zone-icon">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
                  <line x1="12" y1="9" x2="12" y2="13"/>
                  <line x1="12" y1="17" x2="12.01" y2="17"/>
                </svg>
              </div>
              <div>
                <h3 className="profile-card-title" style={{ color: "var(--danger)" }}>Danger Zone</h3>
                <p className="profile-card-desc">Permanent deletion of account credentials and prescription logs</p>
              </div>
            </div>
          </div>

          <div className="profile-card-body">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "16px" }}>
              <p style={{ margin: 0, fontSize: "13px", color: "var(--text-muted)", flex: 1, minWidth: "240px", lineHeight: "1.5" }}>
                Once your account is deleted, all medication schedules, intake history logs, adherence statistics, and caregiver linkages will be permanently erased.
              </p>
              <Button
                variant="danger"
                onClick={() => setShowDeleteModal(true)}
              >
                Delete Account
              </Button>
            </div>
          </div>
        </Card>

      </div>

      {/* LOGOUT CONFIRMATION MODAL */}
      {showLogoutConfirm && (
        <div className="profile-modal-backdrop" onClick={() => setShowLogoutConfirm(false)}>
          <div className="profile-modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="profile-modal-icon" style={{ background: "var(--primary-light)", color: "var(--primary)" }}>
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                <polyline points="16 17 21 12 16 7" />
                <line x1="21" y1="12" x2="9" y2="12" />
              </svg>
            </div>
            <h3 className="profile-modal-title">Sign Out of MedRemind?</h3>
            <p className="profile-modal-text">
              You will be signed out on this device. Offline notifications will pause until you log in again.
            </p>
            <div className="profile-modal-actions">
              <Button variant="secondary" onClick={() => setShowLogoutConfirm(false)} style={{ flex: 1 }}>
                Cancel
              </Button>
              <Button variant="danger" onClick={handleLogoutConfirm} style={{ flex: 1 }}>
                Sign Out
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* DELETE ACCOUNT CONFIRMATION MODAL */}
      {showDeleteModal && (
        <div className="profile-modal-backdrop" onClick={() => setShowDeleteModal(false)}>
          <div className="profile-modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="profile-modal-icon" style={{ background: "var(--danger-light)", color: "var(--danger)" }}>
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10"/>
                <line x1="15" y1="9" x2="9" y2="15"/>
                <line x1="9" y1="9" x2="15" y2="15"/>
              </svg>
            </div>
            <h3 className="profile-modal-title" style={{ color: "var(--danger)" }}>Permanently Delete Account?</h3>
            <p className="profile-modal-text">
              This action cannot be undone. Enter your account password to confirm permanent deletion.
            </p>
            <form onSubmit={handleDeleteAccount} style={{ display: "flex", flexDirection: "column", gap: "16px", textAlign: "left" }}>
              <Input
                label="Account Password"
                type="password"
                value={deletePwd}
                onChange={(e) => setDeletePwd(e.target.value)}
                placeholder="Enter password to confirm"
                required
              />
              <div className="profile-modal-actions">
                <Button 
                  type="button" 
                  variant="secondary" 
                  onClick={() => { setShowDeleteModal(false); setDeletePwd(""); }} 
                  style={{ flex: 1 }}
                >
                  Cancel
                </Button>
                <Button 
                  type="submit" 
                  variant="danger" 
                  disabled={deletingAccount || !deletePwd} 
                  loading={deletingAccount}
                  style={{ flex: 1 }}
                >
                  Confirm Delete
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </AppShell>
  );
}

export default Profile;

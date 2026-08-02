import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import Navbar from "../components/Navbar";
import Sidebar from "../components/Sidebar";
import Footer from "../components/Footer";
import API from "../services/api";

function CaregiverDashboard() {
  const navigate = useNavigate();
  const [patients, setPatients] = useState([]);
  const [selectedPatientId, setSelectedPatientId] = useState(null);
  const [patientData, setPatientData] = useState(null);
  const [loadingPatients, setLoadingPatients] = useState(true);
  const [loadingDashboard, setLoadingDashboard] = useState(false);
  const [error, setError] = useState(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  useEffect(() => {
    if (!localStorage.getItem("token")) {
      navigate("/");
      return;
    }
    fetchPatients();
  }, [navigate]);

  const fetchPatients = async () => {
    setLoadingPatients(true);
    setError(null);
    try {
      const res = await API.get("/caregiver/my-patients");
      setPatients(res.data);
      if (res.data.length > 0) {
        // Automatically select the first patient
        setSelectedPatientId(res.data[0].patientId?._id);
      }
    } catch (err) {
      console.error("Error loading patients:", err);
      setError(err.response?.data?.message || "Failed to load patients list.");
    } finally {
      setLoadingPatients(false);
    }
  };

  useEffect(() => {
    if (selectedPatientId) {
      fetchPatientDashboard(selectedPatientId);
    } else {
      setPatientData(null);
    }
  }, [selectedPatientId]);

  const fetchPatientDashboard = async (patientId) => {
    setLoadingDashboard(true);
    setError(null);
    try {
      const res = await API.get(`/caregiver/patient/${patientId}/dashboard`);
      setPatientData(res.data);
    } catch (err) {
      console.error("Error fetching patient dashboard:", err);
      setError(err.response?.data?.message || "Failed to load patient monitoring details.");
    } finally {
      setLoadingDashboard(false);
    }
  };

  const formatTo12Hour = (timeStr) => {
    if (!timeStr) return "";
    const [hourStr, minStr] = timeStr.split(":");
    const hour = parseInt(hourStr, 10);
    if (isNaN(hour)) return timeStr;
    const ampm = hour >= 12 ? "PM" : "AM";
    const formattedHour = hour % 12 === 0 ? 12 : hour % 12;
    return `${String(formattedHour).padStart(2, "0")}:${minStr} ${ampm}`;
  };

  const formatDateTime = (dateStr) => {
    if (!dateStr) return "N/A";
    const d = new Date(dateStr);
    return d.toLocaleString("en-US", {
      timeZone: "Asia/Kolkata",
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
      hour12: true
    });
  };

  const getEmailFromToken = () => {
    const token = localStorage.getItem("token");
    if (!token) return "your email";
    try {
      const payload = JSON.parse(atob(token.split(".")[1]));
      return payload.email || "your email";
    } catch (e) {
      return "your email";
    }
  };

  return (
    <div className="dashboard-container">
      {/* Sidebar navigation */}
      <Sidebar isOpen={isSidebarOpen} onClose={() => setIsSidebarOpen(false)} />

      {/* Main Layout Area */}
      <div className="main-layout-content">
        <Navbar onToggleSidebar={() => setIsSidebarOpen(true)} />

        <header className="page-header">
          <button className="back-btn" onClick={() => navigate("/dashboard")}>←</button>
          <h2 className="page-title">Caregiver Dashboard</h2>
        </header>

        <main className="dashboard" style={{ maxWidth: "1200px" }}>
          {error && (
            <div style={{ 
              background: "var(--danger-light)", 
              color: "var(--danger)", 
              padding: "14px 18px", 
              borderRadius: "var(--radius-sm)", 
              marginBottom: "20px", 
              fontSize: "14px", 
              fontWeight: "600",
              border: "1px solid rgba(244, 63, 94, 0.15)"
            }}>
              {error}
            </div>
          )}

          {loadingPatients ? (
            <div style={{ textAlign: "center", padding: "40px" }}>
              <p style={{ color: "var(--text-light)", fontWeight: "600" }}>Loading patient connection indexes...</p>
            </div>
          ) : patients.length === 0 ? (
            <div className="form-card" style={{ textAlign: "center", padding: "48px 24px" }}>
              <div style={{ fontSize: "32px", color: "var(--primary)", border: "2px dashed var(--primary)", width: "60px", height: "60px", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px auto", fontWeight: "800" }}>Rx</div>
              <h3 style={{ fontSize: "20px", fontWeight: "800", color: "var(--text-main)", marginBottom: "8px" }}>
                No Linked Patient Accounts
              </h3>
              <p style={{ color: "var(--text-muted)", fontSize: "14px", maxWidth: "480px", margin: "0 auto 24px", lineHeight: "1.6" }}>
                Ask your patient to link your caregiver account email (<strong>{getEmailFromToken()}</strong>) in their Family Caregiver Connection settings.
              </p>
              <button className="btn-secondary" onClick={() => navigate("/dashboard")} style={{ maxWidth: "200px", margin: "0 auto" }}>
                Back to Dashboard
              </button>
            </div>
          ) : (
            <div className="caregiver-grid">
              
              {/* Sidebar: Patients list */}
              <div className="patients-sidebar">
                <h3 style={{ fontSize: "12px", fontWeight: "800", color: "var(--text-light)", textTransform: "uppercase", letterSpacing: "1px", marginBottom: "8px" }}>
                  Monitored Patients ({patients.length})
                </h3>
                <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                  {patients.map((p) => {
                    const isSelected = selectedPatientId === p.patientId?._id;
                    return (
                      <div 
                        key={p._id}
                        onClick={() => setSelectedPatientId(p.patientId?._id)}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: "12px",
                          padding: "16px",
                          background: isSelected ? "var(--primary-light)" : "white",
                          border: "1.5px solid",
                          borderColor: isSelected ? "var(--primary)" : "var(--border-light)",
                          borderRadius: "var(--radius-md)",
                          cursor: "pointer",
                          transition: "var(--transition-smooth)",
                          boxShadow: isSelected ? "var(--shadow-md)" : "var(--shadow-sm)"
                        }}
                      >
                        <div style={{ fontSize: "13px", fontWeight: "800", color: "var(--primary)", width: "38px", height: "38px", background: "var(--primary-light)", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "var(--shadow-sm)", flexShrink: 0 }}>
                          {p.patientId?.name ? p.patientId.name.split(" ").filter(Boolean).map(w => w[0]).join("").toUpperCase().slice(0, 2) : "U"}
                        </div>
                        <div style={{ overflow: "hidden" }}>
                          <div style={{ fontWeight: "800", fontSize: "14px", color: isSelected ? "var(--primary)" : "var(--text-main)", textOverflow: "ellipsis", overflow: "hidden", whiteSpace: "nowrap" }}>
                            {p.patientId?.name}
                          </div>
                          <div style={{ fontSize: "12px", color: "var(--text-light)", fontWeight: "600" }}>
                            {p.relationshipLabel}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Main Content Area */}
              <div>
                {loadingDashboard ? (
                  <div style={{ textAlign: "center", padding: "100px 0", background: "white", borderRadius: "var(--radius-lg)", border: "1px solid var(--border-light)" }}>
                    <p style={{ color: "var(--text-light)", fontWeight: "600" }}>Loading patient health metrics...</p>
                  </div>
                ) : patientData ? (
                  <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
                    
                    {/* Patient Info Banner */}
                    <div className="schedule-card" style={{ 
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      flexWrap: "wrap",
                      gap: "16px",
                      padding: "24px 30px"
                    }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "20px" }}>
                        <div style={{ fontSize: "20px", fontWeight: "800", color: "var(--primary)", width: "64px", height: "64px", background: "var(--primary-light)", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "var(--shadow-sm)", flexShrink: 0 }}>
                          {patientData.patient?.name ? patientData.patient.name.split(" ").filter(Boolean).map(w => w[0]).join("").toUpperCase().slice(0, 2) : "U"}
                        </div>
                        <div>
                          <h2 style={{ fontSize: "20px", fontWeight: "800", color: "var(--text-main)", display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
                            {patientData.patient?.name}
                            <span style={{ fontSize: "11px", background: "var(--success-light)", color: "var(--success)", padding: "4px 12px", borderRadius: "20px", fontWeight: "800", textTransform: "uppercase", letterSpacing: "0.5px" }}>
                              {patientData.patient?.relationshipLabel}
                            </span>
                          </h2>
                          <div style={{ fontSize: "13px", color: "var(--text-light)", fontWeight: "500", marginTop: "2px" }}>
                            {patientData.patient?.email}
                          </div>
                        </div>
                      </div>
                      
                      <div>
                        <div style={{ fontSize: "11px", fontWeight: "800", color: "var(--text-light)", textTransform: "uppercase", letterSpacing: "0.5px", textAlign: "right" }}>
                          Last Active Check
                        </div>
                        <div style={{ fontSize: "14px", fontWeight: "700", color: "var(--primary)", marginTop: "4px" }}>
                          {patientData.lastActiveTime ? formatDateTime(patientData.lastActiveTime) : "No recent activity recorded"}
                        </div>
                      </div>
                    </div>

                    <div className="stats-grid-2col">
                      
                      {/* Compliance Card */}
                      <div className="schedule-card" style={{ 
                        display: "flex",
                        flexDirection: "column",
                        justifyContent: "space-between",
                        gap: "16px",
                        padding: "24px"
                      }}>
                        <div>
                          <h4 style={{ fontSize: "12px", fontWeight: "800", color: "var(--text-light)", textTransform: "uppercase", letterSpacing: "0.8px", marginBottom: "6px" }}>
                            Lifetime Adherence
                          </h4>
                          <div style={{ display: "flex", alignItems: "baseline", gap: "8px" }}>
                            <span style={{ fontSize: "32px", fontWeight: "800", color: "var(--text-main)" }}>
                              {patientData.overallAdherence}%
                            </span>
                            <span style={{ fontSize: "13px", color: "var(--text-light)", fontWeight: "600" }}>
                              clinical target
                            </span>
                          </div>
                        </div>
                        
                        {/* Bar indicator */}
                        <div style={{ background: "#cbd5e1", borderRadius: "10px", height: "8px", overflow: "hidden" }}>
                          <div style={{ 
                            height: "100%", 
                            borderRadius: "10px",
                            width: `${patientData.overallAdherence}%`, 
                            background: patientData.overallAdherence >= 80 ? "var(--success)" : patientData.overallAdherence >= 50 ? "var(--warning)" : "var(--danger)",
                            transition: "width 0.5s ease"
                          }} />
                        </div>
                      </div>

                      {/* Streak Card */}
                      <div className="schedule-card" style={{ 
                        display: "flex",
                        flexDirection: "column",
                        justifyContent: "space-between",
                        padding: "24px"
                      }}>
                        <h4 style={{ fontSize: "12px", fontWeight: "800", color: "var(--text-light)", textTransform: "uppercase", letterSpacing: "0.8px", marginBottom: "12px" }}>
                          Current Streak
                        </h4>
                        <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
                          <div style={{ width: "48px", height: "48px", borderRadius: "50%", background: "var(--warning-light)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "20px", color: "var(--warning)" }}>🔥</div>
                          <div>
                            <div style={{ fontSize: "24px", fontWeight: "800", color: "var(--text-main)" }}>
                              {patientData.streak} Day{patientData.streak !== 1 ? "s" : ""}
                            </div>
                            <div style={{ fontSize: "12px", color: "var(--text-light)", fontWeight: "600", marginTop: "2px" }}>
                              Consistent compliant days
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Patient's Medicine List */}
                    <div className="schedule-section">
                      <div className="schedule-header">
                        <h3>Patient Medication Schedule</h3>
                        <button className="refresh-btn" onClick={() => fetchPatientDashboard(selectedPatientId)}>↻</button>
                      </div>

                      {patientData.medicines.length === 0 ? (
                        <div className="empty-state">
                          <p>No active medication schedules logged for this patient.</p>
                        </div>
                      ) : (
                        <div className="medicine-list">
                          {patientData.medicines.map((med) => {
                            const totalScheduled = med.times?.length || 1;
                            const takenCount = med.takenTodayCount || 0;
                            const isFullyTaken = med.taken;
                            const isSnoozed = med.snoozedUntil && new Date(med.snoozedUntil) > new Date();
                            const isMissedLocked = !med.taken && med.missedCount >= (med.maxMissedThreshold || 3);
                            const statusClass = isFullyTaken ? "taken" : isMissedLocked ? "missed" : "pending";
                            return (
                              <div key={med._id} className={`medicine-card status-${statusClass}`} style={{ alignItems: "center", padding: "16px 20px" }}>
                                <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
                                  <div className="medicine-icon">
                                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                      <rect x="2" y="7" width="20" height="14" rx="2" ry="2" />
                                      <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" />
                                    </svg>
                                  </div>
                                  <div className="medicine-info">
                                    <div className="medicine-name" style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "15px" }}>
                                      {med.name}
                                      {isSnoozed && (
                                        <span style={{ 
                                          fontSize: "10px", 
                                          background: "var(--warning-light)", 
                                          color: "var(--warning-hover)", 
                                          padding: "2px 8px", 
                                          borderRadius: "10px", 
                                          fontWeight: "800",
                                          textTransform: "uppercase"
                                        }}>
                                          Snoozed
                                        </span>
                                      )}
                                    </div>
                                    <div className="medicine-details">
                                      <span>Dosage: {med.dosage}</span>
                                      <span>Scheduled: {med.times && med.times.length > 0 ? med.times.map(t => formatTo12Hour(t)).join(", ") : formatTo12Hour(med.time)}</span>
                                      {med.snoozeCount > 0 && (
                                        <span style={{ color: med.snoozeCount >= 3 ? "var(--danger)" : "var(--warning-hover)", fontWeight: "700" }}>
                                          Snooze Count: {med.snoozeCount}
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                </div>

                                <div>
                                  <span className={`status-badge ${isFullyTaken ? "taken" : isMissedLocked ? "missed" : "pending"}`} style={isMissedLocked ? { background: "var(--danger-light)", color: "var(--danger)", border: "1px solid rgba(244, 63, 94, 0.15)", padding: "6px 12px", borderRadius: "8px", fontSize: "11px", fontWeight: "800" } : {}}>
                                    {isFullyTaken ? "Completed" : isMissedLocked ? "Missed & Locked" : `${takenCount} / ${totalScheduled} Taken`}
                                  </span>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>

                    {/* Patient's Dose Logs History */}
                    <div className="schedule-section">
                      <div className="schedule-header">
                        <h3>Dose Log History</h3>
                      </div>

                      {patientData.logs.length === 0 ? (
                        <div className="empty-state" style={{ padding: "24px" }}>
                          <p>No recent activity logs recorded for this patient.</p>
                        </div>
                      ) : (
                        <div style={{ display: "flex", flexDirection: "column", gap: "10px", maxHeight: "350px", overflowY: "auto", paddingRight: "4px" }}>
                          {patientData.logs.map((log) => {
                            const isTaken = log.status === "taken";
                            return (
                              <div 
                                key={log._id} 
                                style={{ 
                                  display: "flex", 
                                  justifyContent: "space-between", 
                                  alignItems: "center", 
                                  padding: "14px 18px", 
                                  background: "white",
                                  border: "1px solid", 
                                  borderColor: isTaken ? "rgba(16, 185, 129, 0.12)" : "rgba(244, 63, 94, 0.12)", 
                                  borderRadius: "12px",
                                  boxShadow: "var(--shadow-sm)"
                                }}
                              >
                                <div>
                                  <div style={{ fontWeight: "800", fontSize: "14px", color: "var(--text-main)" }}>
                                    {log.medicineName} <span style={{ fontSize: "12px", color: "var(--text-light)", fontWeight: "500" }}>({log.dosage})</span>
                                  </div>
                                  <div style={{ fontSize: "12px", color: "var(--text-light)", marginTop: "4px", fontWeight: "600" }}>
                                    Scheduled: {formatTo12Hour(log.scheduledTime)} on {log.date}
                                  </div>
                                </div>
                                
                                <div style={{ textAlign: "right" }}>
                                  <span style={{ 
                                    fontSize: "11px", 
                                    fontWeight: "800", 
                                    color: isTaken ? "var(--success)" : "var(--danger)",
                                    background: isTaken ? "var(--success-light)" : "var(--danger-light)",
                                    padding: "4px 12px",
                                    borderRadius: "12px",
                                    textTransform: "uppercase",
                                    letterSpacing: "0.5px"
                                  }}>
                                    {isTaken ? "Taken ✓" : "Missed ✕"}
                                  </span>
                                  {isTaken && log.takenAt && (
                                    <div style={{ fontSize: "11px", color: "var(--text-light)", marginTop: "6px", fontWeight: "600" }}>
                                      {new Date(log.takenAt).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true })}
                                    </div>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>

                  </div>
                ) : (
                  <div className="form-card" style={{ textAlign: "center", padding: "60px 24px" }}>
                    <p style={{ color: "var(--text-light)", fontWeight: "600" }}>Select a patient from the sidebar list to view compliance metrics.</p>
                  </div>
                )}
              </div>

            </div>
          )}
        </main>
        <Footer />
      </div>
    </div>
  );
}

export default CaregiverDashboard;

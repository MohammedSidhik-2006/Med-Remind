import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import Navbar from "../components/Navbar";
import Sidebar from "../components/Sidebar";
import Footer from "../components/Footer";
import API from "../services/api";

function HistoryLog() {
  const navigate = useNavigate();
  const [logs,    setLogs]    = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter,  setFilter]  = useState("all"); // "all" | "taken" | "missed"
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  // Auth guard
  useEffect(() => {
    if (!localStorage.getItem("token")) navigate("/");
  }, [navigate]);

  const fetchLogs = useCallback(async () => {
    try {
      const res = await API.get("/medicine/logs?limit=300");
      setLogs(res.data);
    } catch (err) {
      console.error("Error fetching dose logs:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchLogs(); }, [fetchLogs]);

  const filtered = filter === "all" ? logs : logs.filter(l => l.status === filter);

  // Group entries by date (already sorted newest-first from backend)
  const grouped = filtered.reduce((acc, log) => {
    if (!acc[log.date]) acc[log.date] = [];
    acc[log.date].push(log);
    return acc;
  }, {});
  const dates = Object.keys(grouped).sort((a, b) => b.localeCompare(a));

  const countTaken  = logs.filter(l => l.status === "taken").length;
  const countMissed = logs.filter(l => l.status === "missed").length;
  const adherence   = logs.length > 0
    ? Math.round((countTaken / logs.length) * 100) : 0;

  return (
    <div className="dashboard-container">
      {/* Sidebar navigation */}
      <Sidebar isOpen={isSidebarOpen} onClose={() => setIsSidebarOpen(false)} />

      {/* Main Layout Area */}
      <div className="main-layout-content">
        <Navbar onToggleSidebar={() => setIsSidebarOpen(true)} />

        <header className="page-header">
          <button className="back-btn" onClick={() => navigate("/dashboard")}>←</button>
          <h2 className="page-title">Adherence Logs</h2>
        </header>

        <main className="dashboard" style={{ maxWidth: "700px" }}>
          
          {/* Statistics summary row */}
          <div style={{
            display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: "12px", marginBottom: "24px"
          }}>
            {[
              { label: "Total Logs",  value: logs.length,  color: "var(--text-main)", icon: "📋" },
              { label: "Taken Doses",       value: countTaken,   color: "var(--success)", icon: "✓" },
              { label: "Missed Doses",      value: countMissed,  color: "var(--danger)", icon: "✕" },
            ].map(({ label, value, color, icon }) => (
              <div key={label} style={{
                background: "white", borderRadius: "14px", padding: "16px",
                textAlign: "center", boxShadow: "var(--shadow-sm)", border: "1px solid var(--border-light)"
              }}>
                <div style={{ fontSize: "14px", color: "var(--text-light)" }}>{icon}</div>
                <div style={{ fontSize: "24px", fontWeight: "800", color, marginTop: "4px" }}>{value}</div>
                <div style={{ fontSize: "11px", color: "var(--text-light)", marginTop: "6px", fontWeight: "750", textTransform: "uppercase", letterSpacing: "0.5px" }}>{label}</div>
              </div>
            ))}
          </div>

          {/* Overall compliance tracker bar */}
          {logs.length > 0 && (
            <div className="schedule-card" style={{ padding: "20px 24px", marginBottom: "24px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "8px", alignItems: "center" }}>
                <span style={{ fontSize: "14px", fontWeight: "800", color: "var(--text-main)" }}>Overall Compliance Ratio</span>
                <span style={{ fontSize: "14px", fontWeight: "800",
                  color: adherence >= 80 ? "var(--success)" : adherence >= 50 ? "var(--warning-hover)" : "var(--danger)"
                }}>{adherence}%</span>
              </div>
              <div style={{ background: "#cbd5e1", borderRadius: "10px", height: "8px", overflow: "hidden" }}>
                <div style={{
                  height: "100%", borderRadius: "10px", transition: "width 0.5s ease",
                  width: `${adherence}%`,
                  background: adherence >= 80 ? "var(--success)" : adherence >= 50 ? "var(--warning)" : "var(--danger)"
                }} />
              </div>
            </div>
          )}

          {/* Filter tabs */}
          <div style={{ display: "flex", gap: "10px", marginBottom: "20px", flexWrap: "wrap" }}>
            {[
              { key: "all",    label: `All Logs (${logs.length})`,         color: "var(--text-muted)", activeBg: "var(--text-muted)", text: "white" },
              { key: "taken",  label: `Taken Doses (${countTaken})`,      color: "var(--success)", activeBg: "var(--success)", text: "white" },
              { key: "missed", label: `Missed Doses (${countMissed})`,    color: "var(--danger)", activeBg: "var(--danger)", text: "white" },
            ].map(({ key, label, color, activeBg, text }) => (
              <button key={key} onClick={() => setFilter(key)} style={{
                padding: "8px 18px", borderRadius: "20px",
                cursor: "pointer", fontWeight: "700", fontSize: "12px",
                background: filter === key ? activeBg : "white",
                color: filter === key ? text : "var(--text-light)",
                border: filter === key ? "none" : "1px solid var(--border-light)",
                boxShadow: filter === key ? "var(--shadow-sm)" : "none",
                transition: "var(--transition-smooth)"
              }}>{label}</button>
            ))}
          </div>

          {/* History log main card */}
          <div className="form-card" style={{ padding: "30px 24px" }}>
            {loading ? (
              <div style={{ textAlign: "center", padding: "40px", color: "var(--text-light)", fontWeight: "600" }}>
                Fetching compliance history...
              </div>
            ) : dates.length === 0 ? (
              <div className="empty-state">
                <div className="empty-state-icon" style={{ fontSize: "32px", color: "var(--primary)", border: "2px dashed var(--primary)", width: "60px", height: "60px", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 15px auto", fontWeight: "800" }}>Rx</div>
                <p style={{ fontWeight: "600", color: "var(--text-light)" }}>
                  {filter === "all" ? "No dose logs found. Start completing schedules to build log history." : `No ${filter} doses recorded.`}
                </p>
              </div>
            ) : (
              dates.map(date => (
                <div key={date} style={{ marginBottom: "24px" }}>
                  {/* Date header */}
                  <div style={{
                    display: "flex", alignItems: "center", gap: "12px",
                    marginBottom: "12px", padding: "0 2px"
                  }}>
                    <div style={{
                      fontSize: "12px", fontWeight: "800", color: "var(--text-light)",
                      textTransform: "uppercase", letterSpacing: "0.8px", whiteSpace: "nowrap"
                    }}>
                      {new Date(date + "T00:00:00").toLocaleDateString("en-US", {
                        weekday: "short", day: "numeric", month: "short", year: "numeric"
                      })}
                    </div>
                    <div style={{ flex: 1, height: "1px", background: "var(--border-light)" }} />
                    <span style={{
                      fontSize: "11px", fontWeight: "800", padding: "2px 10px", borderRadius: "20px",
                      background: grouped[date].every(l => l.status === "taken") ? "var(--success-light)"
                                : grouped[date].every(l => l.status === "missed") ? "var(--danger-light)" : "var(--warning-light)",
                      color:      grouped[date].every(l => l.status === "taken") ? "var(--success)"
                                : grouped[date].every(l => l.status === "missed") ? "var(--danger)" : "var(--warning-hover)",
                      textTransform: "uppercase", letterSpacing: "0.5px"
                    }}>
                      {grouped[date].filter(l => l.status === "taken").length}/{grouped[date].length} Taken
                    </span>
                  </div>

                  {/* Logs items */}
                  <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                    {grouped[date].map((log, i) => (
                      <div key={i} style={{
                        display: "flex", alignItems: "center", gap: "16px",
                        padding: "14px 18px",
                        background: "white", borderRadius: "12px",
                        boxShadow: "var(--shadow-sm)",
                        border: "1.5px solid var(--border-light)",
                        borderLeft: `5px solid ${log.status === "taken" ? "var(--success)" : "var(--danger)"}`
                      }}>
                        <div style={{
                          width: "32px", height: "32px", borderRadius: "50%", flexShrink: 0,
                          background: log.status === "taken" ? "var(--success-light)" : "var(--danger-light)",
                          display: "flex", alignItems: "center", justifyContent: "center", fontSize: "14px",
                          fontWeight: "800", color: log.status === "taken" ? "var(--success)" : "var(--danger)"
                        }}>
                          {log.status === "taken" ? "✓" : "✗"}
                        </div>

                        <div style={{ flex: 1, minWidth: 0, textAlign: "left" }}>
                          <div style={{ fontWeight: "800", color: "var(--text-main)", fontSize: "15px",
                            whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis"
                          }}>
                            {log.medicineName}
                          </div>
                          <div style={{ fontSize: "12px", color: "var(--text-light)", marginTop: "4px",
                            display: "flex", gap: "12px", flexWrap: "wrap", fontWeight: "600"
                          }}>
                            {log.dosage      && <span>Dosage: {log.dosage}</span>}
                            {log.scheduledTime && <span>Scheduled Time: {log.scheduledTime}</span>}
                            {log.takenAt && (
                              <span>Logged: {new Date(log.takenAt).toLocaleTimeString("en-US", {
                                hour: "2-digit", minute: "2-digit"
                              })}</span>
                            )}
                          </div>
                        </div>

                        <span style={{
                          flexShrink: 0, padding: "4px 12px", borderRadius: "12px",
                          fontSize: "11px", fontWeight: "800", textTransform: "uppercase", letterSpacing: "0.5px",
                          background: log.status === "taken" ? "var(--success-light)" : "var(--danger-light)",
                          color:      log.status === "taken" ? "var(--success)" : "var(--danger)"
                        }}>
                          {log.status === "taken" ? "Taken" : "Missed"}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              ))
            )}
          </div>
        </main>
        <Footer />
      </div>
    </div>
  );
}

export default HistoryLog;

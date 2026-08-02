import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import Navbar from "../components/Navbar";
import Sidebar from "../components/Sidebar";
import Footer from "../components/Footer";
import API from "../services/api";

const FREQ = { once: 1, twice: 2, thrice: 3, four: 4 };
const FREQ_LABELS = {
  once:   { label: "Once Daily",       icon: "1x" },
  twice:  { label: "Twice Daily",      icon: "2x" },
  thrice: { label: "Thrice Daily",     icon: "3x" },
  four:   { label: "Four Times Daily", icon: "4x" }
};

const TIME_PERIODS = [
  { key: "morning",   label: "Morning",   icon: "🌅", hint: "05:00–11:59" },
  { key: "afternoon", label: "Afternoon", icon: "☀️", hint: "12:00–16:59" },
  { key: "evening",   label: "Evening",   icon: "🌇", hint: "17:00–20:59" },
  { key: "night",     label: "Night",     icon: "🌙", hint: "21:00–04:59" }
];

// compute today's date in local time (not UTC)
function getLocalToday() {
  const now = new Date();
  const pad = n => String(n).padStart(2, "0");
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

function AddMedicinePage() {
  const navigate = useNavigate();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  // Auth guard
  useEffect(() => {
    if (!localStorage.getItem("token")) navigate("/");
  }, [navigate]);

  const todayStr = getLocalToday();

  const [name,        setName]        = useState("");
  const [dosage,      setDosage]      = useState("");
  const [frequency,   setFrequency]   = useState("once");
  const [times,       setTimes]       = useState([""]);
  const [timePeriods, setTimePeriods] = useState([]);
  const [startDate,   setStartDate]   = useState(todayStr);
  const [endDate,     setEndDate]     = useState("");
  const [stock,       setStock]       = useState(30);
  const [refillAt,    setRefillAt]    = useState(7);
  const [notes,       setNotes]       = useState("");
  const [loading,     setLoading]     = useState(false);
  const [error,       setError]       = useState("");

  const handleFrequencyChange = (freq) => {
    setFrequency(freq);
    setTimes(Array(FREQ[freq]).fill(""));
  };

  const handleTimeChange = (index, value) => {
    const updated = [...times];
    updated[index] = value;
    setTimes(updated);
  };

  const togglePeriod = (key) => {
    setTimePeriods(prev =>
      prev.includes(key) ? prev.filter(p => p !== key) : [...prev, key]
    );
  };

  const addMedicine = async () => {
    setError("");

    if (!name.trim()) { setError("Medicine name is required."); return; }
    if (!dosage.trim()) { setError("Dosage is required."); return; }
    if (times.some(t => !t)) { setError("Please set all medication times."); return; }
    if (endDate && endDate < startDate) { setError("End date cannot be before start date."); return; }

    setLoading(true);
    try {
      await API.post("/medicine/add", {
        name:        name.trim(),
        dosage:      dosage.trim(),
        times,
        timePeriods,
        frequency,
        time:        times[0],
        startDate,
        endDate,
        stock:       Number(stock),
        refillAt:    Number(refillAt),
        notes:       notes.trim()
      });
      navigate("/dashboard");
    } catch (err) {
      const msg = err.response?.data?.message
        || (err.message === "Network Error" ? "Cannot connect to server. Is the backend running?" : null)
        || "Failed to add medicine. Please try again.";
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="dashboard-container">
      {/* Sidebar navigation */}
      <Sidebar isOpen={isSidebarOpen} onClose={() => setIsSidebarOpen(false)} />

      {/* Main Layout content */}
      <div className="main-layout-content">
        <Navbar onToggleSidebar={() => setIsSidebarOpen(true)} />

        <header className="page-header">
          <button className="back-btn" onClick={() => navigate("/dashboard")}>←</button>
          <h2 className="page-title">New Medication</h2>
        </header>

        <main className="form-container">
          <div className="form-card">
            {/* Error Banner */}
            {error && (
              <div style={{
                background: "var(--danger-light)", color: "var(--danger)", padding: "14px 18px",
                borderRadius: "var(--radius-sm)", marginBottom: "20px", fontSize: "14px",
                border: "1px solid rgba(244, 63, 94, 0.15)", display: "flex", alignItems: "center", gap: "8px"
              }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ flexShrink: 0 }}>
                  <circle cx="12" cy="12" r="10"/>
                  <line x1="12" y1="8" x2="12" y2="12"/>
                  <line x1="12" y1="16" x2="12.01" y2="16"/>
                </svg>
                <span style={{ flex: 1, fontWeight: "600" }}>{error}</span>
                <button onClick={() => setError("")} style={{
                  background: "none", border: "none",
                  color: "var(--danger)", cursor: "pointer", fontSize: "20px", lineHeight: 1
                }}>×</button>
              </div>
            )}

            <div className="form-group">
              <label>Medicine Name *</label>
              <input
                placeholder="e.g., Glucotab"
                value={name}
                onChange={e => setName(e.target.value)}
              />
            </div>

            <div className="form-group">
              <label>Dosage *</label>
              <input
                placeholder="e.g., 500 mg / 1 pill"
                value={dosage}
                onChange={e => setDosage(e.target.value)}
              />
            </div>

            {/* Date Range */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "20px" }}>
              <div className="form-group">
                <label>Start Date *</label>
                <input type="date" value={startDate} min={todayStr}
                  onChange={e => setStartDate(e.target.value)} />
              </div>
              <div className="form-group">
                <label>End Date (optional)</label>
                <input type="date" value={endDate} min={startDate}
                  onChange={e => setEndDate(e.target.value)} />
              </div>
            </div>

            {/* Time Periods */}
            <div className="form-group">
              <label>When to Take (select all that apply)</label>
              <div className="period-grid">
                {TIME_PERIODS.map(({ key, label, icon, hint }) => (
                  <button key={key} onClick={() => togglePeriod(key)} style={{
                    padding: "14px 8px", border: "2px solid",
                    borderColor: timePeriods.includes(key) ? "var(--primary)" : "#e2e8f0",
                    borderRadius: "12px", cursor: "pointer", fontWeight: "700",
                    display: "flex", flexDirection: "column", alignItems: "center", gap: "4px",
                    background: timePeriods.includes(key) ? "var(--primary-light)" : "white",
                    color: timePeriods.includes(key) ? "var(--primary)" : "var(--text-light)",
                    transition: "var(--transition-smooth)", fontSize: "12px"
                  }}>
                    <span style={{ fontSize: "22px" }}>{icon}</span>
                    <span style={{ color: "var(--text-main)", fontWeight: "800" }}>{label}</span>
                    <span style={{ fontSize: "10px", opacity: 0.8 }}>{hint}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Frequency */}
            <div className="form-group">
              <label>Medication Frequency</label>
              <div
                style={{
                  marginTop: "10px",
                  display: "grid",
                  gridTemplateColumns: "repeat(2, 1fr)",
                  gap: "16px",
                }}
              >
                {Object.entries(FREQ_LABELS).map(([key, { label, icon }]) => (
                  <button
                    key={key}
                    onClick={() => handleFrequencyChange(key)}
                    style={{
                      padding: "20px 16px",
                      fontSize: "14px",
                      border: "none",
                      borderRadius: "12px",
                      cursor: "pointer",
                      fontWeight: "800",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: "8px",
                      transition: "var(--transition-smooth)",
                      background:
                        frequency === key
                          ? "linear-gradient(135deg,var(--primary),var(--primary-hover))"
                          : "#f1f5f9",
                      color: frequency === key ? "white" : "var(--text-muted)",
                      boxShadow: frequency === key ? "var(--shadow-sm)" : "none",
                    }}
                  >
                    <span style={{ fontSize: "16px" }}>{icon}</span>
                    <span>{label}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Specific Times */}
            <div className="form-group">
              <label>Exact Alarm Times *</label>
              {times.map((t, i) => (
                <div key={i} style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "12px" }}>
                  <span style={{
                    background: "var(--primary-light)", color: "var(--primary)", fontWeight: "850",
                    width: "32px", height: "32px", borderRadius: "50%",
                    display: "flex", alignItems: "center", justifyItems: "center", justifyContent: "center", fontSize: "13px",
                    border: "1px solid rgba(13, 148, 136, 0.15)"
                  }}>{i + 1}</span>
                  <input
                    type="time"
                    value={t}
                    onChange={e => handleTimeChange(i, e.target.value)}
                    style={{ flex: 1, marginBottom: 0 }}
                  />
                </div>
              ))}
            </div>

            {/* Stock */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "20px" }}>
              <div className="form-group">
                <label>Initial Stock (doses)</label>
                <input type="number" min="0" value={stock}
                  onChange={e => setStock(e.target.value)} placeholder="e.g., 30" />
              </div>
              <div className="form-group">
                <label>Low Stock Warning Threshold</label>
                <input type="number" min="0" value={refillAt}
                  onChange={e => setRefillAt(e.target.value)} placeholder="e.g., 7" />
              </div>
            </div>

            <div style={{
              background: "var(--primary-light)", borderRadius: "12px", padding: "14px 18px",
              marginBottom: "24px", fontSize: "13px", color: "var(--primary)", fontWeight: "700",
              border: "1px solid rgba(13, 148, 136, 0.15)"
            }}>
              💡 Dynamic push alarms will fire at each specified exact alarm slot. Low stock alerts trigger once inventory dips below {refillAt} doses.
            </div>

            <div className="form-group">
              <label>Notes (optional)</label>
              <input
                placeholder="e.g., Take after food, avoid dairy"
                value={notes}
                onChange={e => setNotes(e.target.value)}
              />
            </div>

            <div className="form-actions">
              <button className="btn-secondary" onClick={() => navigate("/dashboard")}>Cancel</button>
              <button className="btn-primary" onClick={addMedicine} disabled={loading} style={{ margin: 0 }}>
                {loading ? "Adding..." : "Add Medication Schedule"}
              </button>
            </div>

          </div>
        </main>
        <Footer />
      </div>
    </div>
  );
}

export default AddMedicinePage;

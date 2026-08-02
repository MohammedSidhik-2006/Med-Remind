import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import Navbar from "../components/Navbar";
import Sidebar from "../components/Sidebar";
import Footer from "../components/Footer";
import API from "../services/api";

// Local date string YYYY-MM-DD
function localDateStr(d = new Date()) {
  const pad = n => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

const formatTo12Hour = (timeStr) => {
  if (!timeStr) return "";
  const [hourStr, minStr] = timeStr.split(":");
  const hour = parseInt(hourStr, 10);
  if (isNaN(hour)) return timeStr;
  const min = minStr;
  const ampm = hour >= 12 ? "PM" : "AM";
  const formattedHour = hour % 12 === 0 ? 12 : hour % 12;
  return `${String(formattedHour).padStart(2, "0")}:${min} ${ampm}`;
};

function CalendarView() {
  const navigate = useNavigate();
  const [currentDate,   setCurrentDate]   = useState(new Date());
  const [selectedDate,  setSelectedDate]  = useState(new Date()); // default to today for better UX
  const [reportData,    setReportData]    = useState([]);
  const [loading,       setLoading]       = useState(true);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  // Auth guard
  useEffect(() => {
    if (!localStorage.getItem("token")) navigate("/");
  }, [navigate]);

  const [allMedicines, setAllMedicines] = useState([]);

  const fetchReports = useCallback(async () => {
    try {
      const [resReports, resMeds] = await Promise.all([
        API.get("/medicine/reports?period=month"),
        API.get("/medicine")
      ]);
      setReportData(resReports.data.dailyData || []);
      setAllMedicines(resMeds.data || []); // resMeds.data is the array directly from controller
    } catch (err) {
      console.error("Calendar reports error:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchReports(); }, [fetchReports]);

  // Lookup by date string
  const dataByDate = reportData.reduce((acc, d) => { acc[d.date] = d; return acc; }, {});

  const todayStr = localDateStr();
  const year     = currentDate.getFullYear();
  const month    = currentDate.getMonth();
  const firstDay = new Date(year, month, 1).getDay();   // 0=Sun
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const MONTHS = ["January","February","March","April","May","June",
                  "July","August","September","October","November","December"];

  const getDayDot = (dayStr) => {
    const d = dataByDate[dayStr];
    if (!d || d.total === 0) return null;
    if (d.adherence === 100) return "var(--success)";
    if (d.adherence >= 50)  return "var(--warning)";
    return "var(--danger)";
  };

  const selectedStr  = selectedDate ? localDateStr(selectedDate) : null;
  const selectedData = selectedStr  ? dataByDate[selectedStr]    : null;

  // Filter scheduled medicines active on selectedDate
  const scheduledForSelected = selectedStr ? allMedicines.filter(m => {
    if (m.startDate && selectedStr < m.startDate) return false;
    if (m.endDate && selectedStr > m.endDate) return false;
    return true;
  }) : [];

  const prevMonth = () => setCurrentDate(new Date(year, month - 1, 1));
  const nextMonth = () => setCurrentDate(new Date(year, month + 1, 1));

  return (
    <div className="dashboard-container">
      {/* Sidebar navigation */}
      <Sidebar isOpen={isSidebarOpen} onClose={() => setIsSidebarOpen(false)} />

      <div className="main-layout-content">
        <Navbar onToggleSidebar={() => setIsSidebarOpen(true)} />

        {/* Header */}
        <header className="page-header">
          <button className="back-btn" onClick={() => navigate("/dashboard")}>←</button>
          <h2 className="page-title">Clinical Calendar</h2>
        </header>

        <main className="dashboard" style={{ maxWidth: "700px" }}>
          <div className="form-card">
            {/* Month navigation */}
            <div style={{
              display: "flex", alignItems: "center", justifyContent: "space-between",
              marginBottom: "24px"
            }}>
              <button onClick={prevMonth} style={{
                background: "var(--primary-light)", border: "none", borderRadius: "10px",
                padding: "8px 16px", cursor: "pointer", fontWeight: "800",
                color: "var(--primary)", fontSize: "16px", display: "flex", alignItems: "center",
                justifyContent: "center"
              }}>‹</button>
              <h3 style={{ color: "var(--text-main)", fontSize: "18px", fontWeight: "800" }}>
                {MONTHS[month]} {year}
              </h3>
              <button onClick={nextMonth} style={{
                background: "var(--primary-light)", border: "none", borderRadius: "10px",
                padding: "8px 16px", cursor: "pointer", fontWeight: "800",
                color: "var(--primary)", fontSize: "16px", display: "flex", alignItems: "center",
                justifyContent: "center"
              }}>›</button>
            </div>

            {/* Day names */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)", gap: "6px", marginBottom: "8px" }}>
              {["Sun","Mon","Tue","Wed","Thu","Fri","Sat"].map(d => (
                <div key={d} style={{
                  textAlign: "center", fontSize: "12px", fontWeight: "750",
                  color: "var(--text-light)", padding: "4px 0", textTransform: "uppercase",
                  letterSpacing: "0.5px"
                }}>{d}</div>
              ))}
            </div>

            {/* Calendar grid */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)", gap: "6px" }}>
              {/* Empty cells for offset */}
              {Array(firstDay).fill(null).map((_, i) => <div key={`e-${i}`} />)}

              {/* Day cells */}
              {Array(daysInMonth).fill(null).map((_, i) => {
                const day    = i + 1;
                const pad    = n => String(n).padStart(2, "0");
                const dayStr = `${year}-${pad(month + 1)}-${pad(day)}`;
                const isToday    = dayStr === todayStr;
                const isSelected = dayStr === selectedStr;
                const dot        = getDayDot(dayStr);
                const isFuture   = dayStr > todayStr;

                return (
                  <div
                    key={day}
                    onClick={() => setSelectedDate(new Date(year, month, day))}
                    style={{
                      textAlign: "center", padding: "14px 4px", borderRadius: "12px",
                      cursor: "pointer", position: "relative",
                      background: isSelected ? "var(--primary)" : isToday ? "var(--primary-light)" : "transparent",
                      color: isSelected ? "white" : isToday ? "var(--primary)" : isFuture ? "#cbd5e1" : "var(--text-main)",
                      fontWeight: isToday || isSelected ? "800" : "550",
                      border: isToday && !isSelected ? "2.5px solid var(--primary)" : "2.5px solid transparent",
                      transition: "var(--transition-smooth)",
                      fontSize: "14px"
                    }}
                  >
                    {day}
                    {dot && (
                      <div style={{
                        width: "6px", height: "6px", borderRadius: "50%",
                        background: isSelected ? "white" : dot,
                        margin: "4px auto 0"
                      }} />
                    )}
                  </div>
                );
              })}
            </div>

            {/* Legend */}
            <div style={{
              display: "flex", gap: "20px", justifyContent: "center",
              marginTop: "20px", paddingTop: "20px", borderTop: "1px solid var(--border-light)"
            }}>
              {[["var(--success)","Perfect Compliance"],["var(--warning)","Partial Doses"],["var(--danger)","Missed Slots"]].map(([color, label]) => (
                <div key={label} style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "11px", color: "var(--text-light)", fontWeight: "700" }}>
                  <div style={{ width: "8px", height: "8px", borderRadius: "50%", background: color }} />
                  {label}
                </div>
              ))}
            </div>
          </div>

          {/* Selected-date detail card */}
          {selectedDate && (
            <div className="form-card" style={{ marginTop: "20px" }}>
              <h4 style={{ fontWeight: "800", color: "var(--text-main)", marginBottom: "20px", fontSize: "16px", borderBottom: "1.5px solid var(--border-light)", paddingBottom: "10px" }}>
                Schedule details: {selectedDate.toLocaleDateString("en-US", {
                  weekday: "long", day: "numeric", month: "long", year: "numeric"
                })}
              </h4>

              {loading ? (
                <div style={{ color: "var(--text-light)", textAlign: "center", padding: "30px", fontWeight: "600" }}>
                  Fetching schedule details...
                </div>
              ) : (selectedData && selectedData.total > 0) || scheduledForSelected.length > 0 ? (
                <>
                  {selectedData && selectedData.total > 0 && (
                    <>
                      <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: "12px", marginBottom: "16px" }}>
                        {[
                          { label: "Doses Taken",     value: selectedData.taken,     bg: "var(--success-light)", color: "var(--success)" },
                          { label: "Doses Missed",    value: selectedData.missed,    bg: "var(--danger-light)", color: "var(--danger)" },
                          { label: "Daily Rate", value: `${selectedData.adherence ?? 0}%`, bg: "var(--primary-light)", color: "var(--primary)" },
                        ].map(({ label, value, bg, color }) => (
                          <div key={label} style={{ background: bg, borderRadius: "12px", padding: "14px 8px", textAlign: "center", border: "1px solid rgba(0,0,0,0.02)" }}>
                            <div style={{ fontSize: "20px", fontWeight: "800", color }}>{value}</div>
                            <div style={{ fontSize: "11px", color: "var(--text-light)", marginTop: "4px", fontWeight: "700" }}>{label}</div>
                          </div>
                        ))}
                      </div>

                      {/* Adherence progress bar */}
                      <div style={{ background: "#cbd5e1", borderRadius: "10px", height: "8px", overflow: "hidden", marginBottom: "24px" }}>
                        <div style={{
                          height: "100%", borderRadius: "10px", transition: "width 0.5s ease",
                          width: `${selectedData.adherence ?? 0}%`,
                          background: (selectedData.adherence ?? 0) >= 80 ? "var(--success)"
                                     : (selectedData.adherence ?? 0) >= 50 ? "var(--warning)" : "var(--danger)"
                        }} />
                      </div>
                    </>
                  )}

                  {/* Scheduled & recorded medicines list */}
                  <div style={{ marginTop: "16px", textAlign: "left" }}>
                    <h5 style={{ fontWeight: "800", color: "var(--text-muted)", fontSize: "12px", marginBottom: "14px", textTransform: "uppercase", letterSpacing: "0.8px" }}>
                      Allocated Medication Alarms ({scheduledForSelected.length})
                    </h5>
                    <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                      {scheduledForSelected.map((med) => {
                        const times = med.times?.length > 0 ? med.times : [med.time];
                        return times.map((t, idx) => {
                          const logged = selectedData?.doseLogs?.find(l => l.medicineName === med.name && l.scheduledTime === t);
                          const status = logged ? logged.status : (selectedStr > todayStr ? "scheduled" : "pending");

                          return (
                            <div key={`${med._id}-${t}-${idx}`} style={{
                              display: "flex", alignItems: "center", justifyContent: "space-between",
                              padding: "14px 18px", borderRadius: "14px", border: "1px solid var(--border-light)",
                              background: status === "taken" ? "var(--success-light)" : status === "missed" ? "var(--danger-light)" : "#f8fafc"
                            }}>
                              <div>
                                <div style={{ fontWeight: "800", color: "var(--text-main)", fontSize: "14px" }}>
                                  {med.name} <span style={{ fontSize: "12px", color: "var(--text-light)", fontWeight: "500" }}>({med.dosage})</span>
                                </div>
                                <div style={{ fontSize: "12px", color: "var(--text-light)", marginTop: "4px", fontWeight: "600" }}>
                                  Alarm: {formatTo12Hour(t)}
                                  {logged?.takenAt && (
                                    <span style={{ marginLeft: "8px", color: "var(--success)", fontWeight: "700" }}>
                                      • Logged at {new Date(logged.takenAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                    </span>
                                  )}
                                </div>
                              </div>
                              <span style={{
                                background: status === "taken" ? "#dcfce7" : status === "missed" ? "#fee2e2" : "#e0f2fe",
                                color: status === "taken" ? "#15803d" : status === "missed" ? "#b91c1c" : "#0369a1",
                                padding: "6px 12px", borderRadius: "12px", fontSize: "11px", fontWeight: "800",
                                textTransform: "uppercase", letterSpacing: "0.5px"
                              }}>
                                {status === "taken" ? "Taken ✓" : status === "missed" ? "Missed ✕" : "Pending"}
                              </span>
                            </div>
                          );
                        });
                      })}
                    </div>
                  </div>
                </>
              ) : (
                <div style={{ color: "var(--text-light)", textAlign: "center", padding: "40px", fontSize: "14px", fontWeight: "600" }}>
                  No active medicine schedules configured for this calendar date.
                </div>
              )}
            </div>
          )}
        </main>
        <Footer />
      </div>
    </div>
  );
}

export default CalendarView;

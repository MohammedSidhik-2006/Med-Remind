import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import Navbar from "../components/Navbar";
import Sidebar from "../components/Sidebar";
import Footer from "../components/Footer";
import API from "../services/api";

// Simple bar chart component (no external deps)
function BarChart({ data, height = 120 }) {
  if (!data || data.length === 0) return null;
  const max = Math.max(...data.map(d => d.total || 1), 1);

  return (
    <div style={{ width: "100%", overflowX: "auto", paddingBottom: "8px" }}>
      <div style={{ display: "flex", alignItems: "flex-end", gap: "10px", height: `${height}px`, padding: "0 4px", minWidth: data.length > 7 ? `${data.length * 36}px` : "100%" }}>
        {data.map((d, i) => (
          <div key={i} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", height: "100%", minWidth: data.length > 7 ? "28px" : "auto" }}>
            <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "flex-end", width: "100%", gap: "2px" }}>
              {/* Missed portion */}
              {d.missed > 0 && (
                <div style={{
                  width: "100%",
                  height: `${(d.missed / max) * (height - 30)}px`,
                  background: "var(--danger)", borderRadius: "4px 4px 0 0",
                  minHeight: "4px",
                  transition: "var(--transition-smooth)"
                }} title={`Missed: ${d.missed}`} />
              )}
              {/* Taken portion */}
              {d.taken > 0 && (
                <div style={{
                  width: "100%",
                  height: `${(d.taken / max) * (height - 30)}px`,
                  background: "var(--success)",
                  borderRadius: d.missed > 0 ? "0" : "4px 4px 0 0",
                  minHeight: "4px",
                  transition: "var(--transition-smooth)"
                }} title={`Taken: ${d.taken}`} />
              )}
              {d.taken === 0 && d.missed === 0 && (
                <div style={{ width: "100%", height: "4px", background: "var(--border-light)", borderRadius: "4px" }} />
              )}
            </div>
            <div style={{ fontSize: "10px", color: "var(--text-light)", marginTop: "8px", textAlign: "center", whiteSpace: "nowrap", fontWeight: "600" }}>
              {d.label}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// Adherence line/area chart
function AdherenceChart({ data, height = 120 }) {
  if (!data || data.length === 0) return null;
  const w = 100;
  const h = height;
  const pts = data.map((d, i) => ({
    x: data.length === 1 ? 50 : (i / (data.length - 1)) * w,
    y: d.adherence !== null ? h - (d.adherence / 100) * (h - 20) - 10 : null
  }));

  const validPts = pts.filter(p => p.y !== null);
  if (validPts.length === 0) return <div style={{ color: "var(--text-light)", textAlign: "center", padding: "20px", fontSize: "13px" }}>No data yet</div>;

  const pathD = validPts.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`).join(" ");
  const areaD = `${pathD} L ${validPts[validPts.length - 1].x} ${h} L ${validPts[0].x} ${h} Z`;

  return (
    <svg viewBox={`0 0 100 ${h}`} style={{ width: "100%", height: `${h}px` }} preserveAspectRatio="none">
      <defs>
        <linearGradient id="adherenceGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="var(--primary)" stopOpacity="0.4" />
          <stop offset="100%" stopColor="var(--primary)" stopOpacity="0.02" />
        </linearGradient>
      </defs>
      {/* Grid lines */}
      {[25, 50, 75, 100].map(pct => (
        <line key={pct} x1="0" y1={h - (pct / 100) * (h - 20) - 10}
          x2="100" y2={h - (pct / 100) * (h - 20) - 10}
          stroke="rgba(226, 232, 240, 0.5)" strokeWidth="0.5" />
      ))}
      <path d={areaD} fill="url(#adherenceGrad)" />
      <path d={pathD} fill="none" stroke="var(--primary)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      {validPts.map((p, i) => (
        <circle key={i} cx={p.x} cy={p.y} r="1.5" fill="var(--primary)" stroke="white" strokeWidth="0.5" />
      ))}
    </svg>
  );
}

function Reports() {
  const navigate = useNavigate();
  const [period, setPeriod] = useState("week");
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  // Auth guard
  useEffect(() => {
    if (!localStorage.getItem("token")) navigate("/");
  }, [navigate]);

  const fetchReports = useCallback(async () => {
    setLoading(true);
    try {
      const res = await API.get(`/medicine/reports?period=${period}`);
      setData(res.data);
    } catch (err) {
      console.error("Reports error:", err);
    } finally {
      setLoading(false);
    }
  }, [period]);

  useEffect(() => { fetchReports(); }, [fetchReports]);

  const chartData = data?.dailyData?.map(d => ({
    ...d,
    label: new Date(d.date + "T00:00:00").toLocaleDateString("en-US", {
      month: "short", day: "numeric"
    }).replace(" ", "\n")
  })) || [];

  const streakColor = data?.streak >= 7 ? "var(--warning)" : data?.streak >= 3 ? "var(--success)" : "var(--text-muted)";
  const streakText = data?.streak >= 7 ? "Active" : data?.streak >= 3 ? "On Track" : "Streak";

  return (
    <div className="dashboard-container">
      {/* Sidebar navigation */}
      <Sidebar isOpen={isSidebarOpen} onClose={() => setIsSidebarOpen(false)} />

      <div className="main-layout-content">
        <Navbar onToggleSidebar={() => setIsSidebarOpen(true)} />

        {/* Section title header */}
        <header className="page-header">
          <button onClick={() => navigate("/dashboard")} className="back-btn">←</button>
          <h2 className="page-title">Reports & Adherence Analytics</h2>
        </header>

        <main className="dashboard" style={{ maxWidth: "800px" }}>
          {/* Period Toggle */}
          <div style={{
            display: "flex", background: "white", borderRadius: "var(--radius-md)", padding: "4px",
            boxShadow: "var(--shadow-sm)", marginBottom: "24px", width: "fit-content",
            border: "1px solid var(--border-light)"
          }}>
            {["week", "month"].map(p => (
              <button key={p} onClick={() => setPeriod(p)} style={{
                padding: "10px 24px", border: "none", borderRadius: "10px", cursor: "pointer",
                fontWeight: "700", fontSize: "13px", transition: "var(--transition-smooth)",
                background: period === p ? "var(--primary)" : "transparent",
                color: period === p ? "white" : "var(--text-muted)"
              }}>
                {p === "week" ? "Weekly Overview" : "Monthly Adherence"}
              </button>
            ))}
          </div>

          {loading ? (
            <div style={{ textAlign: "center", padding: "100px 0", color: "var(--text-light)", fontWeight: "600" }}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" style={{ animation: "spin 1s linear infinite", marginBottom: "12px", display: "inline-block" }}>
                <circle cx="12" cy="12" r="10" stroke="rgba(0,0,0,0.1)" strokeWidth="3"/>
                <path d="M12 2a10 10 0 0 1 10 10" stroke="var(--primary)" strokeWidth="3"/>
              </svg>
              <div>Fetching analytics metrics...</div>
            </div>
          ) : (
            <>
              {/* Summary Stats Grid */}
              <div className="reports-stats-grid">
                {[
                  { label: "Overall Adherence", value: `${data?.overallAdherence ?? 0}%`, color: data?.overallAdherence >= 80 ? "var(--success)" : data?.overallAdherence >= 50 ? "var(--warning)" : "var(--danger)" },
                  { label: "Total Taken Doses", value: data?.totalTaken ?? 0, color: "var(--success)" },
                  { label: "Total Missed Doses", value: data?.totalMissed ?? 0, color: data?.totalMissed > 0 ? "var(--danger)" : "var(--success)" },
                ].map(({ label, value, color }) => (
                  <div key={label} style={{
                    background: "white", borderRadius: "var(--radius-md)", padding: "24px 16px",
                    textAlign: "center", boxShadow: "var(--shadow-sm)", border: "1px solid var(--border-light)"
                  }}>
                    <div style={{ fontSize: "28px", fontWeight: "800", color, marginTop: "4px" }}>{value}</div>
                    <div style={{ fontSize: "12px", color: "var(--text-muted)", marginTop: "6px", fontWeight: "700", textTransform: "uppercase", letterSpacing: "0.5px" }}>{label}</div>
                  </div>
                ))}
              </div>

              {/* Streak Panel */}
              <div className="schedule-card" style={{
                marginBottom: "24px", border: "1px solid var(--border-light)",
                display: "flex", alignItems: "center", gap: "20px", padding: "24px 30px"
              }}>
                <div style={{
                  width: "56px", height: "56px", borderRadius: "50%",
                  background: data?.streak > 0 ? "var(--warning-light)" : "#f8fafc",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: "22px", color: data?.streak > 0 ? "var(--warning)" : "var(--text-muted)", flexShrink: 0,
                  border: "2px solid rgba(0,0,0,0.03)"
                }}>🔥</div>
                <div>
                  <div style={{ fontSize: "13px", color: "var(--text-light)", fontWeight: "600" }}>{streakText} Record</div>
                  <div style={{ fontSize: "24px", fontWeight: "800", color: streakColor, letterSpacing: "-0.5px", marginTop: "2px" }}>
                    {data?.streak ?? 0} Day{data?.streak !== 1 ? "s" : ""}
                  </div>
                  <p style={{ fontSize: "13px", color: "var(--text-muted)", marginTop: "4px", fontWeight: "500" }}>
                    {data?.streak === 0
                      ? "Keep all your medication slots checked today to establish a perfect adherence streak!"
                      : data?.streak >= 7
                      ? "Awesome job! You are maintaining clinical compliance guidelines."
                      : "Great habit forming. Let's make it a full week streak!"}
                  </p>
                </div>
              </div>

              {/* Adherence Rate Line Chart */}
              <div className="schedule-card" style={{ marginBottom: "24px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
                  <h3 style={{ color: "var(--text-main)", fontSize: "16px", fontWeight: "800" }}>Compliance Performance</h3>
                  <span style={{
                    background: "var(--success-light)", color: "var(--success)", padding: "4px 12px",
                    borderRadius: "20px", fontSize: "11px", fontWeight: "800", textTransform: "uppercase"
                  }}>{data?.overallAdherence ?? 0}% average</span>
                </div>
                <div style={{ padding: "0 10px" }}>
                  <AdherenceChart data={chartData} height={120} />
                </div>
                {/* Y-axis labels */}
                <div style={{ display: "flex", justifyContent: "space-between", marginTop: "12px", borderTop: "1px solid var(--border-light)", paddingTop: "8px" }}>
                  {["0% Adherence", "25%", "50% Compliance", "75%", "100% Perfect"].map(l => (
                    <span key={l} style={{ fontSize: "10px", color: "var(--text-light)", fontWeight: "600" }}>{l}</span>
                  ))}
                </div>
              </div>

              {/* Missed vs Taken Bar Chart */}
              <div className="schedule-card" style={{ marginBottom: "24px" }}>
                <h3 style={{ color: "var(--text-main)", fontSize: "16px", fontWeight: "800", marginBottom: "20px" }}>
                  Completed vs Missed Timeline
                </h3>
                <BarChart data={chartData} height={140} />
                {/* Legend */}
                <div style={{ display: "flex", gap: "24px", justifyContent: "center", marginTop: "16px", borderTop: "1px solid var(--border-light)", paddingTop: "12px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "12px", color: "var(--text-muted)", fontWeight: "700" }}>
                    <div style={{ width: "12px", height: "12px", background: "var(--success)", borderRadius: "3px" }} />
                    Doses Taken
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "12px", color: "var(--text-muted)", fontWeight: "700" }}>
                    <div style={{ width: "12px", height: "12px", background: "var(--danger)", borderRadius: "3px" }} />
                    Doses Missed
                  </div>
                </div>
              </div>

              {/* Daily Breakdown Table */}
              <div className="schedule-card" style={{ marginBottom: "30px" }}>
                <h3 style={{ color: "var(--text-main)", fontSize: "16px", fontWeight: "800", marginBottom: "20px" }}>
                  Daily Performance Logs
                </h3>
                <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                  {chartData.slice().reverse().map((d, i) => (
                    <div key={i} style={{
                      display: "flex", alignItems: "center", gap: "16px",
                      padding: "12px 16px", background: "#f8fafc", borderRadius: "var(--radius-md)",
                      border: "1px solid var(--border-light)"
                    }}>
                      <div style={{ width: "90px", fontSize: "12px", color: "var(--text-muted)", fontWeight: "700", textTransform: "uppercase" }}>
                        {new Date(d.date + "T00:00:00").toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })}
                      </div>
                      <div style={{ flex: 1, background: "#e2e8f0", borderRadius: "6px", height: "8px", overflow: "hidden" }}>
                        {d.total > 0 && (
                          <div style={{
                            height: "100%", borderRadius: "6px",
                            width: `${d.adherence ?? 0}%`,
                            background: d.adherence >= 80 ? "var(--success)" : d.adherence >= 50 ? "var(--warning)" : "var(--danger)",
                            transition: "width 0.5s ease"
                          }} />
                        )}
                      </div>
                      <div style={{ width: "42px", textAlign: "right", fontSize: "13px", fontWeight: "800",
                        color: d.adherence === null ? "var(--text-light)" : d.adherence >= 80 ? "var(--success)" : d.adherence >= 50 ? "var(--warning-hover)" : "var(--danger)"
                      }}>
                        {d.adherence !== null ? `${d.adherence}%` : "—"}
                      </div>
                      <div style={{ fontSize: "11px", color: "var(--text-light)", width: "110px", textAlign: "right", fontWeight: "600" }}>
                        {d.taken} taken, {d.missed} missed
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}
        </main>
        <Footer />
      </div>
      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}

export default Reports;

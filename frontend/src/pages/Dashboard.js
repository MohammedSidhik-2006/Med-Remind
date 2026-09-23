import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import Navbar from "../components/Navbar";
import Sidebar from "../components/Sidebar";
import MedicineList from "../components/MedicineList";
import DailyProgress from "../components/DailyProgress";
import QuickActions from "../components/QuickActions";
import Footer from "../components/Footer";
import API from "../services/api";
import { setupPushNotifications } from "../services/notifications";

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

function Dashboard() {
  const navigate = useNavigate();
  const [medicines, setMedicines] = useState([]);
  const [loading, setLoading] = useState(true);
  const [nextDose, setNextDose] = useState(null);
  
  // Sidebar State
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  // Push permission prompt banner
  const [showPushBanner, setShowPushBanner] = useState(false);
  const [pushEnabling, setPushEnabling] = useState(false);

  // Statistics State
  const [streak, setStreak] = useState(0);
  const [longestStreak, setLongestStreak] = useState(0);
  const [adherenceRate, setAdherenceRate] = useState(0);
  const [stats, setStats] = useState({ taken: 0, pending: 0, missed: 0, total: 0 });

  // Fetch medicines and reports data
  const fetchMedicines = useCallback(async (showLoading = false) => {
    if (showLoading) setLoading(true);
    try {
      const res = await API.get("/medicine");
      setMedicines(res.data);
      
      // Calculate today's dose stats
      let todayScheduled = 0;
      let todayCompleted = 0;
      let todayMissed = 0;
      let todayPending = 0;

      const now = new Date();
      const pad = n => String(n).padStart(2, "0");
      const todayStr = `${now.getFullYear()}-${pad(now.getMonth()+1)}-${pad(now.getDate())}`;

      const active = res.data.filter(m => {
        if (m.startDate && todayStr < m.startDate) return false;
        if (m.endDate && todayStr > m.endDate) return false;
        return true;
      });

      active.forEach(m => {
        const times = m.times?.length > 0 ? m.times : [m.time];
        times.forEach(t => {
          if (!t) return;
          todayScheduled++;
          const logged = m.todayLogs?.find(l => l.scheduledTime === t);
          if (logged) {
            if (logged.status === "taken") todayCompleted++;
            else if (logged.status === "missed") todayMissed++;
            else todayPending++;
          } else {
            todayPending++;
          }
        });
      });

      setStats({
        taken: todayCompleted,
        missed: todayMissed,
        pending: todayPending,
        total: todayScheduled
      });

    } catch (err) {
      console.error("Error fetching medicines:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchReportsData = useCallback(async () => {
    try {
      const res = await API.get("/medicine/reports?period=month");
      setStreak(res.data.streak || 0);
      setAdherenceRate(res.data.overallAdherence || 0);

      // Compute longest streak in 30 days
      const dailyData = res.data.dailyData || [];
      let currentRun = 0;
      let maxRun = 0;
      dailyData.forEach(d => {
        if (d.total > 0 && d.missed === 0 && d.adherence === 100) {
          currentRun++;
          if (currentRun > maxRun) maxRun = currentRun;
        } else if (d.total > 0) {
          currentRun = 0;
        }
      });
      setLongestStreak(Math.max(maxRun, res.data.streak || 0));
    } catch (err) {
      console.error("Error fetching reports streak data:", err);
    }
  }, []);

  // Auth guard and passive Service Worker auto-updater
  useEffect(() => {
    if (!localStorage.getItem("token")) {
      navigate("/");
    } else {
      fetchMedicines(true);
      fetchReportsData();

      // Refresh every 60 seconds
      const interval = setInterval(() => {
        fetchMedicines();
        fetchReportsData();
      }, 60000);

      // Setup push notifications automatically ONLY if permission is already granted
      if ("Notification" in window && Notification.permission === "granted") {
        setupPushNotifications().catch(err => {
          console.error("Auto setup push notifications failed:", err);
        });
      } else if (
        // Show the banner if permission not yet decided AND user hasn't dismissed it before
        "Notification" in window &&
        Notification.permission === "default" &&
        !localStorage.getItem("pushPromptDismissed")
      ) {
        // Delay slightly so the page settles before showing the banner
        setTimeout(() => setShowPushBanner(true), 2000);
      }

      // Force background Service Worker eviction if a cached, broken version exists.
      if ("serviceWorker" in navigator) {
        navigator.serviceWorker.register("/sw.js").then(reg => {
          reg.update().catch(() => {});
        }).catch(() => {});
      }

      return () => clearInterval(interval);
    }
  }, [navigate, fetchMedicines, fetchReportsData]);

  const handleEnablePush = async () => {
    setPushEnabling(true);
    try {
      const ok = await setupPushNotifications();
      if (ok) {
        setShowPushBanner(false);
      } else {
        // Permission denied or failed — don't nag again
        setShowPushBanner(false);
        localStorage.setItem("pushPromptDismissed", "1");
      }
    } catch (err) {
      console.error("Push enable failed:", err);
      setShowPushBanner(false);
    } finally {
      setPushEnabling(false);
    }
  };

  const handleDismissPushBanner = () => {
    setShowPushBanner(false);
    localStorage.setItem("pushPromptDismissed", "1");
  };

  // Greetings and motivational quotes
  const getUserName = () => {
    const token = localStorage.getItem("token");
    if (!token) return "User";
    try {
      const payload = JSON.parse(atob(token.split(".")[1]));
      return payload.name || "User";
    } catch {
      return "User";
    }
  };

  const getGreeting = () => {
    const hrs = new Date().getHours();
    if (hrs < 12) return "Good Morning";
    if (hrs < 17) return "Good Afternoon";
    return "Good Evening";
  };

  const getMotivationalMessage = () => {
    if (adherenceRate >= 90) return "Outstanding! You are maintaining an excellent medication schedule.";
    if (adherenceRate >= 70) return "You're doing great. Keep focus to complete all doses today.";
    return "Consistency is key to recovery. Try setting alarm reminders for all slots.";
  };

  return (
    <div className="dashboard-container">
      {/* Reusable Sidebar Navigation */}
      <Sidebar isOpen={isSidebarOpen} onClose={() => setIsSidebarOpen(false)} />
      
      {/* Main Layout Area Shifted on Desktop */}
      <div className="main-layout-content">
        <Navbar onToggleSidebar={() => setIsSidebarOpen(true)} globalMedicines={medicines} />

        {/* Push Notification Permission Banner */}
        {showPushBanner && (
          <div style={{
            background: "linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%)",
            color: "white",
            padding: "14px 20px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: "12px",
            flexWrap: "wrap",
            zIndex: 100,
            boxShadow: "0 2px 12px rgba(79,70,229,0.4)"
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: "12px", flex: 1 }}>
              <span style={{ fontSize: "22px" }}>🔔</span>
              <div>
                <div style={{ fontWeight: "800", fontSize: "14px" }}>Enable Medication Reminders</div>
                <div style={{ fontSize: "12px", opacity: 0.85, marginTop: "2px" }}>
                  Get notified even when the app is closed — like Flipkart order alerts.
                </div>
              </div>
            </div>
            <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
              <button
                onClick={handleEnablePush}
                disabled={pushEnabling}
                style={{
                  padding: "9px 20px", background: "white", color: "#4f46e5",
                  border: "none", borderRadius: "8px", fontWeight: "800",
                  fontSize: "13px", cursor: "pointer", opacity: pushEnabling ? 0.7 : 1
                }}
              >
                {pushEnabling ? "Enabling..." : "Enable Now"}
              </button>
              <button
                onClick={handleDismissPushBanner}
                style={{
                  padding: "9px 14px", background: "rgba(255,255,255,0.15)",
                  color: "white", border: "1px solid rgba(255,255,255,0.3)",
                  borderRadius: "8px", fontWeight: "700", fontSize: "12px", cursor: "pointer"
                }}
              >
                Not Now
              </button>
            </div>
          </div>
        )}
        
        <main className="dashboard">
          {/* Top Hero Section */}
          <div className="dashboard-hero">
            <div className="hero-welcome">
              <h2>{getGreeting()}, <span>{getUserName()}</span></h2>
              <p style={{ marginTop: "6px" }}>{getMotivationalMessage()}</p>
            </div>
            <div className="hero-date-box">
              <div className="hero-date">
                {new Date().toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })}
              </div>
              {nextDose ? (
                <div className="hero-time">
                  Next: {nextDose.name} at {formatTo12Hour(nextDose.time)}
                </div>
              ) : (
                <div className="hero-time" style={{ color: "#94a3b8" }}>
                  All schedules completed
                </div>
              )}
            </div>
          </div>

          {/* Quick Statistics Cards Row */}
          <div className="stats-dashboard-grid">
            <div className="stat-dashboard-card taken">
              <div className="stat-label">Taken Today</div>
              <div className="stat-val">{stats.taken} <span style={{ fontSize: "14px", fontWeight: "600", color: "var(--text-light)" }}>/ {stats.total} doses</span></div>
            </div>
            <div className="stat-dashboard-card pending">
              <div className="stat-label">Pending / Snoozed</div>
              <div className="stat-val">{stats.pending} <span style={{ fontSize: "14px", fontWeight: "600", color: "var(--text-light)" }}>doses left</span></div>
            </div>
            <div className="stat-dashboard-card missed">
              <div className="stat-label">Missed Doses</div>
              <div className="stat-val">{stats.missed} <span style={{ fontSize: "14px", fontWeight: "600", color: "var(--text-light)" }}>recorded</span></div>
            </div>
          </div>

          {/* Adherence Streak Bar */}
          <div className="schedule-card" style={{ padding: "20px 24px", marginBottom: "30px", display: "flex", flexWrap: "wrap", justifyContent: "space-between", alignItems: "center", gap: "16px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
              <div style={{
                width: "48px", height: "48px", borderRadius: "50%",
                background: "var(--warning-light)", display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: "20px", color: "var(--warning)"
              }}>🔥</div>
              <div>
                <div style={{ fontSize: "13px", fontWeight: "750", color: "var(--text-light)" }}>Current Streak</div>
                <div style={{ fontSize: "20px", fontWeight: "800", color: "var(--text-main)", marginTop: "2px" }}>{streak} Day{streak !== 1 ? "s" : ""}</div>
              </div>
            </div>
            
            <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
              <div style={{
                width: "48px", height: "48px", borderRadius: "50%",
                background: "var(--primary-light)", display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: "20px", color: "var(--primary)"
              }}>🏆</div>
              <div>
                <div style={{ fontSize: "13px", fontWeight: "750", color: "var(--text-light)" }}>Longest Streak</div>
                <div style={{ fontSize: "20px", fontWeight: "800", color: "var(--text-main)", marginTop: "2px" }}>{longestStreak} Day{longestStreak !== 1 ? "s" : ""}</div>
              </div>
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
              <div style={{
                width: "48px", height: "48px", borderRadius: "50%",
                background: "var(--success-light)", display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: "20px", color: "var(--success)"
              }}>📈</div>
              <div>
                <div style={{ fontSize: "13px", fontWeight: "750", color: "var(--text-light)" }}>Overall Adherence</div>
                <div style={{ fontSize: "20px", fontWeight: "800", color: "var(--text-main)", marginTop: "2px" }}>{adherenceRate}%</div>
              </div>
            </div>
          </div>

          {/* Split Dashboard Grid */}
          <div className="dashboard-grid">
            {/* Left Side: Timelines and Schedules */}
            <div style={{ display: "flex", flexDirection: "column", gap: "30px" }}>
              <MedicineList 
                medicines={medicines}
                setMedicines={setMedicines}
                loading={loading}
                refreshMedicines={fetchMedicines}
                navigate={navigate} 
              />
            </div>

            {/* Right Side: Circular adherence progress and Quick shortcuts */}
            <div style={{ display: "flex", flexDirection: "column", gap: "30px" }}>
              {/* Daily Circular Ring progress */}
              <DailyProgress medicines={medicines} onNextDose={setNextDose} />

              {/* Quick Actions Shortcuts Container */}
              <div className="quick-actions-container">
                <h3 style={{ fontSize: "15px", fontWeight: "800", color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.8px", marginBottom: "20px" }}>
                  Quick Shortcuts
                </h3>
                <QuickActions navigate={navigate} />
              </div>
            </div>
          </div>
        </main>

        <Footer />
      </div>
    </div>
  );
}

export default Dashboard;

import React, { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import AppShell from "../components/AppShell";
import { Card, Button, ProgressBar } from "../components/UI";
import { SkeletonDashboard } from "../components/Skeleton";
import API from "../services/api";
import { setupPushNotifications } from "../services/notifications";
import { useToast } from "../components/Toast";
import MedicineList from "../components/MedicineList";
import "./Dashboard.css";

/**
 * Modern Dashboard - The heart of MedRemind
 * Redesigned with human-centered healthcare UX principles
 */
function Dashboard() {
  const navigate = useNavigate();
  const { addToast } = useToast();
  
  // Core state
  const [medicines, setMedicines] = useState([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({ taken: 0, pending: 0, missed: 0, total: 0 });
  const [adherenceRate, setAdherenceRate] = useState(0);
  const [streak, setStreak] = useState(0);
  
  // Push notification state  
  const [showPushPrompt, setShowPushPrompt] = useState(false);
  const [settingUpPush, setSettingUpPush] = useState(false);

  // Auth guard
  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) {
      navigate("/");
      return;
    }
  }, [navigate]);

  // Get user info from token
  const getUserInfo = () => {
    try {
      const token = localStorage.getItem("token");
      if (!token) return null;
      const payload = JSON.parse(atob(token.split(".")[1]));
      return payload;
    } catch {
      return null;
    }
  };

  const user = getUserInfo();

  // Fetch dashboard data
  const fetchDashboardData = useCallback(async (showLoading = true) => {
    if (showLoading) setLoading(true);
    
    try {
      const [medicinesRes, reportsRes] = await Promise.all([
        API.get("/medicine"),
        API.get("/medicine/reports?period=month")
      ]);

      const medicinesData = medicinesRes.data;
      const reportsData = reportsRes.data;

      setMedicines(medicinesData);
      setStreak(reportsData.streak || 0);
      setAdherenceRate(reportsData.overallAdherence || 0);

      // Calculate today's stats
      const today = new Date().toISOString().split('T')[0];
      const activeMedicines = medicinesData.filter(med => {
        if (med.startDate && today < med.startDate) return false;
        if (med.endDate && today > med.endDate) return false;
        return true;
      });

      let totalScheduled = 0;
      let totalTaken = 0;
      let totalMissed = 0;
      let totalPending = 0;

      activeMedicines.forEach(med => {
        const times = med.times?.length > 0 ? med.times : [med.time];
        times.forEach((slotTime) => {
          totalScheduled++;
          const slotLog = med.todayLogs?.find(log => 
            log.scheduledTime === slotTime
          );
          
          if (slotLog) {
            if (slotLog.status === "taken") totalTaken++;
            else if (slotLog.status === "missed") totalMissed++;
            else totalPending++;
          } else {
            totalPending++;
          }
        });
      });

      setStats({
        taken: totalTaken,
        missed: totalMissed,
        pending: totalPending,
        total: totalScheduled
      });

    } catch (error) {
      console.error("Error fetching dashboard data:", error);
      addToast("Failed to load dashboard data", "error");
    } finally {
      setLoading(false);
    }
  }, [addToast]);

  useEffect(() => {
    fetchDashboardData();
    
    // Set up periodic refresh
    const interval = setInterval(() => fetchDashboardData(false), 30000);
    return () => clearInterval(interval);
  }, [fetchDashboardData]);

  // Push notification setup
  useEffect(() => {
    // Show push prompt if permission is default and not dismissed
    if (
      "Notification" in window &&
      Notification.permission === "default" &&
      !localStorage.getItem("pushPromptDismissed")
    ) {
      setTimeout(() => setShowPushPrompt(true), 3000);
    }
    
    // Auto-setup if permission already granted
    if ("Notification" in window && Notification.permission === "granted") {
      setupPushNotifications().catch(console.error);
    }
  }, []);

  const handlePushSetup = async () => {
    setSettingUpPush(true);
    try {
      const success = await setupPushNotifications();
      if (success) {
        setShowPushPrompt(false);
        addToast("Push notifications enabled successfully!", "success");
      } else {
        setShowPushPrompt(false);
        localStorage.setItem("pushPromptDismissed", "1");
        addToast("Push notifications setup was cancelled", "info");
      }
    } catch (error) {
      console.error("Push setup failed:", error);
      addToast("Failed to setup push notifications", "error");
    } finally {
      setSettingUpPush(false);
    }
  };

  const dismissPushPrompt = () => {
    setShowPushPrompt(false);
    localStorage.setItem("pushPromptDismissed", "1");
  };

  // Get next upcoming medication
  const getNextMedication = () => {
    const now = new Date();
    const currentTime = now.toTimeString().slice(0, 5); // HH:MM format
    
    const upcoming = medicines
      .filter(med => med.confirmationPending || !med.taken)
      .map(med => {
        const times = med.times?.length > 0 ? med.times : [med.time];
        return times.map(time => ({ ...med, scheduledTime: time }));
      })
      .flat()
      .filter(med => med.scheduledTime >= currentTime)
      .sort((a, b) => a.scheduledTime.localeCompare(b.scheduledTime));

    return upcoming[0] || null;
  };

  const nextMed = getNextMedication();

  // Calculate daily progress percentage
  const dailyProgress = stats.total > 0 ? (stats.taken / stats.total) * 100 : 0;

  const greeting = (() => {
    const hour = new Date().getHours();
    if (hour < 12) return "Good morning";
    if (hour < 17) return "Good afternoon";
    return "Good evening";
  })();

  if (loading) {
    return (
      <AppShell title="Dashboard">
        <SkeletonDashboard />
      </AppShell>
    );
  }

  return (
    <AppShell title="Dashboard" subtitle="Your medication overview">
      <div className="dashboard-container">
        {/* Push notification prompt */}
        {showPushPrompt && (
          <Card className="push-prompt-banner mb-6">
            <div className="flex items-center gap-4">
              <div className="flex-shrink-0">
                <div className="notification-icon">
                  <svg className="icon icon-lg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
                    <path d="M13.73 21a2 2 0 0 1-3.46 0" />
                  </svg>
                </div>
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-semibold text-primary mb-1">
                  Enable Medication Reminders
                </h3>
                <p className="text-sm text-secondary">
                  Get notified when it's time to take your medication, even when the app is closed.
                </p>
              </div>
              <div className="flex gap-2">
                <Button 
                  variant="ghost" 
                  size="sm"
                  onClick={dismissPushPrompt}
                >
                  Later
                </Button>
                <Button 
                  variant="primary" 
                  size="sm"
                  loading={settingUpPush}
                  onClick={handlePushSetup}
                >
                  Enable
                </Button>
              </div>
            </div>
          </Card>
        )}

        {/* Welcome section */}
        <div className="welcome-section mb-8">
          <h1 className="text-3xl font-bold text-primary mb-2">
            {greeting}, {user?.name?.split(" ")[0] || "there"}! 
          </h1>
          <p className="text-lg text-secondary">
            Here's your medication plan for today
          </p>
        </div>

        {/* Stats overview */}
        <div className="stats-grid mb-8">
          <Card className="stat-card">
            <div className="stat-content">
              <div className="stat-value text-2xl font-extrabold text-success">
                {stats.taken}
              </div>
              <div className="stat-label text-sm font-medium text-muted">
                Doses Taken
              </div>
            </div>
            <div className="stat-icon bg-success-light text-success">
              <svg className="icon icon-md" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polyline points="20,6 9,17 4,12" />
              </svg>
            </div>
          </Card>

          <Card className="stat-card">
            <div className="stat-content">
              <div className="stat-value text-2xl font-extrabold text-warning">
                {stats.pending}
              </div>
              <div className="stat-label text-sm font-medium text-muted">
                Pending
              </div>
            </div>
            <div className="stat-icon bg-warning-light text-warning">
              <svg className="icon icon-md" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10" />
                <polyline points="12,6 12,12 16,14" />
              </svg>
            </div>
          </Card>

          <Card className="stat-card">
            <div className="stat-content">
              <div className="stat-value text-2xl font-extrabold text-danger">
                {stats.missed}
              </div>
              <div className="stat-label text-sm font-medium text-muted">
                Missed
              </div>
            </div>
            <div className="stat-icon bg-danger-light text-danger">
              <svg className="icon icon-md" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10" />
                <line x1="15" y1="9" x2="9" y2="15" />
                <line x1="9" y1="9" x2="15" y2="15" />
              </svg>
            </div>
          </Card>

          <Card className="stat-card">
            <div className="stat-content">
              <div className="stat-value text-2xl font-extrabold text-primary">
                {streak}
              </div>
              <div className="stat-label text-sm font-medium text-muted">
                Day Streak
              </div>
            </div>
            <div className="stat-icon bg-primary-light text-primary">
              <svg className="icon icon-md" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z" />
              </svg>
            </div>
          </Card>
        </div>

        {/* Main content grid */}
        <div className="main-grid">
          {/* Left column */}
          <div className="main-content">
            {/* Next medication alert */}
            {nextMed && (
              <Card className="next-dose-card mb-6">
                <div className="next-dose-content">
                  <div className="next-dose-info">
                    <div className="next-dose-label text-sm font-semibold text-muted uppercase">
                      Next Medication
                    </div>
                    <h3 className="next-dose-name text-xl font-bold text-primary">
                      {nextMed.name}
                    </h3>
                    <p className="next-dose-details text-secondary">
                      {nextMed.dosage} â€¢ {formatTime(nextMed.scheduledTime)}
                    </p>
                  </div>
                </div>
              </Card>
            )}

            {/* Today's progress */}
            <Card className="progress-card mb-6">
              <Card.Header>
                <h3 className="text-lg font-semibold text-primary">Today's Progress</h3>
              </Card.Header>
              <Card.Body>
                <ProgressBar.Adherence
                  value={dailyProgress}
                  label={`${stats.taken} of ${stats.total} doses completed`}
                  showGrade={true}
                />
                
                <div className="progress-breakdown mt-4">
                  <div className="flex justify-between text-sm">
                    <span className="text-success">âœ“ Taken: {stats.taken}</span>
                    <span className="text-warning">â³ Pending: {stats.pending}</span>
                    <span className="text-danger">âœ— Missed: {stats.missed}</span>
                  </div>
                </div>
              </Card.Body>
            </Card>

            {/* Today's medications */}
            <Card>
              <Card.Header>
                <div className="flex justify-between items-center">
                  <h3 className="text-lg font-semibold text-primary">Today's Medications</h3>
                  <Button 
                    variant="ghost" 
                    size="sm"
                    onClick={() => fetchDashboardData(false)}
                  >
                    <svg className="icon icon-sm" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8" />
                      <path d="M21 3v5h-5" />
                      <path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16" />
                      <path d="M8 16H3v5" />
                    </svg>
                  </Button>
                </div>
              </Card.Header>
              <Card.Body>
                <MedicineList medicines={medicines} refreshMedicines={() => fetchDashboardData(false)} />
              </Card.Body>
            </Card>
          </div>

          {/* Right column - Quick actions */}
          <div className="sidebar-content">
            <Card>
              <Card.Header>
                <h3 className="text-lg font-semibold text-primary">Quick Actions</h3>
              </Card.Header>
              <Card.Body>
                <div className="quick-actions">
                  <QuickActionItem 
                    icon={
                      <svg className="icon icon-md" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <circle cx="12" cy="12" r="10" />
                        <line x1="12" y1="8" x2="12" y2="16" />
                        <line x1="8" y1="12" x2="16" y2="12" />
                      </svg>
                    }
                    title="Add Medication"
                    description="Set up a new medication schedule"
                    onClick={() => navigate("/add-medicine")}
                  />
                  
                  <QuickActionItem 
                    icon={
                      <svg className="icon icon-md" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                        <line x1="16" y1="2" x2="16" y2="6" />
                        <line x1="8" y1="2" x2="8" y2="6" />
                        <line x1="3" y1="10" x2="21" y2="10" />
                      </svg>
                    }
                    title="View Calendar"
                    description="See your medication history"
                    onClick={() => navigate("/calendar")}
                  />

                  <QuickActionItem 
                    icon={
                      <svg className="icon icon-md" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
                      </svg>
                    }
                    title="Refill Tracker"
                    description="Monitor medication stock"
                    onClick={() => navigate("/refill")}
                  />

                  <QuickActionItem 
                    icon={
                      <svg className="icon icon-md" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <line x1="18" y1="20" x2="18" y2="10" />
                        <line x1="12" y1="20" x2="12" y2="4" />
                        <line x1="6" y1="20" x2="6" y2="14" />
                      </svg>
                    }
                    title="View Reports"
                    description="Adherence analytics"
                    onClick={() => navigate("/reports")}
                  />
                </div>
              </Card.Body>
            </Card>

            {/* Adherence summary */}
            <Card className="mt-6">
              <Card.Header>
                <h3 className="text-lg font-semibold text-primary">Monthly Summary</h3>
              </Card.Header>
              <Card.Body>
                <div className="adherence-summary">
                  <div className="adherence-stat">
                    <span className="text-2xl font-bold text-primary">{adherenceRate}%</span>
                    <span className="text-sm text-muted">Overall Adherence</span>
                  </div>
                  <div className="adherence-stat">
                    <span className="text-2xl font-bold text-success">{streak}</span>
                    <span className="text-sm text-muted">Current Streak</span>
                  </div>
                </div>
              </Card.Body>
            </Card>
          </div>
        </div>
      </div>

      
    </AppShell>
  );
}

function QuickActionItem({ icon, title, description, onClick }) {
  return (
    <button 
      className="quick-action-item"
      onClick={onClick}
    >
      <div className="quick-action-icon">
        {icon}
      </div>
      <div className="quick-action-content">
        <div className="quick-action-title">{title}</div>
        <div className="quick-action-description">{description}</div>
      </div>

      
    </button>
  );
}

// Helper function to format time
function formatTime(timeStr) {
  if (!timeStr) return "";
  const [hourStr, minStr] = timeStr.split(":");
  const hour = parseInt(hourStr, 10);
  if (isNaN(hour)) return timeStr;
  const ampm = hour >= 12 ? "PM" : "AM";
  const formattedHour = hour % 12 === 0 ? 12 : hour % 12;
  return `${formattedHour}:${minStr} ${ampm}`;
}

export default Dashboard;



import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import API from "../services/api";

const getTokenData = () => {
  try {
    const token = localStorage.getItem("token");
    if (!token) return null;
    const base64Url = token.split(".")[1];
    const base64 = base64Url.replace(/-/g, "+").replace(/_/g, "/");
    const jsonPayload = decodeURIComponent(
      window.atob(base64)
        .split("")
        .map(c => "%" + ("00" + c.charCodeAt(0).toString(16)).slice(-2))
        .join("")
    );
    return JSON.parse(jsonPayload);
  } catch {
    return null;
  }
};

function Navbar({ onToggleSidebar, globalMedicines }) {
  const navigate = useNavigate();
  const user = getTokenData();
  const userName = user?.name || "User";
  const initials = userName
    ? userName.split(" ").filter(Boolean).map(w => w[0]).join("").toUpperCase().slice(0, 2)
    : "U";

  // Date and Time State
  const [dateTime, setDateTime] = useState(new Date());
  // Notification Dropdown and List State
  const [showNotifications, setShowNotifications] = useState(false);
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [pendingMeds, setPendingMeds] = useState([]);

  useEffect(() => {
    const timer = setInterval(() => {
      setDateTime(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const fetchPendingMedicines = useCallback(async () => {
    try {
      const res = await API.get("/medicine");
      const pending = res.data.filter(m => m.confirmationPending && !m.taken);
      setPendingMeds(pending);
    } catch (err) {
      console.error("Navbar notification count error:", err);
    }
  }, []);

  useEffect(() => {
    if (globalMedicines) {
      // Sync instantly from parent (like Dashboard)
      setPendingMeds(globalMedicines.filter(m => m.confirmationPending && !m.taken));
    } else {
      // Fallback for pages without globalMedicines
      fetchPendingMedicines();
      const interval = setInterval(() => fetchPendingMedicines(), 30000);
      return () => clearInterval(interval);
    }
  }, [globalMedicines, fetchPendingMedicines]);

  const handleLogout = () => {
    localStorage.removeItem("token");
    navigate("/");
  };

  const formattedDate = dateTime.toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric"
  });

  const formattedTime = dateTime.toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: true
  });

  return (
    <header className="navbar">
      {/* LEFT: Hamburger Menu Button */}
      <button 
        onClick={onToggleSidebar}
        className="navbar-hamburger-btn"
        title="Toggle Navigation"
      >
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <line x1="3" y1="12" x2="21" y2="12"></line>
          <line x1="3" y1="6" x2="21" y2="6"></line>
          <line x1="3" y1="18" x2="21" y2="18"></line>
        </svg>
      </button>

      {/* CENTER: Brand (Desktop only) */}
      <div 
        onClick={() => navigate("/dashboard")} 
        className="navbar-brand"
      >
        <div className="navbar-logo-icon">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
            <line x1="12" y1="5" x2="12" y2="19"></line>
            <line x1="5" y1="12" x2="19" y2="12"></line>
          </svg>
        </div>
        <h3 className="navbar-logo-text">MedRemind</h3>
      </div>

      {/* CENTER: Date & Time (Desktop only) */}
      <div className="navbar-datetime-widget">
        <span className="navbar-date">{formattedDate}</span>
        <span className="navbar-separator">|</span>
        <span className="navbar-time">{formattedTime}</span>
      </div>

      {/* RIGHT: Notifications + Profile Icons */}
      <div className="navbar-user">
        {/* Notification Bell */}
        <div style={{ position: "relative" }}>
          <button 
            className={`navbar-bell-btn ${pendingMeds.length > 0 ? "has-badge" : ""}`}
            onClick={() => {
              setShowNotifications(!showNotifications);
              setShowProfileMenu(false);
            }}
            title="Notifications"
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path>
              <path d="M13.73 21a2 2 0 0 1-3.46 0"></path>
            </svg>
            {pendingMeds.length > 0 && (
              <span className="navbar-bell-badge">{pendingMeds.length}</span>
            )}
          </button>

          {/* Notifications Dropdown */}
          {showNotifications && (
            <div className="navbar-dropdown notifications-dropdown">
              <div className="dropdown-header">
                <h4>Notifications</h4>
                {pendingMeds.length > 0 && <span className="alert-count-badge">{pendingMeds.length} pending</span>}
              </div>
              <div className="dropdown-body">
                {pendingMeds.length === 0 ? (
                  <div className="empty-dropdown">
                    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="var(--text-light)" strokeWidth="1.5" style={{ marginBottom: "8px" }}>
                      <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                      <polyline points="22 4 12 14.01 9 11.01" />
                    </svg>
                    <p>All schedules are caught up!</p>
                  </div>
                ) : (
                  pendingMeds.map((med) => (
                    <div 
                      key={med._id} 
                      className="notification-dropdown-item"
                      onClick={() => {
                        setShowNotifications(false);
                        navigate("/dashboard");
                      }}
                    >
                      <div className="notification-item-icon">Rx</div>
                      <div className="notification-item-info">
                        <div className="notification-item-title">Medication Reminder</div>
                        <p>Time to take <strong>{med.name}</strong> ({med.dosage})</p>
                      </div>
                    </div>
                  ))
                )}
              </div>
              <div className="dropdown-footer">
                <button onClick={() => { setShowNotifications(false); navigate("/history"); }}>View Adherence History Log</button>
              </div>
            </div>
          )}
        </div>

        {/* Profile Avatar Dropdown */}
        <div style={{ position: "relative" }}>
          <button
            onClick={() => {
              setShowProfileMenu(!showProfileMenu);
              setShowNotifications(false);
            }}
            title="Profile Menu"
            className="navbar-avatar-btn"
          >
            {initials}
          </button>

          {showProfileMenu && (
            <div className="navbar-dropdown profile-dropdown">
              <div className="dropdown-header user-card">
                <div className="user-card-avatar">{initials}</div>
                <div className="user-card-info">
                  <div className="user-name">{userName}</div>
                  <div className="user-role">{user?.role === "admin" ? "SaaS Admin" : "Patient"}</div>
                </div>
              </div>
              <div className="dropdown-body">
                <button onClick={() => { setShowProfileMenu(false); navigate("/profile"); }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>
                  Profile Settings
                </button>
                <button onClick={() => { setShowProfileMenu(false); navigate("/caregiver/link"); }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="8.5" cy="7" r="4"/><line x1="20" y1="8" x2="20" y2="14"/><line x1="23" y1="11" x2="17" y2="11"/></svg>
                  Link Caregiver
                </button>
                <button onClick={() => { setShowProfileMenu(false); navigate("/refill"); }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/></svg>
                  Refill Tracker
                </button>
                {user?.role === "admin" && (
                  <button onClick={() => { setShowProfileMenu(false); navigate("/admin"); }}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><line x1="9" y1="3" x2="9" y2="21"/><line x1="15" y1="3" x2="15" y2="21"/><line x1="3" y1="9" x2="21" y2="9"/><line x1="3" y1="15" x2="21" y2="15"/></svg>
                    Admin Panel
                  </button>
                )}
              </div>
              <div className="dropdown-footer">
                <button className="logout-btn" onClick={handleLogout}>Sign Out</button>
              </div>
            </div>
          )}
        </div>
      </div>

      <style>{`
        /* HAMBURGER */
        .navbar-hamburger-btn {
          background: transparent;
          border: none;
          color: var(--text-main);
          cursor: pointer;
          padding: 6px;
          border-radius: 6px;
          display: flex;
          align-items: center;
          justify-content: center;
          width: 40px;
          height: 40px;
          flex-shrink: 0;
          transition: all 0.2s ease;
        }

        .navbar-hamburger-btn:hover {
          background: var(--primary-light);
          color: var(--primary);
        }

        /* BRAND */
        .navbar-brand {
          display: none;
          align-items: center;
          gap: 8px;
          cursor: pointer;
          user-select: none;
          white-space: nowrap;
          flex-shrink: 0;
        }

        @media (min-width: 768px) {
          .navbar-brand {
            display: flex;
          }
        }

        .navbar-logo-icon {
          width: 28px;
          height: 28px;
          border-radius: 6px;
          background: linear-gradient(135deg, var(--primary) 0%, #0ea5e9 100%);
          display: flex;
          align-items: center;
          justify-content: center;
          box-shadow: 0 2px 6px rgba(13, 148, 136, 0.15);
        }

        .navbar-logo-text {
          font-size: 15px;
          font-weight: 800;
          background: linear-gradient(135deg, var(--primary) 0%, #0ea5e9 100%);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
          margin: 0;
        }

        /* DATETIME */
        .navbar-datetime-widget {
          display: none;
          align-items: center;
          gap: 10px;
          font-size: 12px;
          font-weight: 600;
          color: var(--text-muted);
          background: white;
          padding: 6px 12px;
          border-radius: 6px;
          border: 1px solid var(--border-light);
          box-shadow: 0 2px 6px rgba(0, 0, 0, 0.03);
          flex-shrink: 0;
          white-space: nowrap;
        }

        @media (min-width: 1024px) {
          .navbar-datetime-widget {
            display: flex;
          }
        }

        .navbar-separator {
          color: var(--border-light);
          user-select: none;
        }

        .navbar-time {
          color: var(--primary);
          font-family: 'Courier New', monospace;
          font-weight: 700;
        }

        /* USER ACTIONS - RIGHT SIDE */
        .navbar-user {
          display: flex;
          align-items: center;
          gap: 8px;
          flex-shrink: 0;
        }

        /* BELL */
        .navbar-bell-btn {
          width: 36px;
          height: 36px;
          border-radius: 50%;
          background: white;
          border: 1px solid var(--border-light);
          color: var(--text-muted);
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: all 0.2s ease;
          position: relative;
          flex-shrink: 0;
        }

        .navbar-bell-btn:hover {
          color: var(--primary);
          background: var(--primary-light);
          border-color: transparent;
        }

        .navbar-bell-btn.has-badge {
          animation: pulse-ring 2s infinite;
        }

        @keyframes pulse-ring {
          0% { box-shadow: 0 0 0 0 rgba(13, 148, 136, 0.4); }
          70% { box-shadow: 0 0 0 4px rgba(13, 148, 136, 0); }
          100% { box-shadow: 0 0 0 0 rgba(13, 148, 136, 0); }
        }

        .navbar-bell-badge {
          position: absolute;
          top: -5px;
          right: -5px;
          background: var(--danger);
          color: white;
          font-size: 9px;
          font-weight: 800;
          min-width: 16px;
          height: 16px;
          border-radius: 8px;
          display: flex;
          align-items: center;
          justify-content: center;
          border: 2px solid white;
        }

        /* AVATAR */
        .navbar-avatar-btn {
          width: 36px;
          height: 36px;
          border-radius: 50%;
          background: linear-gradient(135deg, var(--primary) 0%, #0ea5e9 100%);
          border: 2px solid white;
          color: white;
          font-weight: 750;
          font-size: 12px;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: all 0.2s ease;
          box-shadow: 0 2px 6px rgba(13, 148, 136, 0.12);
          flex-shrink: 0;
        }

        .navbar-avatar-btn:hover {
          transform: scale(1.05);
        }

        /* DROPDOWNS */
        .navbar-dropdown {
          position: absolute;
          top: calc(100% + 8px);
          right: 0;
          background: white;
          border-radius: 8px;
          border: 1px solid var(--border-light);
          box-shadow: 0 10px 40px rgba(0, 0, 0, 0.1);
          z-index: 1010;
          display: flex;
          flex-direction: column;
          overflow: hidden;
          animation: dropdown-fade 0.15s ease-out;
        }

        @keyframes dropdown-fade {
          from { transform: translateY(-10px); opacity: 0; }
          to { transform: translateY(0); opacity: 1; }
        }

        .notifications-dropdown {
          width: 300px;
          max-height: 350px;
        }

        .profile-dropdown {
          width: 240px;
        }

        .dropdown-header {
          padding: 14px 16px;
          border-bottom: 1px solid #e2e8f0;
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 8px;
        }

        .dropdown-header h4 {
          font-size: 13px;
          font-weight: 800;
          color: var(--text-main);
          margin: 0;
        }

        .alert-count-badge {
          background: var(--danger-light);
          color: var(--danger);
          padding: 2px 6px;
          border-radius: 10px;
          font-size: 10px;
          font-weight: 700;
          white-space: nowrap;
        }

        .dropdown-body {
          padding: 6px;
          display: flex;
          flex-direction: column;
          gap: 2px;
          max-height: 240px;
          overflow-y: auto;
        }

        .empty-dropdown {
          text-align: center;
          padding: 24px 14px;
          color: var(--text-light);
        }

        .empty-dropdown p {
          font-size: 11px;
          font-weight: 600;
          margin: 0;
        }

        .notification-dropdown-item {
          display: flex;
          gap: 10px;
          padding: 8px 10px;
          border-radius: 6px;
          cursor: pointer;
          transition: all 0.15s ease;
        }

        .notification-dropdown-item:hover {
          background: var(--primary-light);
        }

        .notification-item-icon {
          width: 28px;
          height: 28px;
          border-radius: 6px;
          background: var(--warning-light);
          color: var(--warning-hover);
          font-weight: 700;
          font-size: 11px;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
        }

        .notification-item-info {
          flex: 1;
        }

        .notification-item-title {
          font-size: 11px;
          font-weight: 700;
          color: var(--text-main);
        }

        .notification-item-info p {
          font-size: 10px;
          color: var(--text-light);
          margin: 2px 0 0 0;
        }

        /* PROFILE DROPDOWN */
        .dropdown-header.user-card {
          gap: 10px;
          justify-content: flex-start;
        }

        .user-card-avatar {
          width: 38px;
          height: 38px;
          border-radius: 50%;
          background: var(--primary-light);
          color: var(--primary);
          font-weight: 800;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 12px;
          flex-shrink: 0;
        }

        .user-card-info {
          display: flex;
          flex-direction: column;
          gap: 1px;
        }

        .user-name {
          font-size: 12px;
          font-weight: 800;
          color: var(--text-main);
          margin: 0;
        }

        .user-role {
          font-size: 10px;
          color: var(--text-light);
          font-weight: 600;
          margin: 0;
        }

        .profile-dropdown .dropdown-body button {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 8px 10px;
          background: transparent;
          border: none;
          color: var(--text-muted);
          border-radius: 6px;
          font-size: 12px;
          font-weight: 600;
          text-align: left;
          cursor: pointer;
          transition: all 0.15s ease;
          width: 100%;
        }

        .profile-dropdown .dropdown-body button:hover {
          background: #f1f5f9;
          color: var(--text-main);
        }

        .dropdown-footer {
          padding: 6px;
          border-top: 1px solid #e2e8f0;
          background: #f8fafc;
        }

        .dropdown-footer button {
          width: 100%;
          background: transparent;
          border: none;
          color: var(--primary);
          font-weight: 700;
          font-size: 11px;
          padding: 6px;
          cursor: pointer;
          border-radius: 5px;
          transition: all 0.15s ease;
        }

        .dropdown-footer button:hover {
          background: var(--primary-light);
        }

        .dropdown-footer button.logout-btn {
          color: var(--danger);
        }

        .dropdown-footer button.logout-btn:hover {
          background: var(--danger-light);
        }

        @media (max-width: 576px) {
          .notifications-dropdown {
            width: calc(100vw - 24px);
            max-width: 280px;
            left: 12px;
            right: auto;
          }

          .profile-dropdown {
            width: calc(100vw - 24px);
            max-width: 260px;
            right: 12px;
            left: auto;
          }
        }
      `}</style>
    </header>
  );
}

export default Navbar;

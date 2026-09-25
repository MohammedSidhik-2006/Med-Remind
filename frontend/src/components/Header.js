import React, { useState, useEffect, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import API from "../services/api";

/**
 * Header - Modern application header with navigation, notifications, and profile
 */
function Header({ onMenuToggle, title, subtitle, showBackButton, onBack }) {
  const navigate = useNavigate();
  const [currentTime, setCurrentTime] = useState(new Date());
  const [notifications, setNotifications] = useState([]);
  const [showNotifications, setShowNotifications] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const notificationRef = useRef(null);
  const profileRef = useRef(null);

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
  const userName = user?.name || "User";
  const userRole = user?.role || "user";
  const userAvatar = user?.avatar || "👤";
  const initials = userName
    .split(" ")
    .map(name => name[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  // Update time every second
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Fetch pending medications for notifications
  const fetchNotifications = useCallback(async () => {
    try {
      const res = await API.get("/medicine");
      const pending = res.data.filter(med => 
        med.confirmationPending && !med.taken
      );
      setNotifications(pending);
    } catch (error) {
      console.error("Failed to fetch notifications:", error);
    }
  }, []);

  useEffect(() => {
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 30000); // Refresh every 30s
    return () => clearInterval(interval);
  }, [fetchNotifications]);

  // Handle clicks outside dropdowns
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (notificationRef.current && !notificationRef.current.contains(event.target)) {
        setShowNotifications(false);
      }
      if (profileRef.current && !profileRef.current.contains(event.target)) {
        setShowProfile(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const formatTime = (date) => {
    return date.toLocaleTimeString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: true
    });
  };

  const formatDate = (date) => {
    return date.toLocaleDateString("en-US", {
      weekday: "long",
      month: "short",
      day: "numeric"
    });
  };

  const handleLogout = () => {
    localStorage.removeItem("token");
    navigate("/");
  };

  const handleNotificationClick = (notification) => {
    setShowNotifications(false);
    navigate("/dashboard");
  };

  return (
    <header className="header">
      <div className="header-left">
        {/* Menu toggle for mobile */}
        <button 
          className="btn btn-ghost btn-icon header-menu-btn"
          onClick={onMenuToggle}
          aria-label="Toggle menu"
        >
          <svg className="icon icon-md" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="3" y1="12" x2="21" y2="12" />
            <line x1="3" y1="6" x2="21" y2="6" />
            <line x1="3" y1="18" x2="21" y2="18" />
          </svg>
        </button>

        {/* Back button (optional) */}
        {showBackButton && (
          <button 
            className="btn btn-ghost btn-icon"
            onClick={onBack}
            aria-label="Go back"
          >
            <svg className="icon icon-md" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="15,18 9,12 15,6" />
            </svg>
          </button>
        )}

        {/* Page title */}
        <div className="header-title">
          {title && <h1 className="text-xl font-semibold text-primary">{title}</h1>}
          {subtitle && <p className="text-sm text-muted">{subtitle}</p>}
        </div>
      </div>

      <div className="header-center">
        {/* Date and time display (desktop only) */}
        <div className="header-datetime">
          <span className="header-date text-sm font-medium text-secondary">
            {formatDate(currentTime)}
          </span>
          <span className="header-time text-sm font-semibold text-brand">
            {formatTime(currentTime)}
          </span>
        </div>
      </div>

      <div className="header-right">
        {/* Notifications */}
        <div className="header-dropdown" ref={notificationRef}>
          <button 
            className={`btn btn-ghost btn-icon ${notifications.length > 0 ? 'has-notifications' : ''}`}
            onClick={() => {
              setShowNotifications(!showNotifications);
              setShowProfile(false);
            }}
            aria-label={`Notifications ${notifications.length > 0 ? `(${notifications.length})` : ''}`}
          >
            <svg className="icon icon-md" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
              <path d="M13.73 21a2 2 0 0 1-3.46 0" />
            </svg>
            {notifications.length > 0 && (
              <span className="notification-badge">
                {notifications.length}
              </span>
            )}
          </button>

          {/* Notifications dropdown */}
          {showNotifications && (
            <div className="dropdown-menu notification-dropdown">
              <div className="dropdown-header">
                <h3 className="text-sm font-semibold text-primary">Notifications</h3>
                {notifications.length > 0 && (
                  <span className="badge badge-warning">
                    {notifications.length} pending
                  </span>
                )}
              </div>
              
              <div className="dropdown-body">
                {notifications.length === 0 ? (
                  <div className="empty-notifications">
                    <svg className="icon icon-xl text-muted" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                      <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                      <polyline points="22,4 12,14.01 9,11.01" />
                    </svg>
                    <p className="text-sm text-muted">All caught up!</p>
                  </div>
                ) : (
                  notifications.map((notification) => (
                    <button
                      key={notification._id}
                      className="notification-item"
                      onClick={() => handleNotificationClick(notification)}
                    >
                      <div className="notification-icon">
                        <svg className="icon icon-sm" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <circle cx="12" cy="12" r="10" />
                          <line x1="12" y1="8" x2="12" y2="12" />
                          <line x1="12" y1="16" x2="12.01" y2="16" />
                        </svg>
                      </div>
                      <div className="notification-content">
                        <p className="text-sm font-medium text-primary">
                          Take {notification.name}
                        </p>
                        <p className="text-xs text-muted">
                          {notification.dosage} • Due now
                        </p>
                      </div>
                    </button>
                  ))
                )}
              </div>

              {notifications.length > 0 && (
                <div className="dropdown-footer">
                  <button 
                    className="btn btn-ghost btn-sm"
                    onClick={() => {
                      setShowNotifications(false);
                      navigate("/dashboard");
                    }}
                  >
                    View all medications
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Profile menu */}
        <div className="header-dropdown" ref={profileRef}>
          <button 
            className="profile-avatar"
            onClick={() => {
              setShowProfile(!showProfile);
              setShowNotifications(false);
            }}
            aria-label="Profile menu"
          >
            {userAvatar === "👤" ? initials : userAvatar}
          </button>

          {/* Profile dropdown */}
          {showProfile && (
            <div className="dropdown-menu profile-dropdown">
              <div className="dropdown-header">
                <div className="profile-info">
                  <div className="profile-avatar-large">
                    {userAvatar === "👤" ? initials : userAvatar}
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-primary">{userName}</p>
                    <p className="text-xs text-muted capitalize">
                      {userRole === "admin" ? "Administrator" : "Patient"}
                    </p>
                  </div>
                </div>
              </div>

              <div className="dropdown-body">
                <button 
                  className="dropdown-item"
                  onClick={() => {
                    setShowProfile(false);
                    navigate("/profile");
                  }}
                >
                  <svg className="icon icon-sm" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                    <circle cx="12" cy="7" r="4" />
                  </svg>
                  Profile Settings
                </button>

                <button 
                  className="dropdown-item"
                  onClick={() => {
                    setShowProfile(false);
                    navigate("/caregiver/link");
                  }}
                >
                  <svg className="icon icon-sm" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                    <circle cx="8.5" cy="7" r="4" />
                    <line x1="20" y1="8" x2="20" y2="14" />
                    <line x1="23" y1="11" x2="17" y2="11" />
                  </svg>
                  Link Caregiver
                </button>

                {userRole === "admin" && (
                  <button 
                    className="dropdown-item"
                    onClick={() => {
                      setShowProfile(false);
                      navigate("/admin");
                    }}
                  >
                    <svg className="icon icon-sm" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                      <line x1="9" y1="9" x2="15" y2="15" />
                      <line x1="15" y1="9" x2="9" y2="15" />
                    </svg>
                    Admin Panel
                  </button>
                )}
              </div>

              <div className="dropdown-footer">
                <button 
                  className="btn btn-danger btn-sm w-full"
                  onClick={handleLogout}
                >
                  Sign Out
                </button>
              </div>
            </div>
          )}
        </div>
      </div>


    </header>
  );
}

export default Header;

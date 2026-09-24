import React from "react";
import { useNavigate, useLocation } from "react-router-dom";

function Sidebar({ isOpen, onClose }) {
  const navigate = useNavigate();
  const location = useLocation();
  const currentPath = location.pathname;

  // Organized navigation groups for better UX
  const navigationGroups = [
    {
      label: "Overview",
      items: [
        {
          label: "Dashboard",
          path: "/dashboard",
          icon: (
            <svg className="icon icon-md" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="3" y="3" width="7" height="9" />
              <rect x="14" y="3" width="7" height="5" />
              <rect x="14" y="12" width="7" height="9" />
              <rect x="3" y="16" width="7" height="5" />
            </svg>
          )
        }
      ]
    },
    {
      label: "Medication",
      items: [
        {
          label: "Add Medication",
          path: "/add-medicine",
          icon: (
            <svg className="icon icon-md" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="16" />
              <line x1="8" y1="12" x2="16" y2="12" />
            </svg>
          )
        },
        {
          label: "Calendar",
          path: "/calendar",
          icon: (
            <svg className="icon icon-md" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
              <line x1="16" y1="2" x2="16" y2="6" />
              <line x1="8" y1="2" x2="8" y2="6" />
              <line x1="3" y1="10" x2="21" y2="10" />
            </svg>
          )
        },
        {
          label: "History",
          path: "/history",
          icon: (
            <svg className="icon icon-md" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10" />
              <polyline points="12,6 12,12 16,14" />
            </svg>
          )
        },
        {
          label: "Refill Tracker",
          path: "/refill",
          icon: (
            <svg className="icon icon-md" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
            </svg>
          )
        }
      ]
    },
    {
      label: "Insights",
      items: [
        {
          label: "Reports",
          path: "/reports",
          icon: (
            <svg className="icon icon-md" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="20" x2="18" y2="10" />
              <line x1="12" y1="20" x2="12" y2="4" />
              <line x1="6" y1="20" x2="6" y2="14" />
            </svg>
          )
        }
      ]
    },
    {
      label: "Care",
      items: [
        {
          label: "Link Caregiver",
          path: "/caregiver/link",
          icon: (
            <svg className="icon icon-md" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
              <circle cx="8.5" cy="7" r="4" />
              <line x1="20" y1="8" x2="20" y2="14" />
              <line x1="23" y1="11" x2="17" y2="11" />
            </svg>
          )
        },
        {
          label: "Caregiver Dashboard",
          path: "/caregiver/dashboard",
          icon: (
            <svg className="icon icon-md" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
            </svg>
          )
        }
      ]
    },
    {
      label: "Account",
      items: [
        {
          label: "Profile",
          path: "/profile",
          icon: (
            <svg className="icon icon-md" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="3" />
              <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
            </svg>
          )
        }
      ]
    }
  ];

  const handleLogout = () => {
    localStorage.removeItem("token");
    navigate("/");
  };

  const handleNavigation = (path) => {
    navigate(path);
    if (onClose) onClose();
  };

  return (
    <>
      {/* Mobile backdrop */}
      {isOpen && (
        <div 
          className="sidebar-backdrop"
          onClick={onClose}
          aria-hidden="true"
        />
      )}

      <aside className={`sidebar ${isOpen ? 'sidebar-open' : ''}`}>
        {/* Brand header */}
        <div className="sidebar-header">
          <button 
            className="sidebar-brand"
            onClick={() => handleNavigation("/dashboard")}
            aria-label="Go to dashboard"
          >
            <div className="brand-icon">
              <svg className="icon icon-lg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.29 1.51 4.04 3 5.5Z" />
                <path d="M12 5L8 21l4-7 4 7-4-16" />
              </svg>
            </div>
            <span className="brand-text">MedRemind</span>
          </button>
        </div>

        {/* Navigation */}
        <nav className="sidebar-nav">
          {navigationGroups.map((group) => (
            <div key={group.label} className="nav-group">
              <div className="nav-group-label">
                {group.label}
              </div>
              <div className="nav-group-items">
                {group.items.map((item) => {
                  const isActive = currentPath === item.path;
                  return (
                    <button
                      key={item.path}
                      className={`nav-item ${isActive ? 'nav-item-active' : ''}`}
                      onClick={() => handleNavigation(item.path)}
                    >
                      <span className="nav-item-icon">
                        {item.icon}
                      </span>
                      <span className="nav-item-label">
                        {item.label}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        {/* Footer with logout */}
        <div className="sidebar-footer">
          <button className="logout-button" onClick={handleLogout}>
            <span className="nav-item-icon">
              <svg className="icon icon-md" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                <polyline points="16,17 21,12 16,7" />
                <line x1="21" y1="12" x2="9" y2="12" />
              </svg>
            </span>
            <span className="nav-item-label">Sign Out</span>
          </button>
        </div>
      </aside>
      <style jsx>{`
        .sidebar-backdrop {
          position: fixed;
          inset: 0;
          background: rgba(0, 0, 0, 0.5);
          z-index: 40;
          backdrop-filter: blur(4px);
        }

        .sidebar {
          position: fixed;
          left: 0;
          top: 0;
          width: 280px;
          height: 100vh;
          background: var(--white);
          border-right: 1px solid var(--border-light);
          display: flex;
          flex-direction: column;
          z-index: 50;
          transform: translateX(-100%);
          transition: transform var(--duration-slow) var(--ease);
          box-shadow: var(--shadow-lg);
        }

        .sidebar-open {
          transform: translateX(0);
        }

        /* Desktop: Always visible */
        @media (min-width: 768px) {
          .sidebar {
            position: fixed;
            transform: translateX(0);
            box-shadow: none;
            border-right: 1px solid var(--border-light);
          }

          .sidebar-backdrop {
            display: none;
          }
        }

        /* Header */
        .sidebar-header {
          padding: var(--space-6);
          border-bottom: 1px solid var(--border-light);
          background: var(--bg-subtle);
        }

        .sidebar-brand {
          display: flex;
          align-items: center;
          gap: var(--space-3);
          padding: 0;
          background: transparent;
          border: none;
          cursor: pointer;
          transition: all var(--duration-normal) var(--ease);
          border-radius: var(--radius-md);
        }

        .sidebar-brand:hover {
          background: var(--primary-light);
        }

        .brand-icon {
          width: 40px;
          height: 40px;
          border-radius: var(--radius-md);
          background: linear-gradient(135deg, var(--primary), var(--teal-500));
          display: flex;
          align-items: center;
          justify-content: center;
          color: var(--white);
          box-shadow: var(--shadow-md);
        }

        .brand-text {
          font-size: 18px;
          font-weight: 700;
          color: var(--text-primary);
          letter-spacing: -0.025em;
        }

        /* Navigation */
        .sidebar-nav {
          flex: 1;
          padding: var(--space-4);
          overflow-y: auto;
          display: flex;
          flex-direction: column;
          gap: var(--space-6);
        }

        .nav-group-label {
          font-size: 12px;
          font-weight: 600;
          color: var(--text-muted);
          text-transform: uppercase;
          letter-spacing: 0.05em;
          margin-bottom: var(--space-2);
          padding: 0 var(--space-3);
        }

        .nav-group-items {
          display: flex;
          flex-direction: column;
          gap: var(--space-1);
        }

        .nav-item {
          display: flex;
          align-items: center;
          gap: var(--space-3);
          padding: var(--space-3);
          background: transparent;
          border: none;
          border-radius: var(--radius-md);
          color: var(--text-secondary);
          font-size: 14px;
          font-weight: 500;
          cursor: pointer;
          transition: all var(--duration-fast) var(--ease);
          text-align: left;
          width: 100%;
        }

        .nav-item:hover {
          background: var(--bg-subtle);
          color: var(--text-primary);
        }

        .nav-item-active {
          background: var(--primary);
          color: var(--white);
          font-weight: 600;
        }

        .nav-item-active:hover {
          background: var(--primary-hover);
          color: var(--white);
        }

        .nav-item-icon {
          display: flex;
          align-items: center;
          flex-shrink: 0;
        }

        .nav-item-label {
          flex: 1;
          min-width: 0;
        }

        /* Footer */
        .sidebar-footer {
          padding: var(--space-4);
          border-top: 1px solid var(--border-light);
          background: var(--bg-subtle);
        }

        .logout-button {
          display: flex;
          align-items: center;
          gap: var(--space-3);
          padding: var(--space-3);
          background: transparent;
          border: none;
          border-radius: var(--radius-md);
          color: var(--danger);
          font-size: 14px;
          font-weight: 500;
          cursor: pointer;
          transition: all var(--duration-fast) var(--ease);
          text-align: left;
          width: 100%;
        }

        .logout-button:hover {
          background: var(--danger-light);
          color: var(--danger-hover);
        }

        /* Scrollbar styling */
        .sidebar-nav::-webkit-scrollbar {
          width: 6px;
        }

        .sidebar-nav::-webkit-scrollbar-track {
          background: transparent;
        }

        .sidebar-nav::-webkit-scrollbar-thumb {
          background: var(--border-muted);
          border-radius: var(--radius-full);
        }

        .sidebar-nav::-webkit-scrollbar-thumb:hover {
          background: var(--border);
        }
      `}</style>
    </>
  );
}

export default Sidebar;

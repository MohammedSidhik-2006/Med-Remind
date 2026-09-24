import React, { useState, useEffect } from "react";
import Sidebar from "./Sidebar";
import Header from "./Header";

/**
 * AppShell - Modern application layout container
 * Provides consistent layout structure across all authenticated pages
 */
function AppShell({ children, title, subtitle, showBackButton, onBack }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkScreenSize = () => {
      setIsMobile(window.innerWidth < 768);
    };

    checkScreenSize();
    window.addEventListener('resize', checkScreenSize);
    return () => window.removeEventListener('resize', checkScreenSize);
  }, []);

  // Close sidebar when clicking outside on mobile
  const handleOverlayClick = () => {
    if (isMobile && sidebarOpen) {
      setSidebarOpen(false);
    }
  };

  return (
    <div className="app-shell">
      {/* Sidebar */}
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      
      {/* Mobile overlay */}
      {sidebarOpen && isMobile && (
        <div 
          className="app-shell-overlay"
          onClick={handleOverlayClick}
          aria-hidden="true"
        />
      )}

      {/* Main content area */}
      <div className="app-shell-content">
        {/* Header */}
        <Header 
          onMenuToggle={() => setSidebarOpen(!sidebarOpen)}
          title={title}
          subtitle={subtitle}
          showBackButton={showBackButton}
          onBack={onBack}
        />

        {/* Page content */}
        <main className="app-shell-main">
          {children}
        </main>
      </div>

      <style jsx>{`
        .app-shell {
          display: flex;
          min-height: 100vh;
          background: var(--bg-page);
        }

        .app-shell-overlay {
          position: fixed;
          inset: 0;
          background: rgba(0, 0, 0, 0.5);
          z-index: 40;
          backdrop-filter: blur(2px);
        }

        .app-shell-content {
          flex: 1;
          display: flex;
          flex-direction: column;
          min-width: 0;
          transition: margin-left var(--duration-slow) var(--ease);
        }

        .app-shell-main {
          flex: 1;
          overflow-x: hidden;
        }

        /* Desktop sidebar spacing */
        @media (min-width: 768px) {
          .app-shell-content {
            margin-left: 280px;
          }
        }
      `}</style>
    </div>
  );
}

export default AppShell;
import React, { useState, useEffect } from "react";
import Sidebar from "./Sidebar";
import Header from "./Header";

/**
 * AppShell - Modern application layout container
 * Provides consistent layout structure across all authenticated pages
 */
function AppShell({ children, title, subtitle, showBackButton, onBack, notificationRefreshTrigger }) {
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
          refreshTrigger={notificationRefreshTrigger}
        />

        {/* Page content */}
        <main className="app-shell-main">
          {children}
        </main>
      </div>

    </div>
  );
}

export default AppShell;
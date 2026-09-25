import React from "react";

/**
 * LoadingSpinner - Professional loading component with healthcare branding
 */
function LoadingSpinner({ size = "md", message = "Loading..." }) {
  const sizeClasses = {
    sm: "loading-spinner-sm",
    md: "loading-spinner-md", 
    lg: "loading-spinner-lg"
  };

  return (
    <div className="loading-container">
      <div className="loading-content">
        {/* Medical cross spinner */}
        <div className={`loading-spinner ${sizeClasses[size]}`}>
          <div className="spinner-cross">
            <div className="cross-horizontal"></div>
            <div className="cross-vertical"></div>
          </div>
        </div>
        
        {/* Loading message */}
        <p className="loading-message">{message}</p>
        
        {/* Brand name */}
        <div className="loading-brand">
          <span className="brand-name">MedRemind</span>
        </div>
      </div>

    </div>
  );
}

export default LoadingSpinner;

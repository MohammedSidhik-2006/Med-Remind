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

      <style jsx>{`
        .loading-container {
          position: fixed;
          inset: 0;
          background: var(--bg-page);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 9999;
        }

        .loading-content {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: var(--space-6);
          text-align: center;
        }

        .loading-spinner {
          position: relative;
          border-radius: var(--radius-full);
          background: linear-gradient(135deg, var(--primary-light), var(--primary-soft));
          border: 3px solid var(--primary-light);
          display: flex;
          align-items: center;
          justify-content: center;
          animation: spin 2s linear infinite, pulse 2s ease-in-out infinite;
          box-shadow: 0 4px 20px rgba(13, 148, 136, 0.2);
        }

        .loading-spinner-sm {
          width: 32px;
          height: 32px;
        }

        .loading-spinner-md {
          width: 48px;
          height: 48px;
        }

        .loading-spinner-lg {
          width: 64px;
          height: 64px;
        }

        .spinner-cross {
          position: relative;
          width: 50%;
          height: 50%;
        }

        .cross-horizontal,
        .cross-vertical {
          position: absolute;
          background: var(--primary);
          border-radius: 1px;
          animation: crossPulse 1.5s ease-in-out infinite;
        }

        .cross-horizontal {
          width: 100%;
          height: 2px;
          top: 50%;
          left: 0;
          transform: translateY(-50%);
        }

        .cross-vertical {
          width: 2px;
          height: 100%;
          left: 50%;
          top: 0;
          transform: translateX(-50%);
        }

        .loading-message {
          margin: 0;
          font-size: 16px;
          font-weight: 500;
          color: var(--text-secondary);
          letter-spacing: -0.025em;
        }

        .loading-brand {
          display: flex;
          align-items: center;
          gap: var(--space-2);
        }

        .brand-name {
          font-size: 14px;
          font-weight: 600;
          color: var(--text-muted);
          letter-spacing: 0.05em;
        }

        @keyframes spin {
          from {
            transform: rotate(0deg);
          }
          to {
            transform: rotate(360deg);
          }
        }

        @keyframes pulse {
          0%, 100% {
            transform: scale(1);
            box-shadow: 0 4px 20px rgba(13, 148, 136, 0.2);
          }
          50% {
            transform: scale(1.05);
            box-shadow: 0 6px 24px rgba(13, 148, 136, 0.3);
          }
        }

        @keyframes crossPulse {
          0%, 100% {
            opacity: 1;
            transform: scale(1);
          }
          50% {
            opacity: 0.7;
            transform: scale(0.8);
          }
        }

        /* Reduce motion for accessibility */
        @media (prefers-reduced-motion: reduce) {
          .loading-spinner {
            animation: none;
          }
          
          .cross-horizontal,
          .cross-vertical {
            animation: none;
          }
        }
      `}</style>
    </div>
  );
}

export default LoadingSpinner;
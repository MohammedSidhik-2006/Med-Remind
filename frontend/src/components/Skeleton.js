import React from "react";

/**
 * Modern skeleton loading components using the design system
 */

// Base skeleton component
export function Skeleton({ className = "", width, height, rounded = false }) {
  const style = {};
  if (width) style.width = width;
  if (height) style.height = height;

  return (
    <div 
      className={`skeleton ${rounded ? 'skeleton-rounded' : ''} ${className}`}
      style={style}
    >
      <style jsx>{`
        .skeleton {
          background: linear-gradient(
            90deg,
            var(--bg-muted) 25%,
            var(--bg-subtle) 50%,
            var(--bg-muted) 75%
          );
          background-size: 200% 100%;
          animation: shimmer 1.5s ease-in-out infinite;
          border-radius: var(--radius-sm);
        }

        .skeleton-rounded {
          border-radius: var(--radius-full);
        }

        @keyframes shimmer {
          0% {
            background-position: 200% 0;
          }
          100% {
            background-position: -200% 0;
          }
        }

        @media (prefers-reduced-motion: reduce) {
          .skeleton {
            animation: none;
            background: var(--bg-muted);
          }
        }
      `}</style>
    </div>
  );
}

// Text skeleton
export function SkeletonText({ lines = 1, className = "" }) {
  return (
    <div className={`skeleton-text ${className}`}>
      {Array.from({ length: lines }, (_, i) => (
        <Skeleton 
          key={i} 
          height="20px" 
          width={i === lines - 1 ? "75%" : "100%"}
          className="skeleton-text-line"
        />
      ))}
      
      <style jsx>{`
        .skeleton-text {
          display: flex;
          flex-direction: column;
          gap: var(--space-2);
        }

        .skeleton-text :global(.skeleton-text-line) {
          height: 16px;
        }
      `}</style>
    </div>
  );
}

// Avatar skeleton
export function SkeletonAvatar({ size = "md" }) {
  const sizes = {
    sm: "32px",
    md: "40px", 
    lg: "48px",
    xl: "64px"
  };

  return (
    <Skeleton 
      width={sizes[size]} 
      height={sizes[size]} 
      rounded={true}
      className="skeleton-avatar"
    />
  );
}

// Card skeleton
export function SkeletonCard({ showAvatar = false, lines = 3 }) {
  return (
    <div className="skeleton-card">
      <div className="skeleton-card-header">
        {showAvatar && <SkeletonAvatar />}
        <div className="skeleton-card-title">
          <Skeleton height="20px" width="60%" />
          <Skeleton height="16px" width="40%" />
        </div>
      </div>
      
      <div className="skeleton-card-content">
        <SkeletonText lines={lines} />
      </div>

      <style jsx>{`
        .skeleton-card {
          padding: var(--space-6);
          background: var(--bg-card);
          border: 1px solid var(--border-light);
          border-radius: var(--radius-lg);
          box-shadow: var(--shadow-sm);
        }

        .skeleton-card-header {
          display: flex;
          align-items: center;
          gap: var(--space-3);
          margin-bottom: var(--space-4);
        }

        .skeleton-card-title {
          flex: 1;
          display: flex;
          flex-direction: column;
          gap: var(--space-2);
        }

        .skeleton-card-content {
          margin-top: var(--space-4);
        }
      `}</style>
    </div>
  );
}

// Medicine card skeleton
export function SkeletonMedicineCard() {
  return (
    <div className="skeleton-medicine-card">
      <div className="skeleton-medicine-icon">
        <Skeleton width="40px" height="40px" rounded />
      </div>
      
      <div className="skeleton-medicine-info">
        <Skeleton height="18px" width="60%" />
        <Skeleton height="14px" width="80%" />
        <Skeleton height="12px" width="40%" />
      </div>
      
      <div className="skeleton-medicine-actions">
        <Skeleton height="32px" width="80px" />
        <Skeleton height="32px" width="60px" />
      </div>

      <style jsx>{`
        .skeleton-medicine-card {
          display: flex;
          align-items: center;
          gap: var(--space-4);
          padding: var(--space-4);
          background: var(--bg-card);
          border: 1px solid var(--border-light);
          border-radius: var(--radius-md);
          box-shadow: var(--shadow-sm);
        }

        .skeleton-medicine-info {
          flex: 1;
          display: flex;
          flex-direction: column;
          gap: var(--space-2);
        }

        .skeleton-medicine-actions {
          display: flex;
          gap: var(--space-2);
        }
      `}</style>
    </div>
  );
}

// Dashboard skeleton
export function SkeletonDashboard() {
  return (
    <div className="skeleton-dashboard">
      {/* Header */}
      <div className="skeleton-dashboard-header">
        <div className="skeleton-dashboard-title">
          <Skeleton height="32px" width="300px" />
          <Skeleton height="16px" width="200px" />
        </div>
      </div>

      {/* Stats grid */}
      <div className="skeleton-stats-grid">
        {[1, 2, 3, 4].map(i => (
          <div key={i} className="skeleton-stat-card">
            <Skeleton height="24px" width="60px" />
            <Skeleton height="14px" width="80px" />
          </div>
        ))}
      </div>

      {/* Medicine list */}
      <div className="skeleton-medicine-list">
        <Skeleton height="24px" width="200px" className="skeleton-section-title" />
        {[1, 2, 3].map(i => (
          <SkeletonMedicineCard key={i} />
        ))}
      </div>

      <style jsx>{`
        .skeleton-dashboard {
          max-width: 1200px;
          margin: 0 auto;
          padding: var(--space-8) var(--space-6);
          display: flex;
          flex-direction: column;
          gap: var(--space-8);
        }

        .skeleton-dashboard-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
        }

        .skeleton-dashboard-title {
          display: flex;
          flex-direction: column;
          gap: var(--space-2);
        }

        .skeleton-stats-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
          gap: var(--space-4);
        }

        .skeleton-stat-card {
          padding: var(--space-5);
          background: var(--bg-card);
          border: 1px solid var(--border-light);
          border-radius: var(--radius-lg);
          display: flex;
          flex-direction: column;
          gap: var(--space-2);
        }

        .skeleton-medicine-list {
          display: flex;
          flex-direction: column;
          gap: var(--space-4);
        }

        .skeleton-medicine-list :global(.skeleton-section-title) {
          margin-bottom: var(--space-2);
        }
      `}</style>
    </div>
  );
}

// List skeleton for tables/lists
export function SkeletonList({ rows = 5, showHeader = true }) {
  return (
    <div className="skeleton-list">
      {showHeader && (
        <div className="skeleton-list-header">
          <Skeleton height="16px" width="20%" />
          <Skeleton height="16px" width="25%" />
          <Skeleton height="16px" width="15%" />
          <Skeleton height="16px" width="20%" />
        </div>
      )}
      
      <div className="skeleton-list-body">
        {Array.from({ length: rows }, (_, i) => (
          <div key={i} className="skeleton-list-row">
            <Skeleton height="18px" width="20%" />
            <Skeleton height="18px" width="25%" />
            <Skeleton height="18px" width="15%" />
            <Skeleton height="18px" width="20%" />
          </div>
        ))}
      </div>

      <style jsx>{`
        .skeleton-list {
          background: var(--bg-card);
          border: 1px solid var(--border-light);
          border-radius: var(--radius-lg);
          overflow: hidden;
        }

        .skeleton-list-header,
        .skeleton-list-row {
          display: grid;
          grid-template-columns: 1fr 1.5fr 1fr 1.2fr;
          gap: var(--space-4);
          padding: var(--space-4);
          align-items: center;
        }

        .skeleton-list-header {
          background: var(--bg-subtle);
          border-bottom: 1px solid var(--border-light);
        }

        .skeleton-list-row {
          border-bottom: 1px solid var(--border-light);
        }

        .skeleton-list-row:last-child {
          border-bottom: none;
        }
      `}</style>
    </div>
  );
}

export default Skeleton;
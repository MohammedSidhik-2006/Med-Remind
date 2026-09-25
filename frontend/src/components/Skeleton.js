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
    </div>
  );
}

export default Skeleton;
import React from "react";

export function Skeleton({ width = "100%", height = "20px", borderRadius = "8px", style = {} }) {
  return (
    <div
      className="skeleton-loader"
      style={{
        width,
        height,
        borderRadius,
        background: "linear-gradient(90deg, #e2e8f0 25%, #f1f5f9 50%, #e2e8f0 75%)",
        backgroundSize: "200% 100%",
        animation: "skeleton-shimmer 1.5s infinite",
        ...style
      }}
    />
  );
}

export function SkeletonCard() {
  return (
    <div
      style={{
        background: "rgba(255, 255, 255, 0.85)",
        backdropFilter: "blur(12px)",
        borderRadius: "var(--radius-lg)",
        padding: "24px",
        border: "1px solid var(--border-light)",
        marginBottom: "16px"
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: "16px", marginBottom: "12px" }}>
        <Skeleton width="48px" height="48px" borderRadius="12px" />
        <div style={{ flex: 1 }}>
          <Skeleton width="40%" height="20px" style={{ marginBottom: "8px" }} />
          <Skeleton width="60%" height="14px" />
        </div>
      </div>
      <Skeleton width="100%" height="16px" />
    </div>
  );
}

export function SkeletonTable({ rows = 4 }) {
  return (
    <div
      style={{
        background: "white",
        borderRadius: "var(--radius-lg)",
        padding: "20px",
        border: "1px solid var(--border-light)"
      }}
    >
      <Skeleton width="30%" height="24px" style={{ marginBottom: "20px" }} />
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} style={{ display: "flex", gap: "16px", marginBottom: "16px" }}>
          <Skeleton width="20%" height="18px" />
          <Skeleton width="40%" height="18px" />
          <Skeleton width="25%" height="18px" />
          <Skeleton width="15%" height="18px" />
        </div>
      ))}
    </div>
  );
}

export default Skeleton;

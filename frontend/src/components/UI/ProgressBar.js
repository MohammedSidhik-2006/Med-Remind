import React, { useState } from "react";
import "./ProgressBar.css";

/**
 * Modern ProgressBar component for adherence and completion tracking
 * Supports smooth animation, interactive tooltip on hover/focus, and visual status indicators
 */
function ProgressBar({
  value = 0,
  max = 100,
  size = "md",
  variant = "primary",
  showLabel = false,
  label,
  animated = false,
  className = "",
  interactive = true,
  ...props
}) {
  const [isHovered, setIsHovered] = useState(false);
  const percentage = Math.min(Math.max((value / max) * 100, 0), 100);
  const rounded = Math.round(percentage);

  const sizeClasses = {
    sm: "progress-sm",
    md: "progress",
    lg: "progress-lg"
  };

  const variantClasses = {
    primary: "progress-bar progress-bar-primary",
    success: "progress-bar progress-bar-success", 
    warning: "progress-bar progress-bar-warning",
    danger: "progress-bar progress-bar-danger"
  };

  const getAdherenceVariant = () => {
    if (percentage >= 90) return "success";
    if (percentage >= 70) return "warning"; 
    return "danger";
  };

  const finalVariant = variant === "adherence" ? getAdherenceVariant() : variant;

  const containerClasses = [
    sizeClasses[size],
    animated ? "progress-animated" : "",
    interactive ? "progress-interactive" : "",
    className
  ].filter(Boolean).join(" ");

  const barClasses = [
    variantClasses[finalVariant] || "progress-bar",
    animated ? "progress-bar-animated" : ""
  ].filter(Boolean).join(" ");

  return (
    <div 
      className="progress-container"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onFocus={() => setIsHovered(true)}
      onBlur={() => setIsHovered(false)}
      tabIndex={interactive ? 0 : undefined}
      role="progressbar"
      aria-valuenow={rounded}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={label || `${rounded}% complete`}
      {...props}
    >
      {(showLabel || label) && (
        <div className="progress-header">
          <span className="progress-label">
            {label || `${rounded}%`}
          </span>
          {showLabel && (
            <span className="progress-value">
              {rounded}%
            </span>
          )}
        </div>
      )}
      
      <div className={containerClasses} style={{ position: "relative" }}>
        <div 
          className={barClasses}
          style={{ width: `${percentage}%` }}
        />
        {interactive && isHovered && (
          <div className="progress-tooltip" role="tooltip">
            <span className="progress-tooltip-pct">{rounded}%</span>
            <span className="progress-tooltip-label">
              {percentage === 100 ? "• All Doses Done!" : percentage >= 70 ? "• On Track" : "• Doses Pending"}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

// Specialized adherence progress component with interactive status & grade
ProgressBar.Adherence = function AdherenceProgress({
  value,
  max = 100,
  showGrade = true,
  label,
  ...props
}) {
  const percentage = Math.min(Math.max((value / max) * 100, 0), 100);
  
  const getGrade = () => {
    if (percentage >= 95) return { label: "Excellent", class: "adherence-excellent", icon: "✨" };
    if (percentage >= 85) return { label: "Good", class: "adherence-good", icon: "👍" };
    if (percentage >= 70) return { label: "Fair", class: "adherence-fair", icon: "⏱️" };
    return { label: "Needs Improvement", class: "adherence-poor", icon: "⚠️" };
  };

  const grade = getGrade();

  return (
    <div className="adherence-progress">
      <ProgressBar
        value={value}
        max={max}
        variant="adherence"
        animated
        interactive
        showLabel
        label={label}
        {...props}
      />
      {showGrade && (
        <div className="adherence-grade">
          <span className={`adherence-grade-text ${grade.class}`}>
            <span aria-hidden="true" style={{ marginRight: 4 }}>{grade.icon}</span>
            {grade.label}
          </span>
        </div>
      )}
    </div>
  );
};

// Modern, ultra-smooth SVG Circular Progress Ring component
ProgressBar.Ring = function CircularProgressRing({
  value = 0,
  max = 100,
  taken,
  total,
  size = 144,
  strokeWidth = 11,
  showGrade = true,
  className = ""
}) {
  const percentage = Math.min(Math.max((value / max) * 100, 0), 100);
  const rounded = Math.round(percentage);
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (percentage / 100) * circumference;

  const getColor = () => {
    if (total === 0) return "var(--text-muted, #94a3b8)";
    if (percentage >= 90) return "#059669";
    if (percentage >= 70) return "#0d9488";
    if (percentage >= 40) return "#d97706";
    return "#e11d48";
  };

  const getGradientId = () => {
    if (total === 0) return "ringGradNeutral";
    if (percentage >= 90) return "ringGradSuccess";
    if (percentage >= 70) return "ringGradTeal";
    if (percentage >= 40) return "ringGradWarning";
    return "ringGradDanger";
  };

  const getGrade = () => {
    if (total === 0) return { label: "No Doses Scheduled", class: "adherence-neutral", icon: "💊" };
    if (percentage >= 95) return { label: "Excellent Adherence", class: "adherence-excellent", icon: "✨" };
    if (percentage >= 85) return { label: "Great Consistency", class: "adherence-good", icon: "👍" };
    if (percentage >= 70) return { label: "Fair Routine", class: "adherence-fair", icon: "⏱️" };
    return { label: "Doses Pending", class: "adherence-poor", icon: "⏳" };
  };

  const color = getColor();
  const grade = getGrade();

  return (
    <div className={`progress-ring-container ${className}`}>
      <div className="progress-ring-circle-box" style={{ width: size, height: size }}>
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="progress-ring-svg">
          <defs>
            <linearGradient id="ringGradSuccess" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#10b981" />
              <stop offset="100%" stopColor="#059669" />
            </linearGradient>
            <linearGradient id="ringGradTeal" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#14b8a6" />
              <stop offset="100%" stopColor="#0d9488" />
            </linearGradient>
            <linearGradient id="ringGradWarning" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#fbbf24" />
              <stop offset="100%" stopColor="#d97706" />
            </linearGradient>
            <linearGradient id="ringGradDanger" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#f43f5e" />
              <stop offset="100%" stopColor="#e11d48" />
            </linearGradient>
            <linearGradient id="ringGradNeutral" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#e2e8f0" />
              <stop offset="100%" stopColor="#cbd5e1" />
            </linearGradient>
            <filter id="ringGlow" x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="2.5" result="blur" />
              <feComposite in="SourceGraphic" in2="blur" operator="over" />
            </filter>
          </defs>

          {/* Background track circle */}
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            stroke="#f1f5f9"
            strokeWidth={strokeWidth}
            fill="none"
          />

          {/* Animated active progress circle */}
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            stroke={`url(#${getGradientId()})`}
            strokeWidth={strokeWidth}
            fill="none"
            strokeDasharray={circumference}
            strokeDashoffset={total === 0 ? circumference : strokeDashoffset}
            strokeLinecap="round"
            className="progress-ring-animated-circle"
            filter="url(#ringGlow)"
            transform={`rotate(-90 ${size / 2} ${size / 2})`}
          />
        </svg>

        {/* Center content */}
        <div className="progress-ring-center-text">
          <span className="progress-ring-pct" style={{ color }}>
            {total === 0 ? "0%" : `${rounded}%`}
          </span>
          {typeof taken === "number" && typeof total === "number" && (
            <span className="progress-ring-doses">
              {taken} / {total} Doses
            </span>
          )}
        </div>
      </div>

      {showGrade && (
        <div className="progress-ring-meta">
          <div className={`progress-ring-grade-pill ${grade.class}`}>
            <span style={{ marginRight: 6 }}>{grade.icon}</span>
            <span>{grade.label}</span>
          </div>
        </div>
      )}
    </div>
  );
};

export default ProgressBar;

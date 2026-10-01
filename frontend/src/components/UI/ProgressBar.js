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

export default ProgressBar;

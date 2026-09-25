import React from "react";
import "./ProgressBar.css";

/**
 * Modern ProgressBar component for adherence and completion tracking
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
  ...props
}) {
  const percentage = Math.min(Math.max((value / max) * 100, 0), 100);
  
  const sizeClasses = {
    sm: "progress-sm",
    md: "progress",
    lg: "progress-lg"
  };

  const variantClasses = {
    primary: "progress-bar",
    success: "progress-bar-success", 
    warning: "progress-bar-warning",
    danger: "progress-bar-danger"
  };

  // Auto-select variant based on percentage for adherence
  const getAdherenceVariant = () => {
    if (percentage >= 90) return "success";
    if (percentage >= 70) return "warning"; 
    return "danger";
  };

  const finalVariant = variant === "adherence" ? getAdherenceVariant() : variant;

  const containerClasses = [
    sizeClasses[size],
    className
  ].filter(Boolean).join(" ");

  const barClasses = [
    variantClasses[finalVariant],
    animated ? "progress-animated" : ""
  ].filter(Boolean).join(" ");

  return (
    <div className="progress-container" {...props}>
      {(showLabel || label) && (
        <div className="progress-header">
          <span className="progress-label">
            {label || `${Math.round(percentage)}%`}
          </span>
          {showLabel && (
            <span className="progress-value">
              {Math.round(percentage)}%
            </span>
          )}
        </div>
      )}
      
      <div className={containerClasses}>
        <div 
          className={barClasses}
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
}

// Specialized adherence progress component
ProgressBar.Adherence = function AdherenceProgress({
  value,
  max = 100,
  showGrade = true,
  ...props
}) {
  const percentage = Math.min(Math.max((value / max) * 100, 0), 100);
  
  const getGrade = () => {
    if (percentage >= 95) return { label: "Excellent", class: "adherence-excellent" };
    if (percentage >= 85) return { label: "Good", class: "adherence-good" };
    if (percentage >= 70) return { label: "Fair", class: "adherence-fair" };
    return { label: "Needs Improvement", class: "adherence-poor" };
  };

  const grade = getGrade();

  return (
    <div className="adherence-progress">
      <ProgressBar
        value={value}
        max={max}
        variant="adherence"
        animated
        showLabel
        {...props}
      />
      {showGrade && (
        <div className="adherence-grade">
          <span className={`adherence-grade-text ${grade.class}`}>
            {grade.label}
          </span>
        </div>
      )}
    </div>
  );
};

export default ProgressBar;

import React from "react";

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

      <style jsx>{`
        .progress-container {
          display: flex;
          flex-direction: column;
          gap: var(--space-2);
        }

        .progress-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
        }

        .progress-label {
          font-size: 14px;
          font-weight: 600;
          color: var(--text-primary);
        }

        .progress-value {
          font-size: 14px;
          font-weight: 700;
          color: var(--text-muted);
          font-variant-numeric: tabular-nums;
        }

        .progress-sm {
          height: 4px;
        }

        .progress-lg {
          height: 12px;
        }

        .progress-animated .progress-bar,
        .progress-animated .progress-bar-success,
        .progress-animated .progress-bar-warning,
        .progress-animated .progress-bar-danger {
          position: relative;
          overflow: hidden;
        }

        .progress-animated .progress-bar::after,
        .progress-animated .progress-bar-success::after,
        .progress-animated .progress-bar-warning::after,
        .progress-animated .progress-bar-danger::after {
          content: "";
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: linear-gradient(
            90deg,
            transparent 0%,
            rgba(255, 255, 255, 0.3) 50%,
            transparent 100%
          );
          animation: shimmer 2s infinite;
        }

        @keyframes shimmer {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(100%); }
        }

        /* Adherence-specific styling */
        .adherence-excellent {
          color: var(--success);
        }

        .adherence-good {
          color: var(--primary);
        }

        .adherence-fair {
          color: var(--warning);
        }

        .adherence-poor {
          color: var(--danger);
        }
      `}</style>
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

      <style jsx>{`
        .adherence-progress {
          display: flex;
          flex-direction: column;
          gap: var(--space-2);
        }

        .adherence-grade {
          display: flex;
          justify-content: flex-end;
        }

        .adherence-grade-text {
          font-size: 12px;
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 0.05em;
        }
      `}</style>
    </div>
  );
};

export default ProgressBar;
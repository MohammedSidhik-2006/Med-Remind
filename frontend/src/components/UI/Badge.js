import React from "react";

/**
 * Modern Badge component for status indicators
 */
function Badge({
  children,
  variant = "neutral",
  size = "md",
  rounded = true,
  className = "",
  ...props
}) {
  const variantClasses = {
    neutral: "badge-neutral",
    success: "badge-success",
    warning: "badge-warning", 
    danger: "badge-danger",
    info: "badge-info"
  };

  const sizeClasses = {
    sm: "badge-sm",
    md: "badge",
    lg: "badge-lg"
  };

  const classes = [
    sizeClasses[size],
    variantClasses[variant],
    rounded ? "badge-rounded" : "",
    className
  ].filter(Boolean).join(" ");

  return (
    <span className={classes} {...props}>
      {children}
      
      <style jsx>{`
        .badge-sm {
          font-size: 10px;
          padding: var(--space-1) var(--space-2);
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          display: inline-flex;
          align-items: center;
        }

        .badge-lg {
          font-size: 14px;
          padding: var(--space-2) var(--space-4);
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 0.025em;
          display: inline-flex;
          align-items: center;
        }

        .badge-rounded {
          border-radius: var(--radius-full);
        }

        /* Medical status badges */
        .badge-taken {
          background: var(--success-light);
          color: var(--success);
          border: 1px solid var(--success-soft);
        }

        .badge-pending {
          background: var(--warning-light);
          color: var(--warning);
          border: 1px solid var(--warning-soft);
        }

        .badge-missed {
          background: var(--danger-light);
          color: var(--danger);
          border: 1px solid var(--danger-soft);
        }

        .badge-scheduled {
          background: var(--info-light);
          color: var(--info);
          border: 1px solid var(--info-soft);
        }
      `}</style>
    </span>
  );
}

// Status-specific badge shortcuts
Badge.Success = (props) => <Badge variant="success" {...props} />;
Badge.Warning = (props) => <Badge variant="warning" {...props} />;
Badge.Danger = (props) => <Badge variant="danger" {...props} />;
Badge.Info = (props) => <Badge variant="info" {...props} />;

// Medical status badges
Badge.Taken = (props) => (
  <Badge className="badge-taken" {...props}>
    <svg className="icon icon-sm mr-1" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <polyline points="20,6 9,17 4,12" />
    </svg>
    {props.children || "Taken"}
  </Badge>
);

Badge.Pending = (props) => (
  <Badge className="badge-pending" {...props}>
    <svg className="icon icon-sm mr-1" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="12" cy="12" r="10" />
      <polyline points="12,6 12,12 16,14" />
    </svg>
    {props.children || "Pending"}
  </Badge>
);

Badge.Missed = (props) => (
  <Badge className="badge-missed" {...props}>
    <svg className="icon icon-sm mr-1" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="12" cy="12" r="10" />
      <line x1="15" y1="9" x2="9" y2="15" />
      <line x1="9" y1="9" x2="15" y2="15" />
    </svg>
    {props.children || "Missed"}
  </Badge>
);

export default Badge;
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
    </span>
  );
}

// Status-specific badge shortcuts
Badge.Success = (props) => <Badge variant="success" {...props} />;
Badge.Warning = (props) => <Badge variant="warning" {...props} />;
Badge.Danger  = (props) => <Badge variant="danger"  {...props} />;
Badge.Info    = (props) => <Badge variant="info"    {...props} />;

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
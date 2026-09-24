import React from "react";

/**
 * Modern Button component with consistent styling and behavior
 */
function Button({
  children,
  variant = "primary",
  size = "md", 
  icon,
  iconPosition = "left",
  loading = false,
  disabled = false,
  fullWidth = false,
  className = "",
  onClick,
  type = "button",
  ...props
}) {
  const baseClasses = "btn";
  const variantClasses = {
    primary: "btn-primary",
    secondary: "btn-secondary", 
    success: "btn-success",
    danger: "btn-danger",
    ghost: "btn-ghost"
  };
  
  const sizeClasses = {
    sm: "btn-sm",
    md: "",
    lg: "btn-lg"
  };

  const classes = [
    baseClasses,
    variantClasses[variant],
    sizeClasses[size],
    fullWidth ? "w-full" : "",
    className
  ].filter(Boolean).join(" ");

  const handleClick = (e) => {
    if (!loading && !disabled && onClick) {
      onClick(e);
    }
  };

  const LoadingSpinner = () => (
    <svg 
      className="icon icon-sm animate-spin" 
      viewBox="0 0 24 24" 
      fill="none" 
      stroke="currentColor" 
      strokeWidth="2"
    >
      <circle cx="12" cy="12" r="10" opacity="0.3" />
      <path d="M12 2a10 10 0 0 1 10 10" strokeLinecap="round" />
    </svg>
  );

  return (
    <button
      type={type}
      className={classes}
      onClick={handleClick}
      disabled={disabled || loading}
      {...props}
    >
      {loading && iconPosition === "left" && <LoadingSpinner />}
      {icon && iconPosition === "left" && !loading && icon}
      
      {children && <span>{children}</span>}
      
      {icon && iconPosition === "right" && !loading && icon}
      {loading && iconPosition === "right" && <LoadingSpinner />}

      <style jsx>{`
        .w-full {
          width: 100%;
        }

        .animate-spin {
          animation: spin 1s linear infinite;
        }

        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </button>
  );
}

export default Button;
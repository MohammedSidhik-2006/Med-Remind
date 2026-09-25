import React, { forwardRef } from "react";

/**
 * Modern Input component with consistent styling
 */
const Input = forwardRef(({
  type = "text",
  label,
  error,
  helperText,
  icon,
  iconPosition = "left",
  size = "md",
  fullWidth = true,
  className = "",
  containerClassName = "",
  ...props
}, ref) => {
  const sizeClasses = {
    sm: "form-input-sm",
    md: "form-input",
    lg: "form-input-lg"
  };

  const inputClasses = [
    sizeClasses[size],
    icon && iconPosition === "left" ? "pl-10" : "",
    icon && iconPosition === "right" ? "pr-10" : "",
    error ? "input-error" : "",
    fullWidth ? "w-full" : "",
    className
  ].filter(Boolean).join(" ");

  const containerClasses = [
    "form-group",
    containerClassName
  ].filter(Boolean).join(" ");

  return (
    <div className={containerClasses}>
      {label && (
        <label className="form-label">
          {label}
        </label>
      )}
      
      <div className="input-container">
        {icon && iconPosition === "left" && (
          <div className="input-icon input-icon-left">
            {icon}
          </div>
        )}
        
        <input
          ref={ref}
          type={type}
          className={inputClasses}
          {...props}
        />
        
        {icon && iconPosition === "right" && (
          <div className="input-icon input-icon-right">
            {icon}
          </div>
        )}
      </div>
      
      {error && (
        <p className="input-error-text">
          <svg className="icon icon-sm" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
          {error}
        </p>
      )}
      
      {helperText && !error && (
        <p className="input-helper-text">
          {helperText}
        </p>
      )}

    </div>
  );
});

Input.displayName = "Input";

export default Input;

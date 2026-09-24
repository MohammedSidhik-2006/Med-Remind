import React from "react";

/**
 * Modern Card component for consistent layouts
 */
function Card({ 
  children, 
  className = "",
  padding = "md",
  shadow = "sm",
  hover = false,
  ...props 
}) {
  const paddingClasses = {
    none: "",
    sm: "p-4",
    md: "p-6", 
    lg: "p-8"
  };

  const shadowClasses = {
    none: "",
    sm: "shadow-sm",
    md: "shadow-md",
    lg: "shadow-lg"
  };

  const classes = [
    "card",
    paddingClasses[padding],
    shadowClasses[shadow],
    hover ? "card-hover" : "",
    className
  ].filter(Boolean).join(" ");

  return (
    <div className={classes} {...props}>
      {children}
      
      <style jsx>{`
        .card-hover {
          transition: all var(--duration-normal) var(--ease);
          cursor: pointer;
        }

        .card-hover:hover {
          transform: translateY(-2px);
          box-shadow: var(--shadow-lg);
        }
      `}</style>
    </div>
  );
}

// Card sub-components for consistent structure
Card.Header = function CardHeader({ children, className = "", ...props }) {
  return (
    <div className={`card-header ${className}`} {...props}>
      {children}
    </div>
  );
};

Card.Body = function CardBody({ children, className = "", ...props }) {
  return (
    <div className={`card-body ${className}`} {...props}>
      {children}
    </div>
  );
};

Card.Footer = function CardFooter({ children, className = "", ...props }) {
  return (
    <div className={`card-footer ${className}`} {...props}>
      {children}
    </div>
  );
};

export default Card;
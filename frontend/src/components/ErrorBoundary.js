import React from "react";

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error) {
    // Update state so the next render will show the fallback UI.
    return { hasError: true };
  }

  componentDidCatch(error, errorInfo) {
    // You can also log the error to an error reporting service here (like Sentry)
    console.error("ErrorBoundary caught an error:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      // Fallback UI overlay that completely replaces the "White Screen of Death"
      return (
        <div style={{
          height: "100vh", display: "flex", flexDirection: "column",
          alignItems: "center", justifyContent: "center",
          background: "#f8fafc", color: "#334155", textAlign: "center", padding: "20px"
        }}>
          <div style={{ fontSize: "64px", marginBottom: "20px" }}>🏥</div>
          <h1 style={{ color: "#0f172a", marginBottom: "10px" }}>MedRemind Encountered a Glitch</h1>
          <p style={{ maxWidth: "400px", lineHeight: "1.6", marginBottom: "25px" }}>
            We're sorry, but the application ran into an unexpected frontend error. 
            Don't worry, your data is safe on the server!
          </p>
          <button 
            onClick={() => window.location.replace("/")}
            style={{
              padding: "12px 24px", background: "#0ea5e9", color: "white", 
              border: "none", borderRadius: "10px", fontSize: "16px",
              fontWeight: "600", cursor: "pointer", boxShadow: "0 4px 6px rgba(14, 165, 233, 0.2)"
            }}
          >
            Reload Application
          </button>
        </div>
      );
    }

    return this.props.children; 
  }
}

export default ErrorBoundary;

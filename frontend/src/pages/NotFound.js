import React from "react";
import { useNavigate } from "react-router-dom";
import Footer from "../components/Footer";

function NotFound() {
  const navigate = useNavigate();

  return (
    <div style={{ display: "flex", flexDirection: "column", minHeight: "100vh", background: "var(--bg-app)" }}>
      <main style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", padding: "40px 20px" }}>
        <div
          style={{
            maxWidth: "480px",
            width: "100%",
            textAlign: "center",
            background: "rgba(255, 255, 255, 0.85)",
            backdropFilter: "blur(16px)",
            WebkitBackdropFilter: "blur(16px)",
            borderRadius: "var(--radius-lg)",
            padding: "48px 32px",
            border: "1px solid var(--border-light)",
            boxShadow: "var(--shadow-lg)"
          }}
        >
          <div
            style={{
              width: "72px",
              height: "72px",
              borderRadius: "20px",
              background: "var(--primary-light)",
              color: "var(--primary)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              margin: "0 auto 24px auto",
              fontSize: "32px",
              fontWeight: "800"
            }}
          >
            404
          </div>
          <h1 style={{ fontSize: "26px", fontWeight: "800", color: "var(--text-main)", marginBottom: "12px", letterSpacing: "-0.5px" }}>
            Page Not Found
          </h1>
          <p style={{ fontSize: "14px", color: "var(--text-muted)", lineHeight: "1.6", marginBottom: "32px" }}>
            The requested page or medical schedule metric does not exist or has been moved.
          </p>
          <button
            onClick={() => navigate("/dashboard")}
            style={{
              padding: "14px 28px",
              background: "linear-gradient(135deg, var(--primary) 0%, #0ea5e9 100%)",
              color: "white",
              border: "none",
              borderRadius: "var(--radius-md)",
              fontSize: "14px",
              fontWeight: "700",
              cursor: "pointer",
              boxShadow: "0 4px 14px rgba(13, 148, 136, 0.25)",
              transition: "var(--transition-smooth)"
            }}
          >
            Return to Dashboard
          </button>
        </div>
      </main>
      <Footer />
    </div>
  );
}

export default NotFound;

import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import API from "../services/api";

function Modal({ title, message, icon, onConfirm }) {
  return (
    <div style={{
      position: "fixed", inset: 0, background: "rgba(15,23,42,0.6)",
      display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000,
      backdropFilter: "blur(4px)"
    }}>
      <div className="form-card" style={{
        maxWidth: "400px", width: "90%", textAlign: "center",
        boxShadow: "var(--shadow-lg)"
      }}>
        <div style={{ fontSize: "52px", marginBottom: "15px" }}>{icon}</div>
        <h3 style={{ color: "var(--text-main)", marginBottom: "10px", fontSize: "20px", fontWeight: "800" }}>{title}</h3>
        <p style={{ color: "var(--text-light)", marginBottom: "25px", lineHeight: "1.6", fontSize: "14px" }}>{message}</p>
        <button className="btn-primary" onClick={onConfirm} style={{ width: "100%", margin: 0 }}>OK</button>
      </div>
    </div>
  );
}

function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [step, setStep] = useState(1); // 1 = request code, 2 = reset
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [infoModal, setInfoModal] = useState(null);
  const navigate = useNavigate();

  const handleRequestCode = async () => {
    setError("");
    if (!email) {
      setError("Please enter your email address.");
      return;
    }
    const isValidEmail = (email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
    if (!isValidEmail(email)) {
      setError("Please enter a valid email address.");
      return;
    }

    setLoading(true);
    try {
      const res = await API.post("/auth/forgot-password", { email });
      setInfoModal({
        title: "Code Sent",
        message: res.data.message || "Verification code sent to your email address.",
        icon: "📧"
      });
      setStep(2);
    } catch (err) {
      setError(err.response?.data?.message || "Failed to send reset code. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async () => {
    setError("");
    if (!code || !newPassword || !confirmPassword) {
      setError("All fields are required.");
      return;
    }
    if (newPassword.length < 6) {
      setError("New password must be at least 6 characters.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setLoading(true);
    try {
      const res = await API.post("/auth/reset-password", { email, code, newPassword });
      setInfoModal({
        title: "Success",
        message: res.data.message || "Password has been successfully updated.",
        icon: "✅"
      });
      // Redirect to login on confirm will happen when the modal OK button is clicked
    } catch (err) {
      setError(err.response?.data?.message || "Reset failed. Please verify the code and try again.");
      setLoading(false);
    }
  };

  const handleKey = (e) => {
    if (e.key === "Enter") {
      if (step === 1) handleRequestCode();
      else handleResetPassword();
    }
  };

  return (
    <div className="auth-page">
      {/* Graphic Left Panel for Large Screens */}
      <div className="auth-graphic-side">
        <div className="auth-graphic-header">
          <div className="auth-graphic-logo">
            <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
              <path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-7 14l-5-5 1.41-1.41L12 14.17l7.59-7.59L21 8l-9 9z"/>
            </svg>
          </div>
          <span className="auth-graphic-title">MedRemind</span>
        </div>
        
        <div className="auth-graphic-body">
          <h1 className="auth-graphic-headline">
            Recover your <span>secure dashboard</span> access.
          </h1>
          <p className="auth-graphic-sub">
            MedRemind uses military-grade encryption and email verification procedures to protect your clinical schedule logs and medication tracking history.
          </p>
        </div>
        
        <div className="auth-graphic-footer">
          © {new Date().getFullYear()} MedRemind Inc. All rights reserved.
        </div>
      </div>

      {/* Form Right Panel */}
      <div className="auth-form-side">
        <div className="auth-container">
          <div className="auth-logo">
            <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
              <path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-7 14l-5-5 1.41-1.41L12 14.17l7.59-7.59L21 8l-9 9z"/>
            </svg>
          </div>

          <h1 className="auth-title">Password Recovery</h1>
          <p className="auth-subtitle">Verify identity to update credentials</p>

          <div className="auth-form">
            {error && (
              <div style={{
                background: "var(--danger-light)",
                color: "var(--danger-hover)",
                padding: "14px 18px",
                borderRadius: "var(--radius-sm)",
                marginBottom: "20px",
                fontSize: "14px",
                fontWeight: "600",
                border: "1px solid rgba(244, 63, 94, 0.15)",
                display: "flex",
                alignItems: "center",
                gap: "8px"
              }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <circle cx="12" cy="12" r="10"/>
                  <line x1="12" y1="8" x2="12" y2="12"/>
                  <line x1="12" y1="16" x2="12.01" y2="16"/>
                </svg>
                <span>{error}</span>
              </div>
            )}

            {step === 1 ? (
              <>
                <p style={{ fontSize: "14px", color: "var(--text-light)", marginBottom: "24px", lineHeight: "1.6", fontWeight: "500" }}>
                  Please supply the email address linked with your profile. We'll issue a verification token right away.
                </p>

                <div className="input-container">
                  <span className="input-icon">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/>
                      <polyline points="22,6 12,13 2,6"/>
                    </svg>
                  </span>
                  <input
                    className="with-icon"
                    placeholder="Email address"
                    type="email"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    onKeyDown={handleKey}
                  />
                </div>

                <button onClick={handleRequestCode} disabled={loading} style={{ marginTop: "10px" }}>
                  {loading ? (
                    <>
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" style={{ animation: "spin 1s linear infinite" }}>
                        <circle cx="12" cy="12" r="10" stroke="rgba(255,255,255,0.2)" strokeWidth="3"/>
                        <path d="M12 2a10 10 0 0 1 10 10" stroke="white" strokeWidth="3"/>
                      </svg>
                      <span>Sending...</span>
                    </>
                  ) : (
                    <span>Send Verification Code</span>
                  )}
                </button>
              </>
            ) : (
              <>
                <p style={{ fontSize: "14px", color: "var(--text-light)", marginBottom: "24px", lineHeight: "1.6", fontWeight: "500" }}>
                  Check your inbox for a 6-digit confirmation code. Input it below along with your new password candidate.
                </p>

                <div className="input-container">
                  <span className="input-icon">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>
                    </svg>
                  </span>
                  <input
                    className="with-icon"
                    placeholder="6-Digit Reset Code"
                    type="text"
                    maxLength={6}
                    value={code}
                    onChange={e => setCode(e.target.value)}
                    onKeyDown={handleKey}
                  />
                </div>

                <div className="input-container">
                  <span className="input-icon">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                    </svg>
                  </span>
                  <input
                    className="with-icon"
                    type="password"
                    placeholder="New Password (min 6 characters)"
                    value={newPassword}
                    onChange={e => setNewPassword(e.target.value)}
                    onKeyDown={handleKey}
                  />
                </div>

                <div className="input-container">
                  <span className="input-icon">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                    </svg>
                  </span>
                  <input
                    className="with-icon"
                    type="password"
                    placeholder="Confirm New Password"
                    value={confirmPassword}
                    onChange={e => setConfirmPassword(e.target.value)}
                    onKeyDown={handleKey}
                  />
                </div>

                <button onClick={handleResetPassword} disabled={loading} style={{ marginTop: "10px" }}>
                  {loading ? (
                    <>
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" style={{ animation: "spin 1s linear infinite" }}>
                        <circle cx="12" cy="12" r="10" stroke="rgba(255,255,255,0.2)" strokeWidth="3"/>
                        <path d="M12 2a10 10 0 0 1 10 10" stroke="white" strokeWidth="3"/>
                      </svg>
                      <span>Updating...</span>
                    </>
                  ) : (
                    <span>Reset Password</span>
                  )}
                </button>
              </>
            )}

            <style>{`
              @keyframes spin {
                from { transform: rotate(0deg); }
                to { transform: rotate(360deg); }
              }
            `}</style>

            <p className="auth-link">
              Remember password? <Link to="/">Log in</Link>
            </p>
          </div>
        </div>
      </div>

      {infoModal && (
        <Modal
          icon={infoModal.icon}
          title={infoModal.title}
          message={infoModal.message}
          onConfirm={() => {
            setInfoModal(null);
            if (infoModal.title === "Success") {
              navigate("/");
            }
          }}
        />
      )}
    </div>
  );
}

export default ForgotPassword;

import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import Navbar from "../components/Navbar";
import Sidebar from "../components/Sidebar";
import Footer from "../components/Footer";
import API from "../services/api";

function Modal({ title, message, icon, onConfirm, onCancel, confirmText = "OK", showCancel = false, confirmClass }) {
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
        {icon && <div style={{ fontSize: "52px", marginBottom: "15px" }}>{icon}</div>}
        <h3 style={{ color: "var(--text-main)", marginBottom: "10px", fontSize: "20px", fontWeight: "800" }}>{title}</h3>
        <p style={{ color: "var(--text-light)", marginBottom: "25px", lineHeight: "1.6", fontSize: "14px" }}>{message}</p>
        <div style={{ display: "flex", gap: "12px", justifyContent: "center" }}>
          {showCancel && (
            <button onClick={onCancel} style={{
              flex: 1, padding: "12px", background: "#e2e8f0", color: "var(--text-muted)",
              border: "none", borderRadius: "10px", fontSize: "15px",
              fontWeight: "700", cursor: "pointer"
            }}>Cancel</button>
          )}
          <button onClick={onConfirm} style={{
            flex: 1, padding: "12px", color: "white", border: "none",
            borderRadius: "10px", fontSize: "15px", fontWeight: "700", cursor: "pointer",
            background: confirmClass === "danger" ? "var(--danger)" : "var(--primary)"
          }}>{confirmText}</button>
        </div>
      </div>
    </div>
  );
}

function CaregiverLinking() {
  const navigate = useNavigate();
  const [relation, setRelation] = useState(null);
  const [email, setEmail] = useState("");
  const [relationshipLabel, setRelationshipLabel] = useState("Other");
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [message, setMessage] = useState(null);
  const [error, setError] = useState(null);
  const [showUnlinkConfirm, setShowUnlinkConfirm] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  useEffect(() => {
    if (!localStorage.getItem("token")) {
      navigate("/");
      return;
    }
    fetchCaregiver();
  }, [navigate]);

  const fetchCaregiver = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await API.get("/caregiver/my-caregiver");
      setRelation(res.data.relation);
    } catch (err) {
      console.error("Error fetching caregiver:", err);
      setError(err.response?.data?.message || "Failed to load caregiver connection.");
    } finally {
      setLoading(false);
    }
  };

  const handleLink = async (e) => {
    e.preventDefault();
    if (!email || !email.trim()) {
      setError("Please enter a valid caregiver email.");
      return;
    }
    setActionLoading(true);
    setError(null);
    setMessage(null);
    try {
      const res = await API.post("/caregiver/link", {
        email: email.trim(),
        relationshipLabel
      });
      setMessage(res.data.message);
      setEmail("");
      setRelationshipLabel("Other");
      fetchCaregiver();
    } catch (err) {
      console.error("Error linking caregiver:", err);
      setError(err.response?.data?.message || "Failed to link caregiver.");
    } finally {
      setActionLoading(false);
    }
  };

  const handleUnlinkClick = () => {
    setShowUnlinkConfirm(true);
  };

  const handleUnlinkConfirm = async () => {
    setShowUnlinkConfirm(false);
    setActionLoading(true);
    setError(null);
    setMessage(null);
    try {
      const res = await API.delete("/caregiver/unlink");
      setMessage(res.data.message);
      setRelation(null);
    } catch (err) {
      console.error("Error unlinking caregiver:", err);
      setError(err.response?.data?.message || "Failed to unlink caregiver.");
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <div className="dashboard-container">
      {/* Sidebar navigation */}
      <Sidebar isOpen={isSidebarOpen} onClose={() => setIsSidebarOpen(false)} />

      {/* Main Layout Content */}
      <div className="main-layout-content">
        <Navbar onToggleSidebar={() => setIsSidebarOpen(true)} />

        <header className="page-header">
          <button className="back-btn" onClick={() => navigate("/dashboard")}>←</button>
          <h2 className="page-title">Caregiver Connection</h2>
        </header>

        <main className="form-container" style={{ maxWidth: "600px" }}>
          <div className="form-card">
            <p style={{ color: "var(--text-light)", fontSize: "14px", lineHeight: "1.6", marginBottom: "24px", fontWeight: "500" }}>
              Link a family member or trusted caregiver email to monitor your compliance logs remotely. 
              They will receive automatic email updates or low stock notifications dynamically.
            </p>

            {error && (
              <div style={{ 
                background: "var(--danger-light)", 
                color: "var(--danger)", 
                padding: "14px 18px", 
                borderRadius: "var(--radius-sm)", 
                marginBottom: "20px", 
                fontSize: "14px", 
                fontWeight: "600",
                border: "1px solid rgba(244, 63, 94, 0.15)"
              }}>
                {error}
              </div>
            )}

            {message && (
              <div style={{ 
                background: "var(--success-light)", 
                color: "var(--success)", 
                padding: "14px 18px", 
                borderRadius: "var(--radius-sm)", 
                marginBottom: "20px", 
                fontSize: "14px", 
                fontWeight: "600",
                border: "1px solid rgba(16, 185, 129, 0.15)"
              }}>
                {message}
              </div>
            )}

            {loading ? (
              <div style={{ textAlign: "center", padding: "40px" }}>
                <p style={{ color: "var(--text-light)", fontWeight: "600" }}>Loading connection status...</p>
              </div>
            ) : relation ? (
              /* Connected Caregiver Info Card */
              <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
                <h3 style={{ fontSize: "16px", fontWeight: "800", color: "var(--text-main)", borderBottom: "1.5px solid var(--border-light)", paddingBottom: "10px", textTransform: "uppercase", letterSpacing: "0.8px" }}>
                  Connected Caregiver
                </h3>
                
                <div style={{ 
                  display: "flex", 
                  alignItems: "center", 
                  gap: "20px", 
                  background: "#f8fafc", 
                  padding: "20px", 
                  borderRadius: "var(--radius-md)", 
                  border: "1px solid var(--border-light)"
                }}>
                  <div style={{ 
                    fontSize: "20px", 
                    fontWeight: "800",
                    color: "var(--primary)",
                    width: "56px", 
                    height: "56px", 
                    background: "var(--primary-light)", 
                    borderRadius: "50%", 
                    display: "flex", 
                    alignItems: "center", 
                    justifyContent: "center",
                    boxShadow: "var(--shadow-sm)"
                  }}>
                    {relation.caregiverId?.name ? relation.caregiverId.name.split(" ").filter(Boolean).map(w => w[0]).join("").toUpperCase().slice(0, 2) : "U"}
                  </div>
                  <div>
                    <div style={{ fontSize: "17px", fontWeight: "800", color: "var(--text-main)" }}>
                      {relation.caregiverId?.name}
                    </div>
                    <div style={{ fontSize: "13px", color: "var(--text-light)", marginBottom: "6px", fontWeight: "500" }}>
                      {relation.caregiverId?.email}
                    </div>
                    <span style={{ 
                      background: "var(--primary-light)", 
                      color: "var(--primary)", 
                      padding: "4px 12px", 
                      borderRadius: "20px", 
                      fontSize: "11px", 
                      fontWeight: "800",
                      textTransform: "uppercase",
                      letterSpacing: "0.5px"
                    }}>
                      Relation: {relation.relationshipLabel}
                    </span>
                  </div>
                </div>

                <button 
                  onClick={handleUnlinkClick} 
                  disabled={actionLoading}
                  className="delete-btn"
                  style={{ 
                    width: "100%", 
                    padding: "14px", 
                    fontSize: "15px", 
                    borderRadius: "var(--radius-md)"
                  }}
                >
                  {actionLoading ? "Disconnecting..." : "Unlink Caregiver Connection"}
                </button>
              </div>
            ) : (
              /* Linking Form */
              <form onSubmit={handleLink}>
                <h3 style={{ fontSize: "16px", fontWeight: "800", color: "var(--text-main)", marginBottom: "20px", textTransform: "uppercase", letterSpacing: "0.8px" }}>
                  Link a Family Caregiver
                </h3>

                <div className="form-group">
                  <label>Caregiver's Registered Email</label>
                  <input
                    type="email"
                    placeholder="e.g., helper@family.com"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </div>

                <div className="form-group">
                  <label>Relationship Type</label>
                  <select
                    value={relationshipLabel}
                    onChange={(e) => setRelationshipLabel(e.target.value)}
                  >
                    <option value="Father">Father</option>
                    <option value="Mother">Mother</option>
                    <option value="Husband">Husband</option>
                    <option value="Wife">Wife</option>
                    <option value="Son">Son</option>
                    <option value="Daughter">Daughter</option>
                    <option value="Other">Other</option>
                  </select>
                </div>

                <button 
                  type="submit" 
                  disabled={actionLoading} 
                  className="btn-primary" 
                  style={{ width: "100%", marginTop: "10px" }}
                >
                  {actionLoading ? "Establishing connection..." : "Link Caregiver"}
                </button>
              </form>
            )}
          </div>
        </main>
        <Footer />
      </div>

      {showUnlinkConfirm && (
        <Modal
          title="Unlink Caregiver"
          message="Are you sure you want to unlink this connection? They will lose access to your live daily compliance stats."
          confirmText="Yes, Disconnect"
          confirmClass="danger"
          showCancel={true}
          onConfirm={handleUnlinkConfirm}
          onCancel={() => setShowUnlinkConfirm(false)}
        />
      )}
    </div>
  );
}

export default CaregiverLinking;

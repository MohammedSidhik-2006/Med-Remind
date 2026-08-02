import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import Navbar from "../components/Navbar";
import Sidebar from "../components/Sidebar";
import Footer from "../components/Footer";
import API from "../services/api";

const getTokenData = () => {
  try {
    const token = localStorage.getItem("token");
    if (!token) return null;
    const base64Url = token.split(".")[1];
    const base64 = base64Url.replace(/-/g, "+").replace(/_/g, "/");
    const jsonPayload = decodeURIComponent(
      window.atob(base64)
        .split("")
        .map(c => "%" + ("00" + c.charCodeAt(0).toString(16)).slice(-2))
        .join("")
    );
    return JSON.parse(jsonPayload);
  } catch {
    return null;
  }
};

function Modal({ title, message, icon, onConfirm, onCancel, confirmText = "OK", confirmClass, disabled, showCancel = true, children }) {
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
        {children}
        <div style={{ display: "flex", gap: "12px", justifyContent: "center" }}>
          {showCancel && (
            <button onClick={onCancel} style={{
              flex: 1, padding: "12px", background: "#e2e8f0", color: "var(--text-muted)",
              border: "none", borderRadius: "10px", fontSize: "15px",
              fontWeight: "700", cursor: "pointer"
            }}>Cancel</button>
          )}
          <button onClick={onConfirm} disabled={disabled} style={{
            flex: 1, padding: "12px", color: "white", border: "none",
            borderRadius: "10px", fontSize: "15px", fontWeight: "700", cursor: "pointer",
            background: confirmClass === "danger" ? "var(--danger)" : "var(--success)",
            opacity: disabled ? 0.6 : 1
          }}>{confirmText}</button>
        </div>
      </div>
    </div>
  );
}

function Admin() {
  const navigate = useNavigate();
  const [tab, setTab] = useState("users");
  const [users, setUsers] = useState([]);
  const [audit, setAudit] = useState([]);
  const [medDb, setMedDb] = useState([]);
  const [userMeds, setUserMeds] = useState([]);
  const [medsPage, setMedsPage] = useState(1);
  const [medsTotalPages, setMedsTotalPages] = useState(1);
  const [loading, setLoading] = useState(false);
  const [isUnauthorized, setUnauthorized] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  // Broadcast form
  const [bSubject, setBSubject] = useState("");
  const [bMessage, setBMessage] = useState("");
  const [bStatus, setBStatus] = useState("");

  // Med DB form
  const [newMedName, setNewMedName] = useState("");
  const [newMedDosages, setNewMedDosages] = useState("");
  const [newMedCategory, setNewMedCategory] = useState("");
  const [medMsg, setMedMsg] = useState("");

  // Target states for modals
  const [deleteUserTarget, setDeleteUserTarget] = useState(null);
  const [deleteMedTarget, setDeleteMedTarget] = useState(null);
  const [deleteUserMedTarget, setDeleteUserMedTarget] = useState(null);
  const [infoModal, setInfoModal] = useState(null);

  // Guard: strict check without dashboard redirect
  useEffect(() => {
    const user = getTokenData();
    if (!user) { navigate("/"); return; }
    if (user.role !== "admin") { setUnauthorized(true); return; }
    fetchTab("users");
  }, []); // eslint-disable-line

  const fetchTab = async (t) => {
    setLoading(true);
    try {
      if (t === "users")   { const r = await API.get("/admin/users");        setUsers(r.data); }
      if (t === "audit")   { const r = await API.get("/admin/audit");        setAudit(r.data); }
      if (t === "meddb")   { const r = await API.get("/admin/med-database"); setMedDb(r.data); }
      if (t === "userMeds") { 
        const r = await API.get(`/admin/medicines?page=${medsPage}&limit=10`); 
        setUserMeds(r.data.medicines); 
        setMedsTotalPages(r.data.totalPages);
      }
    } catch { /* handled */ }
    setLoading(false);
  };

  useEffect(() => {
    if (tab === "userMeds") fetchTab("userMeds");
  }, [medsPage]); // eslint-disable-line

  const switchTab = (t) => { setTab(t); fetchTab(t); };

  const handleBroadcast = async () => {
    if (!bSubject || !bMessage) { setBStatus("No title and message required"); return; }
    setBStatus("Sending...");
    try {
      const r = await API.post("/admin/broadcast", { subject: bSubject, message: bMessage });
      setBStatus(`Success: ${r.data.message}`);
      setBSubject(""); setBMessage("");
    } catch (e) {
      setBStatus("Error: " + (e.response?.data?.message || "Failed"));
    }
  };

  const handleAddMed = async () => {
    if (!newMedName) { setMedMsg("Error: Name required"); return; }
    try {
      await API.post("/admin/med-database", {
        name: newMedName,
        commonDosages: newMedDosages.split(",").map(s => s.trim()).filter(Boolean),
        category: newMedCategory
      });
      setMedMsg("Success: Added");
      setNewMedName(""); setNewMedDosages(""); setNewMedCategory("");
      fetchTab("meddb");
    } catch (e) {
      setMedMsg("Error: " + (e.response?.data?.message || "Failed"));
    }
  };

  const handleDeleteMedClick = (med) => {
    setDeleteMedTarget(med);
  };

  const handleDeleteUserClick = (u) => {
    setDeleteUserTarget(u);
  };

  const handleDeleteUserMedClick = (m) => {
    setDeleteUserMedTarget(m);
  };

  const handleDeleteMedConfirm = async () => {
    if (!deleteMedTarget) return;
    try {
      await API.delete(`/admin/med-database/${deleteMedTarget._id}`);
      fetchTab("meddb");
    } catch (e) {
      console.error(e);
      setInfoModal({ title: "Remove Failed", message: "Failed to remove medicine from database.", icon: "❌" });
    } finally {
      setDeleteMedTarget(null);
    }
  };

  const handleDeleteUserConfirm = async () => {
    if (!deleteUserTarget) return;
    try {
      await API.delete(`/admin/users/${deleteUserTarget._id}`);
      fetchTab("users");
    } catch (e) {
      setInfoModal({ title: "Delete Failed", message: e.response?.data?.message || "Failed to delete user.", icon: "❌" });
    } finally {
      setDeleteUserTarget(null);
    }
  };

  const handleDeleteUserMedConfirm = async () => {
    if (!deleteUserMedTarget) return;
    try {
      await API.delete(`/admin/medicines/${deleteUserMedTarget._id}`);
      fetchTab("userMeds");
    } catch (e) {
      console.error(e);
      setInfoModal({ title: "Delete Failed", message: "Failed to delete user's medicine.", icon: "❌" });
    } finally {
      setDeleteUserMedTarget(null);
    }
  };

  const tabs = [
    { key: "users",     label: "Users Index" },
    { key: "userMeds",  label: "Medication Logs" },
    { key: "audit",     label: "System Audit Logs" },
    { key: "meddb",     label: "Global Formula DB" },
    { key: "broadcast", label: "Global Announcement" },
  ];

  const adherenceColor = (pct) => {
    if (pct === null) return "var(--text-light)";
    if (pct === 0)    return "var(--danger)";
    if (pct < 50)     return "var(--warning-hover)";
    if (pct < 100)    return "var(--warning)";
    return "var(--success)";
  };

  if (isUnauthorized) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", background: "#f8fafc" }}>
        <h1 style={{ color: "var(--danger)", fontSize: "30px", marginBottom: "16px", fontWeight: "800" }}>Access Denied</h1>
        <p style={{ color: "var(--text-light)", fontSize: "15px", marginBottom: "24px", fontWeight: "500" }}>You do not possess the required administrative credentials to view this clinical console.</p>
        <button onClick={() => navigate("/dashboard")} className="btn-primary" style={{ width: "auto" }}>Return to Dashboard</button>
      </div>
    );
  }

  return (
    <div className="dashboard-container">
      {/* Sidebar navigation */}
      <Sidebar isOpen={isSidebarOpen} onClose={() => setIsSidebarOpen(false)} />

      {/* Main Layout Content */}
      <div className="main-layout-content">
        <Navbar onToggleSidebar={() => setIsSidebarOpen(true)} />

        <header className="page-header">
          <button onClick={() => navigate("/dashboard")} className="back-btn">←</button>
          <h2 className="page-title">SaaS Administration Console</h2>
        </header>

        {/* Tab Selection Bar */}
        <div style={{ background: "white", borderBottom: "1px solid var(--border-light)", padding: "0 48px", display: "flex", gap: "10px", flexWrap: "wrap" }}>
          {tabs.map(t => (
            <button key={t.key} onClick={() => switchTab(t.key)} style={{
              padding: "16px 20px", border: "none", background: "none", cursor: "pointer",
              fontWeight: "800", fontSize: "13px", borderBottom: tab === t.key ? "3px solid var(--primary)" : "3px solid transparent",
              color: tab === t.key ? "var(--primary)" : "var(--text-light)", transition: "var(--transition-smooth)"
            }}>{t.label}</button>
          ))}
        </div>

        <main className="dashboard" style={{ maxWidth: "1100px" }}>
          {loading && (
            <div style={{
              textAlign: "center",
              padding: "12px",
              background: "var(--primary-light)",
              color: "var(--primary)",
              borderRadius: "var(--radius-md)",
              marginBottom: "20px",
              fontWeight: "750",
              fontSize: "13px",
              border: "1px solid rgba(13, 148, 136, 0.1)"
            }}>
              Syncing clinical ledger data...
            </div>
          )}

          {/* Users Tab */}
          {tab === "users" && (
            <div className="table-responsive-container" style={{ background: "white", border: "1px solid var(--border-light)", borderRadius: "var(--radius-lg)", overflow: "hidden", boxShadow: "var(--shadow-sm)" }}>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr style={{ background: "#f8fafc" }}>
                    {["Name", "Email", "Role", "Total Meds", "Active Today", "Today's Adherence", "Joined Date", "Action"].map(h => (
                      <th key={h} style={{ padding: "14px 20px", textAlign: "left", fontSize: "11px", fontWeight: "800", color: "var(--text-light)", textTransform: "uppercase", letterSpacing: "0.5px" }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {users.map((u, i) => (
                    <tr key={u._id} style={{ borderTop: "1px solid var(--border-light)" }}>
                      <td style={{ padding: "16px 20px", fontWeight: "800", color: "var(--text-main)" }}>{u.name}</td>
                      <td style={{ padding: "16px 20px", color: "var(--text-light)", fontSize: "13px", fontWeight: "500" }}>{u.email}</td>
                      <td style={{ padding: "16px 20px" }}>
                        <span style={{ 
                          background: u.role === "admin" ? "var(--warning-light)" : "var(--primary-light)", 
                          color: u.role === "admin" ? "var(--warning-dark)" : "var(--primary)", 
                          padding: "4px 10px", borderRadius: "20px", fontSize: "11px", fontWeight: "800",
                          textTransform: "uppercase", letterSpacing: "0.5px"
                        }}>{u.role || "user"}</span>
                      </td>
                      <td style={{ padding: "16px 20px", color: "var(--text-main)", fontWeight: "600" }}>{u.totalMeds}</td>
                      <td style={{ padding: "16px 20px", color: "var(--text-main)", fontWeight: "600" }}>{u.activeMeds}</td>
                      <td style={{ padding: "16px 20px" }}>
                        {u.todayAdherence !== null ? (
                          <span style={{ fontWeight: "800", color: adherenceColor(u.todayAdherence) }}>{u.todayAdherence}%</span>
                        ) : <span style={{ color: "var(--text-light)", fontWeight: "500" }}>—</span>}
                        {u.todayAdherence === 0 && u.activeMeds > 0 && (
                          <span style={{ marginLeft: "6px", fontSize: "11px", color: "var(--danger)", fontWeight: "800" }}>0%</span>
                        )}
                      </td>
                      <td style={{ padding: "16px 20px", color: "var(--text-light)", fontSize: "12px", fontWeight: "600" }}>{new Date(u.createdAt).toLocaleDateString()}</td>
                      <td style={{ padding: "16px 20px" }}>
                        {u.role !== "admin" && (
                          <button onClick={() => handleDeleteUserClick(u)} className="delete-btn" style={{ padding: "6px 12px", fontSize: "11px" }}>Delete Account</button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {users.length === 0 && <div style={{ padding: "40px", textAlign: "center", color: "var(--text-light)", fontWeight: "600" }}>No user profiles found in directory</div>}
            </div>
          )}

          {/* User Meds Tab */}
          {tab === "userMeds" && (
            <div className="table-responsive-container" style={{ background: "white", border: "1px solid var(--border-light)", borderRadius: "var(--radius-lg)", overflow: "hidden", boxShadow: "var(--shadow-sm)" }}>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr style={{ background: "#f8fafc" }}>
                    {["Medicine", "Owner Account", "Dosage", "Schedule Frequency", "Stock Level", "Action"].map(h => (
                      <th key={h} style={{ padding: "14px 20px", textAlign: "left", fontSize: "11px", fontWeight: "800", color: "var(--text-light)", textTransform: "uppercase", letterSpacing: "0.5px" }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {userMeds.map((m) => (
                    <tr key={m._id} style={{ borderTop: "1px solid var(--border-light)" }}>
                      <td style={{ padding: "16px 20px", fontWeight: "800", color: "var(--text-main)" }}>{m.name}</td>
                      <td style={{ padding: "16px 20px", color: "var(--text-light)", fontSize: "13px", fontWeight: "500" }}>{m.userId?.email || 'Deleted User Account'}</td>
                      <td style={{ padding: "16px 20px", color: "var(--text-muted)", fontWeight: "600" }}>{m.dosage}</td>
                      <td style={{ padding: "16px 20px", color: "var(--text-muted)", fontWeight: "600", textTransform: "capitalize" }}>{m.frequency}</td>
                      <td style={{ padding: "16px 20px", color: "var(--text-main)", fontWeight: "800" }}>{m.stock} doses</td>
                      <td style={{ padding: "16px 20px" }}>
                         <button onClick={() => handleDeleteUserMedClick(m)} className="delete-btn" style={{ padding: "6px 12px", fontSize: "11px" }}>Delete Schedule</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {userMeds.length === 0 && <div style={{ padding: "40px", textAlign: "center", color: "var(--text-light)", fontWeight: "600" }}>No active medicine schedules indexed</div>}
              {medsTotalPages > 1 && (
                 <div style={{ padding: "16px", display: "flex", justifyContent: "center", gap: "12px", borderTop: "1px solid var(--border-light)", background: "#f8fafc" }}>
                   <button disabled={medsPage === 1} onClick={() => setMedsPage(p => p - 1)} style={{ padding: "8px 16px", borderRadius: "8px", border: "1px solid var(--border-light)", background: "white", fontWeight: "700", fontSize: "12px", cursor: medsPage === 1 ? "not-allowed" : "pointer" }}>Prev</button>
                   <span style={{ alignSelf: "center", fontSize: "13px", fontWeight: "700", color: "var(--text-main)" }}>Page {medsPage} of {medsTotalPages}</span>
                   <button disabled={medsPage === medsTotalPages} onClick={() => setMedsPage(p => p + 1)} style={{ padding: "8px 16px", borderRadius: "8px", border: "1px solid var(--border-light)", background: "white", fontWeight: "700", fontSize: "12px", cursor: medsPage === medsTotalPages ? "not-allowed" : "pointer" }}>Next</button>
                 </div>
              )}
            </div>
          )}

          {/* Audit Logs Tab */}
          {tab === "audit" && (
            <div className="table-responsive-container" style={{ background: "white", border: "1px solid var(--border-light)", borderRadius: "var(--radius-lg)", overflow: "hidden", boxShadow: "var(--shadow-sm)" }}>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr style={{ background: "#f8fafc" }}>
                    {["Timestamp", "User Email", "Action Performed", "Ledger Details"].map(h => (
                      <th key={h} style={{ padding: "14px 20px", textAlign: "left", fontSize: "11px", fontWeight: "800", color: "var(--text-light)", textTransform: "uppercase", letterSpacing: "0.5px" }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {audit.map((log) => (
                    <tr key={log._id} style={{ borderTop: "1px solid var(--border-light)" }}>
                      <td style={{ padding: "12px 20px", color: "var(--text-light)", fontSize: "12px", whiteSpace: "nowrap", fontFamily: "monospace", fontWeight: "600" }}>{new Date(log.createdAt).toLocaleString()}</td>
                      <td style={{ padding: "12px 20px", color: "var(--text-light)", fontSize: "13px", fontWeight: "500" }}>{log.userEmail}</td>
                      <td style={{ padding: "12px 20px" }}>
                        <span style={{ background: "var(--primary-light)", color: "var(--primary)", padding: "4px 8px", borderRadius: "6px", fontSize: "11px", fontWeight: "800", textTransform: "uppercase", letterSpacing: "0.5px" }}>{log.action}</span>
                      </td>
                      <td style={{ padding: "12px 20px", color: "var(--text-muted)", fontSize: "13px", fontWeight: "600" }}>{log.details}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {audit.length === 0 && <div style={{ padding: "40px", textAlign: "center", color: "var(--text-light)", fontWeight: "600" }}>No audit log transactions logged yet</div>}
            </div>
          )}

          {/* Med Database Tab */}
          {tab === "meddb" && (
            <>
              <div className="schedule-card" style={{ padding: "28px", marginBottom: "20px" }}>
                <h3 style={{ color: "var(--text-main)", marginBottom: "16px", fontSize: "15px", fontWeight: "800", textTransform: "uppercase", letterSpacing: "0.8px" }}>Add Formula to Global Database</h3>
                <div style={{ display: "grid", gridTemplateColumns: "1.5fr 1.5fr 1fr", gap: "12px", marginBottom: "16px" }}>
                  <input placeholder="Medicine Name *" value={newMedName} onChange={e => setNewMedName(e.target.value)}
                    style={{ padding: "12px 14px", border: "1.5px solid #e2e8f0", borderRadius: "8px", fontSize: "14px" }} />
                  <input placeholder="Common Dosages (comma split)" value={newMedDosages} onChange={e => setNewMedDosages(e.target.value)}
                    style={{ padding: "12px 14px", border: "1.5px solid #e2e8f0", borderRadius: "8px", fontSize: "14px" }} />
                  <input placeholder="Category (e.g., Pill)" value={newMedCategory} onChange={e => setNewMedCategory(e.target.value)}
                    style={{ padding: "12px 14px", border: "1.5px solid #e2e8f0", borderRadius: "8px", fontSize: "14px" }} />
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
                  <button onClick={handleAddMed} className="btn-primary" style={{ width: "auto", margin: 0, padding: "12px 24px" }}>Add Formula</button>
                  {medMsg && <span style={{ fontSize: "13px", fontWeight: "700", color: medMsg.startsWith("Success") ? "var(--success)" : "var(--danger)" }}>{medMsg}</span>}
                </div>
              </div>

              <div className="table-responsive-container" style={{ background: "white", border: "1px solid var(--border-light)", borderRadius: "var(--radius-lg)", overflow: "hidden", boxShadow: "var(--shadow-sm)" }}>
                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                  <thead>
                    <tr style={{ background: "#f8fafc" }}>
                      {["Formula Name", "Category", "Recommended Dosages", ""].map(h => (
                        <th key={h} style={{ padding: "14px 20px", textAlign: "left", fontSize: "11px", fontWeight: "800", color: "var(--text-light)", textTransform: "uppercase", letterSpacing: "0.5px" }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {medDb.map((m) => (
                      <tr key={m._id} style={{ borderTop: "1px solid var(--border-light)" }}>
                        <td style={{ padding: "14px 20px", fontWeight: "800", color: "var(--text-main)" }}>{m.name}</td>
                        <td style={{ padding: "14px 20px", color: "var(--text-light)", fontSize: "13px", fontWeight: "500" }}>{m.category || "—"}</td>
                        <td style={{ padding: "14px 20px", color: "var(--text-muted)", fontSize: "13px", fontWeight: "600" }}>{m.commonDosages.join(", ") || "—"}</td>
                        <td style={{ padding: "14px 20px", textAlign: "right" }}>
                          <button onClick={() => handleDeleteMedClick(m)} className="delete-btn" style={{ padding: "6px 12px", fontSize: "11px" }}>Remove</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {medDb.length === 0 && <div style={{ padding: "40px", textAlign: "center", color: "var(--text-light)", fontWeight: "600" }}>No formula records defined in global database</div>}
              </div>
            </>
          )}

          {/* Broadcast Tab */}
          {tab === "broadcast" && (
            <div className="schedule-card" style={{ padding: "32px", maxWidth: "680px" }}>
              <h3 style={{ color: "var(--text-main)", marginBottom: "6px", fontSize: "16px", fontWeight: "800", textTransform: "uppercase", letterSpacing: "0.8px" }}>Publish Service Announcement</h3>
              <p style={{ color: "var(--text-light)", fontSize: "13px", marginBottom: "24px", fontWeight: "500" }}>This action transmits an instant push notification broadcast to every registered user device.</p>
              
              <div className="form-group">
                <label>Notification Title</label>
                <input value={bSubject} onChange={e => setBSubject(e.target.value)} placeholder="e.g., MedRemind System Patch updates" />
              </div>
              <div className="form-group">
                <label>Announcement Body</label>
                <textarea value={bMessage} onChange={e => setBMessage(e.target.value)} rows={5} placeholder="Type message body content..."
                  style={{ width: "100%", padding: "12px 14px", border: "1.5px solid #cbd5e1", borderRadius: "8px", fontSize: "14px", resize: "vertical", boxSizing: "border-box" }} />
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
                <button onClick={handleBroadcast} className="btn-primary" style={{ width: "auto", margin: 0, padding: "12px 24px" }}>Broadcast Message</button>
                {bStatus && <div style={{ fontSize: "13px", fontWeight: "700", color: bStatus.startsWith("Success") ? "var(--success)" : "var(--danger)" }}>{bStatus}</div>}
              </div>
            </div>
          )}
        </main>
        <Footer />
      </div>

      {deleteMedTarget && (
        <Modal
          icon="⚠️"
          title="Remove Formula"
          message={`Are you sure you want to delete formula "${deleteMedTarget.name}" from the global catalog database?`}
          confirmText="Confirm Delete"
          confirmClass="danger"
          onConfirm={handleDeleteMedConfirm}
          onCancel={() => setDeleteMedTarget(null)}
        />
      )}

      {deleteUserTarget && (
        <Modal
          icon="⚠️"
          title="Delete User Account"
          message={`WARNING: This will permanently delete user account for ${deleteUserTarget.name} (${deleteUserTarget.email}) and clear all associated schedules and dose logs from the ledger database.`}
          confirmText="Delete Permanently"
          confirmClass="danger"
          onConfirm={handleDeleteUserConfirm}
          onCancel={() => setDeleteUserTarget(null)}
        />
      )}

      {deleteUserMedTarget && (
        <Modal
          icon="⚠️"
          title="Delete Schedule"
          message={`Are you sure you want to delete this medication schedule for ${deleteUserMedTarget.name}? This will purge its history logs.`}
          confirmText="Confirm Delete"
          confirmClass="danger"
          onConfirm={handleDeleteUserMedConfirm}
          onCancel={() => setDeleteUserMedTarget(null)}
        />
      )}

      {infoModal && (
        <Modal
          icon={infoModal.icon}
          title={infoModal.title}
          message={infoModal.message}
          showCancel={false}
          onConfirm={() => setInfoModal(null)}
        />
      )}
    </div>
  );
}

export default Admin;

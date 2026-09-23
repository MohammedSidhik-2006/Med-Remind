import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import Navbar from "../components/Navbar";
import Sidebar from "../components/Sidebar";
import Footer from "../components/Footer";
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

function RefillTracker() {
  const navigate = useNavigate();
  const [medicines, setMedicines] = useState([]);
  const [editingId, setEditingId] = useState(null);
  const [newStock, setNewStock] = useState("");
  const [infoModal, setInfoModal] = useState(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  useEffect(() => {
    if (!localStorage.getItem("token")) navigate("/");
  }, [navigate]);

  useEffect(() => {
    fetchMedicines();
  }, []);

  const fetchMedicines = async () => {
    try {
      const res = await API.get("/medicine");
      setMedicines(res.data);
    } catch (err) {
      console.error("Error:", err);
    }
  };

  const handleUpdateStock = async (id) => {
    if (!newStock || isNaN(newStock) || Number(newStock) < 0) {
      setInfoModal({ title: "Invalid Input", message: "Please enter a valid non-negative stock number.", icon: "⚠️" });
      return;
    }
    try {
      await API.patch(`/medicine/stock/${id}`, { stock: Number(newStock) });
      setEditingId(null);
      setNewStock("");
      fetchMedicines();
    } catch (err) {
      setInfoModal({ title: "Update Failed", message: "Failed to update medicine stock level.", icon: "❌" });
    }
  };

  const getStockStatus = (med) => {
    if (med.stock <= 0) return { color: "var(--danger)", label: "Out of Stock", bg: "var(--danger-light)" };
    if (med.stock <= med.refillAt) return { color: "var(--warning-hover)", label: "Low Stock Alert", bg: "var(--warning-light)" };
    return { color: "var(--success)", label: "Sufficient Stock", bg: "var(--success-light)" };
  };

  return (
    <div className="dashboard-container">
      {/* Reusable Sidebar */}
      <Sidebar isOpen={isSidebarOpen} onClose={() => setIsSidebarOpen(false)} />

      {/* Main Layout Area */}
      <div className="main-layout-content">
        <Navbar onToggleSidebar={() => setIsSidebarOpen(true)} />

        <header className="page-header">
          <button className="back-btn" onClick={() => navigate("/dashboard")}>←</button>
          <h2 className="page-title">Refill Tracker</h2>
        </header>

        <main className="form-container" style={{ maxWidth: "720px" }}>
          <div className="form-card">
            {medicines.length === 0 ? (
              <div className="empty-state">
                <div className="empty-state-icon" style={{ fontSize: "32px", color: "var(--primary)", border: "2px dashed var(--primary)", width: "60px", height: "60px", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 15px auto", fontWeight: "800" }}>Rx</div>
                <p style={{ fontWeight: "600", color: "var(--text-light)" }}>No medications in your active schedules to track refills</p>
                <button className="empty-state-cta" onClick={() => navigate("/add-medicine")}>Add Medication</button>
              </div>
            ) : (
              <div className="medicine-list">
                {medicines.map((med) => {
                  const status = getStockStatus(med);
                  // Calculate stock percentage: use max(current stock, 30) as cap so the
                  // bar reflects full at 30+ doses but also works for larger initial stocks.
                  const stockCap = Math.max(30, med.stock);
                  const progressPercent = Math.min(100, Math.round((med.stock / stockCap) * 100));
                  return (
                    <div key={med._id} className="medicine-card" style={{ flexDirection: "column", alignItems: "stretch", gap: "16px", padding: "24px" }}>
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "12px" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "14px" }}>
                          <div className="medicine-icon" style={{ background: status.bg, color: status.color, border: "none" }}>✱</div>
                          <div className="medicine-info">
                            <div className="medicine-name" style={{ fontSize: "17px" }}>{med.name}</div>
                            <div className="medicine-details">
                              <span>Dosage: {med.dosage}</span>
                              <span>Scheduled: {med.times && med.times.length > 1 ? med.times.join(", ") : med.time}</span>
                            </div>
                          </div>
                        </div>
                        <div style={{ textAlign: "right" }}>
                          <div style={{
                            background: status.bg, color: status.color,
                            padding: "4px 12px", borderRadius: "20px",
                            fontSize: "11px", fontWeight: "800", marginBottom: "6px",
                            display: "inline-block", textTransform: "uppercase", letterSpacing: "0.5px"
                          }}>
                            {status.label}
                          </div>
                          <div style={{ fontSize: "24px", fontWeight: "800", color: status.color }}>
                            {med.stock}
                            <span style={{ fontSize: "13px", fontWeight: "600", color: "var(--text-light)" }}> doses</span>
                          </div>
                        </div>
                      </div>

                      {/* Stock progress bar */}
                      <div style={{ background: "#cbd5e1", borderRadius: "10px", height: "10px", overflow: "hidden" }}>
                        <div style={{
                          height: "100%", borderRadius: "10px",
                          width: `${progressPercent}%`,
                          background: status.color, transition: "width 0.5s ease"
                        }} />
                      </div>

                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: "13px", color: "var(--text-light)", fontWeight: "600" }}>
                        <span>Alert when stock reaches {med.refillAt} doses</span>
                        <span>Initial capacity: {stockCap} doses</span>
                      </div>

                      {editingId === med._id ? (
                        <div style={{ display: "flex", gap: "12px", alignItems: "center", background: "#f8fafc", padding: "12px", borderRadius: "12px", border: "1px solid var(--border-light)" }}>
                          <input
                            type="number" min="0" placeholder="New stock count"
                            value={newStock} onChange={e => setNewStock(e.target.value)}
                            style={{ flex: 1, padding: "10px 14px", borderRadius: "8px", border: "1.5px solid #e2e8f0", fontSize: "14px" }}
                          />
                          <button onClick={() => handleUpdateStock(med._id)} style={{
                            padding: "10px 18px", background: "var(--success)", color: "white",
                            border: "none", borderRadius: "8px", cursor: "pointer", fontWeight: "700", fontSize: "13px"
                          }}>Save</button>
                          <button onClick={() => setEditingId(null)} style={{
                            padding: "10px 18px", background: "#e2e8f0", color: "var(--text-muted)",
                            border: "none", borderRadius: "8px", cursor: "pointer", fontWeight: "700", fontSize: "13px"
                          }}>Cancel</button>
                        </div>
                      ) : (
                        <button onClick={() => { setEditingId(med._id); setNewStock(med.stock); }} style={{
                          padding: "12px", background: "var(--primary-light)", color: "var(--primary)",
                          border: "1.5px dashed rgba(13, 148, 136, 0.3)", borderRadius: "10px",
                          cursor: "pointer", fontWeight: "700", fontSize: "13px", transition: "var(--transition-smooth)"
                        }}
                        onMouseEnter={(e) => { e.currentTarget.style.background = "var(--primary)"; e.currentTarget.style.color = "white"; }}
                        onMouseLeave={(e) => { e.currentTarget.style.background = "var(--primary-light)"; e.currentTarget.style.color = "var(--primary)"; }}
                        >
                          Update Stock Level After Refill
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </main>
        <Footer />
      </div>

      {infoModal && (
        <Modal
          icon={infoModal.icon}
          title={infoModal.title}
          message={infoModal.message}
          onConfirm={() => setInfoModal(null)}
        />
      )}
    </div>
  );
}

export default RefillTracker;

import { useEffect, useState, useCallback } from "react";
import API from "../services/api";

// Reusable modal component
function Modal({ title, message, icon, onConfirm, onCancel, confirmText, confirmClass, disabled, showCancel = true, children }) {
  return (
    <div style={{
      position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)",
      display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000
    }}>
      <div style={{
        background: "white", borderRadius: "20px", padding: "35px 30px",
        maxWidth: "400px", width: "90%", textAlign: "center",
        boxShadow: "0 20px 60px rgba(0,0,0,0.3)"
      }}>
        <div style={{ fontSize: "52px", marginBottom: "15px" }}>{icon}</div>
        <h3 style={{ color: "#2d3748", marginBottom: "10px", fontSize: "20px" }}>{title}</h3>
        <p style={{ color: "#718096", marginBottom: "25px", lineHeight: "1.6" }}>{message}</p>
        {children}
        <div style={{ display: "flex", gap: "12px", justifyContent: "center" }}>
          {showCancel && (
            <button onClick={onCancel} style={{
              flex: 1, padding: "12px", background: "#e2e8f0", color: "#2d3748",
              border: "none", borderRadius: "10px", fontSize: "15px",
              fontWeight: "600", cursor: "pointer"
            }}>Cancel</button>
          )}
          <button onClick={onConfirm} disabled={disabled} style={{
            flex: 1, padding: "12px", color: "white", border: "none",
            borderRadius: "10px", fontSize: "15px", fontWeight: "600", cursor: "pointer",
            background: confirmClass === "danger" ? "var(--danger)" : "var(--success)",
            opacity: disabled ? 0.6 : 1
          }}>{confirmText}</button>
        </div>
      </div>
    </div>
  );
}

const formatTo12Hour = (timeStr) => {
  if (!timeStr) return "";
  const [hourStr, minStr] = timeStr.split(":");
  const hour = parseInt(hourStr, 10);
  if (isNaN(hour)) return timeStr;
  const min = minStr;
  const ampm = hour >= 12 ? "PM" : "AM";
  const formattedHour = hour % 12 === 0 ? 12 : hour % 12;
  return `${String(formattedHour).padStart(2, "0")}:${min} ${ampm}`;
};

// Helper: get local date string YYYY-MM-DD
const getLocalDate = () => {
  const now = new Date();
  const pad = n => String(n).padStart(2, "0");
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
};

// Check if a medicine is active today (within date range)
const isMedicineActiveToday = (med) => {
  const today = getLocalDate();
  if (med.startDate && today < med.startDate) return false;
  if (med.endDate && today > med.endDate) return false;
  return true;
};

function MedicineList({ medicines, setMedicines, loading, refreshMedicines, navigate }) {
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [confirmTarget, setConfirmTarget] = useState(null);
  const [snoozeTarget, setSnoozeTarget] = useState(null);
  const [inAppAlerts, setInAppAlerts] = useState([]);
  // Per-item processing key: "medId-slotTime" when busy, null when idle.
  // Prevents a single card's network call from blocking ALL other cards.
  const [processingKey, setProcessingKey] = useState(null);
  const isProcessing = (medId, slotTime) => processingKey === `${medId}-${slotTime}`;
  const [infoModal, setInfoModal] = useState(null);

  const isMissedLocked = (med) => {
    const threshold = med.maxMissedThreshold || 3;
    return !med.taken && med.missedCount >= threshold;
  };

  const canTakeSlot = (slot) => {
    if (slot.slotStatus === "taken") return false;
    if (slot.slotStatus === "missed") {
      const threshold = slot.maxMissedThreshold || 3;
      const isCurrent = slot.lastReminderSent && slot.lastReminderSent.split(" ")[1] === slot.slotTime;
      return isCurrent && slot.missedCount < threshold;
    }
    return true; // "pending"
  };

  // Client-side notification fallback:
  const checkAndNotify = useCallback(async (meds) => {
    const today = getLocalDate();

    meds.forEach(async (med) => {
      // Only fire if the backend Cron definitively marked it pending
      if (!med.confirmationPending || med.taken) return;
      if (isMissedLocked(med)) return; // Do not notify for locked missed doses
      
      // Use the database's explicit reminder timestamp to deduplicate seamlessly
      const alarmKey = med.lastReminderSent || `${today}-${med._id}`;
      const localKey = `notified-${med._id}-${alarmKey}`;
      
      if (sessionStorage.getItem(localKey)) return;
      sessionStorage.setItem(localKey, "1");

      // 1. GUARANTEED IN-APP DELIVERY (Bypasses OS blocks completely)
      setInAppAlerts(prev => {
        if (prev.find(p => p._id === med._id)) return prev;
        return [...prev, med];
      });

      // Offline-safe beep using Web Audio API — no network request needed
      try {
        const ctx = new (window.AudioContext || window.webkitAudioContext)();
        const osc  = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.type = "sine";
        osc.frequency.value = 880;
        gain.gain.setValueAtTime(0.3, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.6);
        osc.start(ctx.currentTime);
        osc.stop(ctx.currentTime + 0.6);
      } catch (err) {}
    });
  }, []);

  // Trigger client-side fallbacks when medicines change
  useEffect(() => {
    if (medicines && medicines.length > 0) {
      checkAndNotify(medicines);
    }
  }, [medicines, checkAndNotify]);

  // Keep in-app alerts in sync with medicines state (avoids duplicate alerts)
  useEffect(() => {
    if (medicines && medicines.length > 0) {
      setInAppAlerts(prev => prev.filter(alertMed => {
        const fresh = medicines.find(m => m._id === alertMed._id);
        if (!fresh) return false; // Deleted
        if (fresh.taken) return false; // Marked taken
        if (!fresh.confirmationPending) return false; // Snoozed or cleared on server
        if (isMissedLocked(fresh)) return false; // Missed & Locked
        if (fresh.snoozedUntil && new Date(fresh.snoozedUntil) > new Date()) return false; // Snoozed
        return true;
      }));
    } else {
      setInAppAlerts([]);
    }
  }, [medicines]);

  // Destructive deletion: immediate optimistic update, rollback on failure
  const handleDeleteConfirm = async () => {
    if (!deleteTarget) return;
    const backup = [...medicines];
    const targetId = deleteTarget._id;
    setMedicines(prev => prev.filter(m => m._id !== targetId));
    setDeleteTarget(null);

    try {
      await API.delete(`/medicine/${targetId}`);
      refreshMedicines();
    } catch (err) {
      setMedicines(backup);
      setInfoModal({ title: "Delete Failed", message: "Failed to delete the medicine schedule.", icon: "Error" });
    }
  };

  const handleMarkTakenClick = (med, slotTime) => {
    setConfirmTarget({ med, slotTime });
  };

  // State lifting & optimistic updates for taken confirmation
  const handleTakenConfirm = async () => {
    if (!confirmTarget) return;
    const { med, slotTime } = confirmTarget;
    const targetId = med._id;
    const key = `${targetId}-${slotTime}`;
    if (processingKey === key) return; // Already in-flight for this slot
    setProcessingKey(key);
    const backup = [...medicines];

    // Optimistic Update — only affects this specific medicine card
    setMedicines(prev => prev.map(m => {
      if (m._id === targetId) {
        const newStock = Math.max(0, (m.stock || 0) - 1);
        const newTakenCount = (m.takenTodayCount || 0) + 1;
        const updatedLogs = [...(m.todayLogs || [])];
        const logIdx = updatedLogs.findIndex(l => l.scheduledTime === slotTime);
        if (logIdx > -1) {
          updatedLogs[logIdx] = { ...updatedLogs[logIdx], status: "taken", takenAt: new Date().toISOString() };
        } else {
          updatedLogs.push({ scheduledTime: slotTime, status: "taken", takenAt: new Date().toISOString() });
        }
        const allTimes = m.times?.length > 0 ? m.times : [m.time];
        const isFullyTaken = newTakenCount >= allTimes.length;
        return { 
          ...m, 
          taken: isFullyTaken, 
          stock: newStock,
          takenTodayCount: newTakenCount,
          todayLogs: updatedLogs,
          confirmationPending: false 
        };
      }
      return m;
    }));
    setConfirmTarget(null);

    try {
      await API.patch(`/medicine/taken/${targetId}`, { scheduledTime: slotTime });
      refreshMedicines();
    } catch (err) {
      setMedicines(backup);
      setInfoModal({ 
        title: "Confirm Failed", 
        message: err.response?.data?.message || "Status update blocked. Please try again.", 
        icon: "Warning" 
      });
    } finally {
      setProcessingKey(null);
    }
  };

  // Optimistic update for snooze
  const handleSnooze = async (target, minutes) => {
    const backup = [...medicines];
    const { med, slotTime } = target;
    const targetId = med._id;
    
    setMedicines(prev => prev.map(m => {
      if (m._id === targetId) {
        return { 
          ...m, 
          snoozedUntil: new Date(Date.now() + minutes * 60 * 1000).toISOString(),
          lastReminderSent: `${getLocalDate()} ${slotTime}`,
          confirmationPending: false 
        };
      }
      return m;
    }));
    setSnoozeTarget(null);

    try {
      await API.patch(`/medicine/snooze/${targetId}`, { minutes });
      refreshMedicines();
    } catch (err) {
      setMedicines(backup);
      setInfoModal({ title: "Snooze Failed", message: "Failed to snooze the medication reminder.", icon: "Error" });
    }
  };

  // Check if slot is currently snoozed
  const isSlotSnoozed = (med, time) => {
    if (!med.snoozedUntil || new Date(med.snoozedUntil) <= new Date()) return false;
    if (!med.lastReminderSent) return false;
    const parts = med.lastReminderSent.split(" ");
    if (parts.length < 2) return false;
    return parts[1] === time;
  };

  const getTodaySlots = (meds) => {
    const slots = [];
    meds.forEach(med => {
      if (!isMedicineActiveToday(med)) return;
      const times = med.times && med.times.length > 0 ? med.times : [med.time];
      times.forEach(time => {
        const log = med.todayLogs?.find(l => l.scheduledTime === time);
        const status = log ? log.status : "pending";
        slots.push({
          ...med,
          slotTime: time,
          slotStatus: status,
          takenAt: log?.takenAt
        });
      });
    });
    return slots.sort((a, b) => a.slotTime.localeCompare(b.slotTime));
  };

  const todaySlots = getTodaySlots(medicines);

  if (loading) {
    return (
      <div className="schedule-section">
        <div className="schedule-header"><h3>Today's Schedule</h3></div>
        <div style={{ textAlign: "center", padding: "40px", color: "#718096" }}>Loading...</div>
      </div>
    );
  }

  return (
    <>
      <div className="schedule-section">
        <div className="schedule-header">
          <h3>Today's Schedule</h3>
          <button onClick={() => refreshMedicines(true)} className="refresh-btn" title="Refresh">
            ↻
          </button>
        </div>

        {todaySlots.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon" style={{ fontSize: "32px", color: "var(--primary)", border: "2px dashed var(--primary)", width: "60px", height: "60px", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 15px auto", fontWeight: "800" }}>Rx</div>
            <p>No medications scheduled for today</p>
            {navigate && (
              <button className="empty-state-cta" onClick={() => navigate("/add-medicine")}>
                + Add Medication
              </button>
            )}
          </div>
        ) : (
          <div className="medicine-list">
            {todaySlots.map((slot) => {
              const isCurrent = slot.lastReminderSent && slot.lastReminderSent.split(" ")[1] === slot.slotTime;
              const slotLocked = slot.slotStatus === "missed" && !canTakeSlot(slot);

              return (
                <div className={`medicine-card status-${slot.slotStatus} ${slotLocked ? "is-locked" : ""}`} key={`${slot._id}-${slot.slotTime}`}>
                  <div style={{ display: "flex", alignItems: "center", flex: 1 }}>
                    <div className="medicine-icon">
                      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="m10.5 13.5 3-3"></path>
                        <path d="M14.85 3.15a4.5 4.5 0 0 0-6.36 0L3.15 8.49a4.5 4.5 0 0 0 0 6.36l5.34 5.34a4.5 4.5 0 0 0 6.36 0l5.34-5.34a4.5 4.5 0 0 0 0-6.36Z"></path>
                      </svg>
                    </div>
                    <div className="medicine-info">
                      <div className="medicine-name">{slot.name}</div>
                      <div className="medicine-details">
                        <span>Dosage: {slot.dosage}</span>
                        <span>Scheduled: {formatTo12Hour(slot.slotTime)}</span>
                        {slot.timePeriods && slot.timePeriods.length > 0 && (
                          <span>Periods: {slot.timePeriods.join(", ")}</span>
                        )}
                        {slot.startDate && (
                          <span>Dates: {slot.startDate}{slot.endDate ? ` → ${slot.endDate}` : ""}</span>
                        )}
                        {slot.stock !== undefined && (
                          <span style={{ color: slot.stock <= slot.refillAt ? "#ef4444" : "#718096" }}>
                            Stock: {slot.stock} left
                          </span>
                        )}
                      </div>

                      {/* Missed medicine warning */}
                      {slot.slotStatus === "missed" && (
                        <div style={{
                          marginTop: "6px", fontSize: "12px", color: "#c53030",
                          fontWeight: "600", background: "#fff5f5",
                          padding: "4px 8px", borderRadius: "6px",
                          display: "inline-flex", alignItems: "center", gap: "4px"
                        }}>
                          {slotLocked 
                            ? `Alert: Dose locked as missed (${slot.missedCount}x reminders expired)` 
                            : `Alert: Missed ${slot.missedCount}x — please take now!`}
                        </div>
                      )}

                      {isCurrent && slot.confirmationPending && slot.slotStatus !== "taken" && slot.missedCount === 0 && (
                        <div style={{
                          marginTop: "6px", fontSize: "12px", color: "#f57c00",
                          fontWeight: "600", display: "flex", alignItems: "center", gap: "4px"
                        }}>
                          Reminder: Alarm sent — did you take it?
                        </div>
                      )}

                      {/* Low stock warning */}
                      {slot.stock !== undefined && slot.stock <= slot.refillAt && (
                        <div style={{
                          marginTop: "6px", fontSize: "12px", color: "#e65100",
                          fontWeight: "600", background: "#fff3e0",
                          padding: "4px 8px", borderRadius: "6px",
                          display: "inline-flex", alignItems: "center", gap: "4px"
                        }}>
                          Warning: Low stock — only {slot.stock} doses left
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="medicine-actions">
                    {slot.slotStatus === "taken" ? (
                      <span className="status-badge taken">Taken</span>
                    ) : slotLocked ? (
                      <span className="status-badge missed" style={{ background: "#fee2e2", color: "#dc2626", border: "1px solid #fca5a5", padding: "6px 12px", borderRadius: "8px", fontSize: "12px", fontWeight: "600" }}>Missed</span>
                    ) : (
                      <span className="status-badge pending">Pending</span>
                    )}

                    {slot.slotStatus !== "taken" && !slotLocked && (
                      <button 
                        className="mark-taken-btn" 
                        disabled={isProcessing(slot._id, slot.slotTime)}
                        onClick={() => handleMarkTakenClick(slot, slot.slotTime)}
                      >
                        {isProcessing(slot._id, slot.slotTime) ? "Confirming..." : "Mark Taken"}
                      </button>
                    )}
                    {slot.slotStatus !== "taken" && !slotLocked && !isSlotSnoozed(slot, slot.slotTime) && (
                      <button 
                        disabled={isProcessing(slot._id, slot.slotTime)}
                        onClick={() => setSnoozeTarget({ med: slot, slotTime: slot.slotTime })} 
                        style={{
                          background: "#fff3e0", color: "#f57c00", border: "1px solid #ffcc80",
                          padding: "8px 12px", borderRadius: "8px", cursor: "pointer",
                          fontSize: "13px", fontWeight: "600",
                          opacity: isProcessing(slot._id, slot.slotTime) ? 0.6 : 1
                        }}
                      >
                        Snooze
                      </button>
                    )}
                    {slot.slotStatus !== "taken" && !slotLocked && isSlotSnoozed(slot, slot.slotTime) && (
                      <span style={{
                        background: "#fff3e0", color: "#f57c00", padding: "6px 10px",
                        borderRadius: "8px", fontSize: "12px", fontWeight: "600"
                      }}>
                        Snoozed until {new Date(slot.snoozedUntil).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                      </span>
                    )}
                    <button className="delete-btn" onClick={() => setDeleteTarget(slot)}>
                      Delete
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Reusable Info/Alert Modal */}
      {infoModal && (
        <Modal
          icon={infoModal.icon || "Info"}
          title={infoModal.title}
          message={infoModal.message}
          confirmText="OK"
          confirmClass="success"
          showCancel={false}
          onConfirm={() => setInfoModal(null)}
          onCancel={() => setInfoModal(null)}
        />
      )}

      {/* Delete Confirmation Modal */}
      {deleteTarget && (
        <Modal
          icon="Delete"
          title="Delete Medicine?"
          message={`Are you sure you want to remove "${deleteTarget.name}" from your schedule? This action cannot be undone.`}
          confirmText="Yes, Delete"
          confirmClass="danger"
          disabled={false}
          onConfirm={handleDeleteConfirm}
          onCancel={() => setDeleteTarget(null)}
        />
      )}

      {/* Mark Taken Confirmation Modal */}
      {confirmTarget && (
        <Modal
          icon="Rx"
          title="Confirm Medication Taken"
          message={`Please confirm you have actually taken ${confirmTarget.med.name} (${confirmTarget.med.dosage}) scheduled at ${formatTo12Hour(confirmTarget.slotTime)}.`}
          confirmText="Yes, I Took It"
          confirmClass="success"
          disabled={processing}
          onConfirm={handleTakenConfirm}
          onCancel={() => setConfirmTarget(null)}
        >
          <div style={{
            background: "var(--success-light)", borderRadius: "10px", padding: "12px",
            marginBottom: "20px", fontSize: "13px", color: "var(--success-hover)",
            fontWeight: "600"
          }}>
            {processing ? "Saving..." : "Confirming this will deduct 1 dose from your stock and log the time."}
          </div>
        </Modal>
      )}

      {/* Snooze Modal */}
      {snoozeTarget && (
        <div style={{
          position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)",
          display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000
        }}>
          <div style={{
            background: "white", borderRadius: "20px", padding: "30px",
            maxWidth: "340px", width: "90%", textAlign: "center",
            boxShadow: "0 20px 60px rgba(0,0,0,0.3)"
          }}>
            <div style={{ fontSize: "24px", fontWeight: "800", color: "var(--warning)", marginBottom: "12px" }}>Snooze</div>
            <h3 style={{ color: "#2d3748", marginBottom: "8px" }}>Snooze Reminder</h3>
            <p style={{ color: "#718096", marginBottom: "24px", fontSize: "14px" }}>
              Snooze <strong>{snoozeTarget.med.name}</strong> (scheduled at {formatTo12Hour(snoozeTarget.slotTime)}) reminder for:
            </p>
            <div style={{ display: "flex", gap: "12px", justifyContent: "center", marginBottom: "16px" }}>
              {[5, 10].map(min => (
                <button key={min} onClick={() => handleSnooze(snoozeTarget, min)} style={{
                  flex: 1, padding: "14px", background: "#fff3e0", color: "#f57c00",
                  border: "2px solid #ffcc80", borderRadius: "12px",
                  fontSize: "16px", fontWeight: "700", cursor: "pointer"
                }}>{min} min</button>
              ))}
            </div>
            <button onClick={() => setSnoozeTarget(null)} style={{
              width: "100%", padding: "11px", background: "#e2e8f0", color: "#2d3748",
              border: "none", borderRadius: "10px", fontWeight: "600", cursor: "pointer"
            }}>Cancel</button>
          </div>
        </div>
      )}

      {/* Guaranteed In-App Overlay Alerts */}
      {inAppAlerts.length > 0 && (
        <div style={{
          position: "fixed", top: 20, right: 20, zIndex: 9999,
          display: "flex", flexDirection: "column", gap: "12px"
        }}>
          {inAppAlerts.map((alertMed) => {
            const alarmSlotTime = alertMed.lastReminderSent ? alertMed.lastReminderSent.split(" ")[1] : (alertMed.times?.[0] || alertMed.time);
            return (
              <div key={alertMed._id} style={{
                background: "linear-gradient(135deg, #ef4444 0%, #dc2626 100%)", color: "white", 
                padding: "20px", borderRadius: "16px", boxShadow: "0 10px 30px rgba(239, 68, 68, 0.4)", 
                width: "320px", display: "flex", flexDirection: "column", gap: "10px",
                border: "1px solid rgba(255,255,255,0.2)"
              }}>
                <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                  <span style={{ fontWeight: "700", fontSize: "16px", letterSpacing: "0.5px" }}>REMINDER</span>
                </div>
                <div style={{ fontSize: "18px", fontWeight: "600", lineHeight: "1.3" }}>
                  Time to take your {alertMed.name}
                </div>
                <div style={{ opacity: 0.9, fontSize: "14px", marginBottom: "4px" }}>
                  Dosage: {alertMed.dosage} (scheduled: {formatTo12Hour(alarmSlotTime)})
                </div>
                
                <div style={{ display: "flex", gap: "10px", marginTop: "8px" }}>
                  <button onClick={() => {
                    setInAppAlerts(prev => prev.filter(m => m._id !== alertMed._id));
                    handleMarkTakenClick(alertMed, alarmSlotTime);
                  }} style={{
                    flex: 1, padding: "12px", background: "white", color: "#dc2626",
                    border: "none", borderRadius: "10px", fontWeight: "700", cursor: "pointer",
                    boxShadow: "0 4px 6px rgba(0,0,0,0.1)"
                  }}>Take Now</button>
                  <button onClick={() => {
                    setInAppAlerts(prev => prev.filter(m => m._id !== alertMed._id));
                    setSnoozeTarget({ med: alertMed, slotTime: alarmSlotTime });
                  }} style={{
                    flex: 1, padding: "12px", background: "rgba(255,255,255,0.2)", color: "white",
                    border: "1px solid rgba(255,255,255,0.3)", borderRadius: "10px", 
                    fontWeight: "700", cursor: "pointer"
                  }}>Snooze</button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}

export default MedicineList;

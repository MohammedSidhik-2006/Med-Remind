import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import AppShell from "../components/AppShell";
import Button from "../components/UI/Button";
import Card from "../components/UI/Card";
import Input from "../components/UI/Input";
import Badge from "../components/UI/Badge";
import API from "../services/api";
import styles from "./AddMedicinePage.module.css";

const FREQ = { once: 1, twice: 2, thrice: 3, four: 4 };
const FREQ_LABELS = {
  once:   { label: "Once Daily",       icon: "1x" },
  twice:  { label: "Twice Daily",      icon: "2x" },
  thrice: { label: "Thrice Daily",     icon: "3x" },
  four:   { label: "Four Times Daily", icon: "4x" }
};

const TIME_PERIODS = [
  { key: "morning",   label: "Morning",   icon: "🌅", hint: "05:00–11:59" },
  { key: "afternoon", label: "Afternoon", icon: "☀️", hint: "12:00–16:59" },
  { key: "evening",   label: "Evening",   icon: "🌇", hint: "17:00–20:59" },
  { key: "night",     label: "Night",     icon: "🌙", hint: "21:00–04:59" }
];

// compute today's date in local time (not UTC)
function getLocalToday() {
  const now = new Date();
  const pad = n => String(n).padStart(2, "0");
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

function AddMedicinePage() {
  const navigate = useNavigate();

  // Auth guard
  useEffect(() => {
    if (!localStorage.getItem("token")) navigate("/");
  }, [navigate]);

  const todayStr = getLocalToday();

  const [name,        setName]        = useState("");
  const [dosage,      setDosage]      = useState("");
  const [frequency,   setFrequency]   = useState("once");
  const [times,       setTimes]       = useState([""]);
  const [timePeriods, setTimePeriods] = useState([]);
  const [startDate,   setStartDate]   = useState(todayStr);
  const [endDate,     setEndDate]     = useState("");
  const [stock,       setStock]       = useState(30);
  const [refillAt,    setRefillAt]    = useState(7);
  const [notes,       setNotes]       = useState("");
  const [loading,     setLoading]     = useState(false);
  const [error,       setError]       = useState("");

  const handleFrequencyChange = (freq) => {
    setFrequency(freq);
    setTimes(Array(FREQ[freq]).fill(""));
  };

  const handleTimeChange = (index, value) => {
    const updated = [...times];
    updated[index] = value;
    setTimes(updated);
  };

  const togglePeriod = (key) => {
    setTimePeriods(prev =>
      prev.includes(key) ? prev.filter(p => p !== key) : [...prev, key]
    );
  };

  const addMedicine = async () => {
    setError("");

    if (!name.trim()) { setError("Medicine name is required."); return; }
    if (!dosage.trim()) { setError("Dosage is required."); return; }
    if (times.some(t => !t)) { setError("Please set all medication times."); return; }
    if (endDate && endDate < startDate) { setError("End date cannot be before start date."); return; }

    setLoading(true);
    try {
      await API.post("/medicine/add", {
        name:        name.trim(),
        dosage:      dosage.trim(),
        times,
        timePeriods,
        frequency,
        time:        times[0],
        startDate,
        endDate,
        stock:       Number(stock),
        refillAt:    Number(refillAt),
        notes:       notes.trim()
      });
      navigate("/dashboard");
    } catch (err) {
      const msg = err.response?.data?.message
        || (err.message === "Network Error" ? "Cannot connect to server. Is the backend running?" : null)
        || "Failed to add medicine. Please try again.";
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <AppShell>
      <div className={styles.pageContainer}>
        {/* Page Header */}
        <div className={styles.pageHeader}>
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={() => navigate("/dashboard")}
            className={styles.backButton}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="m15 18-6-6 6-6"/>
            </svg>
            Back
          </Button>
          <div className={styles.pageHeaderContent}>
            <h1 className={styles.pageTitle}>Add New Medication</h1>
            <p className={styles.pageSubtitle}>Set up a medication schedule and tracking</p>
          </div>
        </div>

        <div className={styles.pageContent}>
          <Card className={styles.medicationFormCard}>
            <div className={styles.cardHeader}>
              <h2 className={styles.cardTitle}>Medication Details</h2>
              <p className={styles.cardSubtitle}>Enter your medication information and schedule</p>
            </div>

            <div className={styles.cardContent}>
              {/* Error Alert */}
              {error && (
                <div className={`${styles.alert} ${styles.alertError}`} role="alert">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="12" cy="12" r="10"/>
                    <path d="m15 9-6 6"/>
                    <path d="m9 9 6 6"/>
                  </svg>
                  <div className={styles.alertContent}>
                    <p className={styles.alertTitle}>Error</p>
                    <p className={styles.alertDescription}>{error}</p>
                  </div>
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    onClick={() => setError("")}
                    className={styles.alertClose}
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="m18 6-12 12"/>
                      <path d="m6 6 12 12"/>
                    </svg>
                  </Button>
                </div>
              )}

              <form className={styles.medicationForm} onSubmit={(e) => { e.preventDefault(); addMedicine(); }}>
                <div className={styles.formSection}>
                  <h3 className={styles.formSectionTitle}>Basic Information</h3>
                  <div className={styles.formGrid}>
                    <div className={styles.formField}>
                      <Input
                        label="Medicine Name"
                        placeholder="e.g., Glucotab, Metformin"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        required
                        icon={
                          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <rect width="7" height="18" x="3" y="3" rx="1"/>
                            <rect width="7" height="7" x="14" y="3" rx="1"/>
                            <rect width="7" height="7" x="14" y="14" rx="1"/>
                          </svg>
                        }
                      />
                    </div>

                    <div className={styles.formField}>
                      <Input
                        label="Dosage"
                        placeholder="e.g., 500mg, 1 tablet"
                        value={dosage}
                        onChange={(e) => setDosage(e.target.value)}
                        required
                        icon={
                          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M9 12h6"/>
                            <path d="M12 9v6"/>
                            <circle cx="12" cy="12" r="10"/>
                          </svg>
                        }
                      />
                    </div>
                  </div>
                </div>

                <div className={styles.formSection}>
                  <h3 className={styles.formSectionTitle}>Schedule Period</h3>
                  <div className={`${styles.formGrid} ${styles.gridCols2}`}>
                    <div className={styles.formField}>
                      <Input
                        type="date"
                        label="Start Date"
                        value={startDate}
                        onChange={(e) => setStartDate(e.target.value)}
                        min={todayStr}
                        required
                      />
                    </div>

                    <div className={styles.formField}>
                      <Input
                        type="date"
                        label="End Date (Optional)"
                        value={endDate}
                        onChange={(e) => setEndDate(e.target.value)}
                        min={startDate}
                        helpText="Leave empty for ongoing medication"
                      />
                    </div>
                  </div>
                </div>

                <div className={styles.formSection}>
                  <h3 className={styles.formSectionTitle}>Time Periods</h3>
                  <p className={styles.formSectionSubtitle}>Select when you typically take this medication</p>
                  <div className={styles.timePeriodsGrid}>
                    {TIME_PERIODS.map(({ key, label, icon, hint }) => (
                      <button
                        key={key}
                        type="button"
                        onClick={() => togglePeriod(key)}
                        className={`${styles.timePeriodCard} ${timePeriods.includes(key) ? styles.selected : ''}`}
                      >
                        <span className={styles.timePeriodIcon}>{icon}</span>
                        <span className={styles.timePeriodLabel}>{label}</span>
                        <span className={styles.timePeriodHint}>{hint}</span>
                        {timePeriods.includes(key) && (
                          <div className={styles.timePeriodSelectedIndicator}>
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                              <polyline points="20,6 9,17 4,12"/>
                            </svg>
                          </div>
                        )}
                      </button>
                    ))}
                  </div>
                </div>

                <div className={styles.formSection}>
                  <h3 className={styles.formSectionTitle}>Frequency</h3>
                  <p className={styles.formSectionSubtitle}>How many times per day?</p>
                  <div className={styles.frequencyGrid}>
                    {Object.entries(FREQ_LABELS).map(([key, { label, icon }]) => (
                      <button
                        key={key}
                        type="button"
                        onClick={() => handleFrequencyChange(key)}
                        className={`${styles.frequencyCard} ${frequency === key ? styles.selected : ''}`}
                      >
                        <span className={styles.frequencyIcon}>{icon}</span>
                        <span className={styles.frequencyLabel}>{label}</span>
                        {frequency === key && (
                          <div className={styles.frequencySelectedIndicator}>
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                              <polyline points="20,6 9,17 4,12"/>
                            </svg>
                          </div>
                        )}
                      </button>
                    ))}
                  </div>
                </div>

                <div className={styles.formSection}>
                  <h3 className={styles.formSectionTitle}>Specific Times</h3>
                  <p className={styles.formSectionSubtitle}>Set exact times for medication reminders</p>
                  <div className={styles.timesList}>
                    {times.map((time, index) => (
                      <div key={index} className={styles.timeInputRow}>
                        <Badge variant="neutral" size="sm">
                          {index + 1}
                        </Badge>
                        <Input
                          type="time"
                          value={time}
                          onChange={(e) => handleTimeChange(index, e.target.value)}
                          placeholder="Set time"
                          required
                        />
                      </div>
                    ))}
                  </div>
                </div>

                <div className={styles.formSection}>
                  <h3 className={styles.formSectionTitle}>Stock Management</h3>
                  <div className={`${styles.formGrid} ${styles.gridCols2}`}>
                    <div className={styles.formField}>
                      <Input
                        type="number"
                        label="Initial Stock"
                        placeholder="30"
                        value={stock}
                        onChange={(e) => setStock(e.target.value)}
                        min="0"
                        helpText="Number of doses you have"
                        icon={
                          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M3 9h18v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V9Z"/>
                            <path d="m3 9 2.45-4.9A2 2 0 0 1 7.24 3h9.52a2 2 0 0 1 1.8 1.1L21 9"/>
                            <path d="M12 3v6"/>
                          </svg>
                        }
                      />
                    </div>

                    <div className={styles.formField}>
                      <Input
                        type="number"
                        label="Refill Alert Threshold"
                        placeholder="7"
                        value={refillAt}
                        onChange={(e) => setRefillAt(e.target.value)}
                        min="0"
                        helpText="Alert when stock reaches this level"
                        icon={
                          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <triangle cx="12" cy="12" r="10"/>
                            <path d="m9 12 2 2 4-4"/>
                          </svg>
                        }
                      />
                    </div>
                  </div>
                </div>

                <div className={styles.formSection}>
                  <div className={styles.formField}>
                    <Input
                      label="Notes (Optional)"
                      placeholder="e.g., Take with food, avoid dairy products"
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      helpText="Any special instructions or reminders"
                      icon={
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                          <polyline points="14,2 14,8 20,8"/>
                          <line x1="16" y1="13" x2="8" y2="13"/>
                          <line x1="16" y1="17" x2="8" y2="17"/>
                          <polyline points="10,9 9,9 8,9"/>
                        </svg>
                      }
                    />
                  </div>
                </div>

                <div className={styles.infoCard}>
                  <div className={styles.infoCardIcon}>
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <circle cx="12" cy="12" r="10"/>
                      <path d="m9 12 2 2 4-4"/>
                    </svg>
                  </div>
                  <div className={styles.infoCardContent}>
                    <h4 className={styles.infoCardTitle}>Automatic Reminders</h4>
                    <p className={styles.infoCardText}>
                      Push notifications will be sent at each scheduled time. You'll also receive low stock alerts 
                      when your medication count drops to {refillAt} doses.
                    </p>
                  </div>
                </div>

                <div className={styles.formActions}>
                  <Button 
                    type="button" 
                    variant="secondary" 
                    onClick={() => navigate("/dashboard")}
                  >
                    Cancel
                  </Button>
                  <Button 
                    type="submit" 
                    variant="primary" 
                    loading={loading}
                  >
                    {loading ? "Adding Medication..." : "Add Medication Schedule"}
                  </Button>
                </div>
              </form>
            </div>
          </Card>
        </div>
      </div>
    </AppShell>
  );
}

export default AddMedicinePage;
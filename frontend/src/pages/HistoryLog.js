import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import AppShell from "../components/AppShell";
import Button from "../components/UI/Button";
import Card from "../components/UI/Card";
import Badge from "../components/UI/Badge";
import ProgressBar from "../components/UI/ProgressBar";
import API from "../services/api";

function HistoryLog() {
  const navigate = useNavigate();
  const [logs,    setLogs]    = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter,  setFilter]  = useState("all"); // "all" | "taken" | "missed"

  // Auth guard
  useEffect(() => {
    if (!localStorage.getItem("token")) navigate("/");
  }, [navigate]);

  const fetchLogs = useCallback(async () => {
    try {
      const res = await API.get("/medicine/logs?limit=300");
      setLogs(res.data);
    } catch (err) {
      console.error("Error fetching dose logs:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchLogs(); }, [fetchLogs]);

  const filtered = filter === "all" ? logs : logs.filter(l => l.status === filter);

  // Group entries by date (already sorted newest-first from backend)
  const grouped = filtered.reduce((acc, log) => {
    if (!acc[log.date]) acc[log.date] = [];
    acc[log.date].push(log);
    return acc;
  }, {});
  const dates = Object.keys(grouped).sort((a, b) => b.localeCompare(a));

  const countTaken  = logs.filter(l => l.status === "taken").length;
  const countMissed = logs.filter(l => l.status === "missed").length;
  const adherence   = logs.length > 0
    ? Math.round((countTaken / logs.length) * 100) : 0;

  return (
    <AppShell>
      <div className="page-container">
        {/* Page Header */}
        <div className="page-header">
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={() => navigate("/dashboard")}
            className="back-button"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="m15 18-6-6 6-6"/>
            </svg>
            Back
          </Button>
          <div className="page-header-content">
            <h1 className="page-title">Medication History</h1>
            <p className="page-subtitle">View your medication adherence logs and patterns</p>
          </div>
        </div>

        <div className="page-content">
          {/* Statistics Overview */}
          <div className="stats-grid">
            <Card className="stat-card total">
              <div className="stat-icon">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                  <polyline points="14,2 14,8 20,8"/>
                  <line x1="16" y1="13" x2="8" y2="13"/>
                  <line x1="16" y1="17" x2="8" y2="17"/>
                </svg>
              </div>
              <div className="stat-content">
                <div className="stat-value">{logs.length}</div>
                <div className="stat-label">Total Logs</div>
              </div>
            </Card>

            <Card className="stat-card success">
              <div className="stat-icon">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <polyline points="20,6 9,17 4,12"/>
                </svg>
              </div>
              <div className="stat-content">
                <div className="stat-value">{countTaken}</div>
                <div className="stat-label">Taken Doses</div>
              </div>
            </Card>

            <Card className="stat-card error">
              <div className="stat-icon">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="m18 6-12 12"/>
                  <path d="m6 6 12 12"/>
                </svg>
              </div>
              <div className="stat-content">
                <div className="stat-value">{countMissed}</div>
                <div className="stat-label">Missed Doses</div>
              </div>
            </Card>
          </div>

          {/* Overall Adherence */}
          {logs.length > 0 && (
            <Card className="adherence-card">
              <div className="card-header">
                <div className="adherence-header">
                  <h3 className="adherence-title">Overall Adherence Rate</h3>
                  <Badge 
                    variant={
                      adherence >= 80 ? "success" :
                      adherence >= 50 ? "warning" : "error"
                    }
                    size="lg"
                  >
                    {adherence}%
                  </Badge>
                </div>
              </div>
              <div className="card-content">
                <ProgressBar 
                  value={adherence} 
                  max={100}
                  variant={
                    adherence >= 80 ? "success" :
                    adherence >= 50 ? "warning" : "error"
                  }
                  showPercentage={false}
                />
                <div className="adherence-description">
                  <p>
                    {adherence >= 90 ? "Excellent adherence! Keep up the great work." :
                     adherence >= 80 ? "Good adherence. Try to maintain consistency." :
                     adherence >= 60 ? "Fair adherence. Consider setting more reminders." :
                     "Poor adherence. Please consult with your healthcare provider."}
                  </p>
                </div>
              </div>
            </Card>
          )}

          {/* Filter Tabs */}
          <div className="filter-tabs">
            <Button
              variant={filter === "all" ? "primary" : "ghost"}
              size="sm"
              onClick={() => setFilter("all")}
            >
              All Logs ({logs.length})
            </Button>
            <Button
              variant={filter === "taken" ? "success" : "ghost"}
              size="sm"
              onClick={() => setFilter("taken")}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polyline points="20,6 9,17 4,12"/>
              </svg>
              Taken ({countTaken})
            </Button>
            <Button
              variant={filter === "missed" ? "danger" : "ghost"}
              size="sm"
              onClick={() => setFilter("missed")}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="m18 6-12 12"/>
                <path d="m6 6 12 12"/>
              </svg>
              Missed ({countMissed})
            </Button>
          </div>

          {/* History Timeline */}
          <Card className="history-card">
            <div className="card-header">
              <h3 className="card-title">
                Medication Timeline
                {filtered.length !== logs.length && (
                  <Badge variant="neutral" size="sm">
                    Showing {filtered.length} of {logs.length}
                  </Badge>
                )}
              </h3>
            </div>

            <div className="card-content">
              {loading ? (
                <div className="loading-state">
                  <div className="loading-spinner">
                    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M21 12a9 9 0 11-6.219-8.56"/>
                    </svg>
                  </div>
                  <p>Loading medication history...</p>
                </div>
              ) : dates.length === 0 ? (
                <div className="empty-state">
                  <div className="empty-state-icon">
                    <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                      <path d="M9 12h6"/>
                      <path d="M12 9v6"/>
                      <circle cx="12" cy="12" r="10"/>
                    </svg>
                  </div>
                  <h4 className="empty-state-title">
                    {filter === "all" ? "No medication logs found" : `No ${filter} doses recorded`}
                  </h4>
                  <p className="empty-state-description">
                    {filter === "all" 
                      ? "Start taking your medications to build your adherence history."
                      : `No ${filter} medication doses have been recorded yet.`
                    }
                  </p>
                </div>
              ) : (
                <div className="timeline">
                  {dates.map(date => (
                    <div key={date} className="timeline-day">
                      {/* Date Header */}
                      <div className="timeline-date-header">
                        <div className="timeline-date">
                          <div className="date-text">
                            {new Date(date + "T00:00:00").toLocaleDateString("en-US", {
                              weekday: "short", 
                              day: "numeric", 
                              month: "short", 
                              year: "numeric"
                            })}
                          </div>
                        </div>
                        
                        <div className="timeline-date-divider" />
                        
                        <Badge 
                          variant={
                            grouped[date].every(l => l.status === "taken") ? "success" :
                            grouped[date].every(l => l.status === "missed") ? "error" : "warning"
                          }
                          size="sm"
                        >
                          {grouped[date].filter(l => l.status === "taken").length}/{grouped[date].length} Taken
                        </Badge>
                      </div>

                      {/* Timeline Items */}
                      <div className="timeline-items">
                        {grouped[date].map((log, i) => (
                          <div key={i} className={`timeline-item ${log.status}`}>
                            <div className="timeline-item-indicator">
                              {log.status === "taken" ? (
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                                  <polyline points="20,6 9,17 4,12"/>
                                </svg>
                              ) : (
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                                  <path d="m18 6-12 12"/>
                                  <path d="m6 6 12 12"/>
                                </svg>
                              )}
                            </div>

                            <div className="timeline-item-content">
                              <div className="timeline-item-header">
                                <h5 className="medication-name">{log.medicineName}</h5>
                                <Badge 
                                  variant={log.status === "taken" ? "success" : "danger"}
                                  size="sm"
                                >
                                  {log.status === "taken" ? "Taken" : "Missed"}
                                </Badge>
                              </div>

                              <div className="timeline-item-details">
                                {log.dosage && (
                                  <div className="detail-item">
                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                      <rect width="7" height="18" x="3" y="3" rx="1"/>
                                      <rect width="7" height="7" x="14" y="3" rx="1"/>
                                      <rect width="7" height="7" x="14" y="14" rx="1"/>
                                    </svg>
                                    <span>Dosage: {log.dosage}</span>
                                  </div>
                                )}
                                
                                {log.scheduledTime && (
                                  <div className="detail-item">
                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                      <circle cx="12" cy="12" r="10"/>
                                      <polyline points="12,6 12,12 16,14"/>
                                    </svg>
                                    <span>Scheduled: {log.scheduledTime}</span>
                                  </div>
                                )}
                                
                                {log.takenAt && (
                                  <div className="detail-item taken-time">
                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                      <polyline points="20,6 9,17 4,12"/>
                                    </svg>
                                    <span>
                                      Taken: {new Date(log.takenAt).toLocaleTimeString("en-US", {
                                        hour: "2-digit", 
                                        minute: "2-digit"
                                      })}
                                    </span>
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </Card>
        </div>
      </div>
      
      <style jsx>{`
        .page-container {
          max-width: 900px;
          margin: 0 auto;
          padding: var(--spacing-6);
        }

        .page-header {
          margin-bottom: var(--spacing-8);
        }

        .back-button {
          margin-bottom: var(--spacing-4);
        }

        .page-header-content h1 {
          margin: 0 0 var(--spacing-2) 0;
          color: var(--text-primary);
        }

        .page-subtitle {
          color: var(--text-secondary);
          margin: 0;
          font-size: var(--font-sm);
        }

        .page-content {
          display: flex;
          flex-direction: column;
          gap: var(--spacing-6);
        }

        .stats-grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: var(--spacing-4);
        }

        .stat-card {
          display: flex;
          align-items: center;
          gap: var(--spacing-4);
          padding: var(--spacing-5);
        }

        .stat-card.total .stat-icon {
          color: var(--text-secondary);
          background: var(--gray-100);
        }

        .stat-card.success .stat-icon {
          color: var(--success-600);
          background: var(--success-50);
        }

        .stat-card.error .stat-icon {
          color: var(--error-600);
          background: var(--error-50);
        }

        .stat-icon {
          flex-shrink: 0;
          width: 48px;
          height: 48px;
          border-radius: var(--radius-lg);
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .stat-content {
          flex: 1;
        }

        .stat-value {
          font-size: var(--font-2xl);
          font-weight: var(--font-bold);
          color: var(--text-primary);
          line-height: 1;
        }

        .stat-label {
          font-size: var(--font-sm);
          color: var(--text-secondary);
          font-weight: var(--font-medium);
          margin-top: var(--spacing-1);
        }

        .adherence-card {
          margin-bottom: var(--spacing-2);
        }

        .adherence-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
        }

        .adherence-title {
          margin: 0;
          color: var(--text-primary);
          font-size: var(--font-lg);
          font-weight: var(--font-semibold);
        }

        .adherence-description {
          margin-top: var(--spacing-3);
        }

        .adherence-description p {
          margin: 0;
          color: var(--text-secondary);
          font-size: var(--font-sm);
        }

        .filter-tabs {
          display: flex;
          gap: var(--spacing-2);
          flex-wrap: wrap;
        }

        .history-card {
          flex: 1;
        }

        .loading-state {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: var(--spacing-4);
          padding: var(--spacing-8);
          color: var(--text-secondary);
        }

        .loading-spinner {
          animation: spin 1s linear infinite;
        }

        @keyframes spin {
          to {
            transform: rotate(360deg);
          }
        }

        .empty-state {
          display: flex;
          flex-direction: column;
          align-items: center;
          text-align: center;
          padding: var(--spacing-8);
          color: var(--text-secondary);
        }

        .empty-state-icon {
          margin-bottom: var(--spacing-4);
          color: var(--text-tertiary);
        }

        .empty-state-title {
          margin: 0 0 var(--spacing-2) 0;
          color: var(--text-primary);
          font-size: var(--font-lg);
          font-weight: var(--font-semibold);
        }

        .empty-state-description {
          margin: 0;
          color: var(--text-secondary);
          max-width: 400px;
        }

        .timeline {
          display: flex;
          flex-direction: column;
          gap: var(--spacing-6);
        }

        .timeline-day {
          position: relative;
        }

        .timeline-date-header {
          display: flex;
          align-items: center;
          gap: var(--spacing-4);
          margin-bottom: var(--spacing-4);
        }

        .timeline-date {
          flex-shrink: 0;
        }

        .date-text {
          font-size: var(--font-sm);
          font-weight: var(--font-bold);
          color: var(--text-secondary);
          text-transform: uppercase;
          letter-spacing: 0.05em;
        }

        .timeline-date-divider {
          flex: 1;
          height: 1px;
          background: var(--border-color);
        }

        .timeline-items {
          display: flex;
          flex-direction: column;
          gap: var(--spacing-3);
          position: relative;
        }

        .timeline-item {
          display: flex;
          align-items: flex-start;
          gap: var(--spacing-4);
          padding: var(--spacing-4);
          background: var(--surface);
          border-radius: var(--radius-lg);
          border: 1px solid var(--border-color);
          position: relative;
        }

        .timeline-item.taken {
          border-left: 4px solid var(--success-500);
          background: var(--success-50);
        }

        .timeline-item.missed {
          border-left: 4px solid var(--error-500);
          background: var(--error-50);
        }

        .timeline-item-indicator {
          flex-shrink: 0;
          width: 32px;
          height: 32px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          margin-top: var(--spacing-1);
        }

        .timeline-item.taken .timeline-item-indicator {
          background: var(--success-100);
          color: var(--success-700);
        }

        .timeline-item.missed .timeline-item-indicator {
          background: var(--error-100);
          color: var(--error-700);
        }

        .timeline-item-content {
          flex: 1;
          min-width: 0;
        }

        .timeline-item-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: var(--spacing-2);
        }

        .medication-name {
          margin: 0;
          color: var(--text-primary);
          font-size: var(--font-base);
          font-weight: var(--font-semibold);
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .timeline-item-details {
          display: flex;
          flex-direction: column;
          gap: var(--spacing-2);
        }

        .detail-item {
          display: flex;
          align-items: center;
          gap: var(--spacing-2);
          font-size: var(--font-sm);
          color: var(--text-secondary);
        }

        .detail-item.taken-time {
          color: var(--success-700);
          font-weight: var(--font-medium);
        }

        @media (max-width: 768px) {
          .page-container {
            padding: var(--spacing-4);
          }

          .stats-grid {
            grid-template-columns: 1fr;
          }

          .filter-tabs {
            flex-direction: column;
          }

          .timeline-item-header {
            flex-direction: column;
            align-items: flex-start;
            gap: var(--spacing-2);
          }

          .timeline-item-details {
            gap: var(--spacing-1);
          }
        }
      `}</style>
    </AppShell>
  );
}

export default HistoryLog;
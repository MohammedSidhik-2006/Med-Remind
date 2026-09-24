import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import AppShell from "../components/AppShell";
import Button from "../components/UI/Button";
import Card from "../components/UI/Card";
import Badge from "../components/UI/Badge";
import ProgressBar from "../components/UI/ProgressBar";
import API from "../services/api";

// Add spinning animation styles
const spinKeyframes = `
@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}
`;

// Inject styles
if (typeof document !== 'undefined') {
  const styleElement = document.createElement('style');
  styleElement.innerHTML = spinKeyframes;
  document.head.appendChild(styleElement);
}

// Local date string YYYY-MM-DD
function localDateStr(d = new Date()) {
  const pad = n => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
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

function CalendarView() {
  const navigate = useNavigate();
  const [currentDate,   setCurrentDate]   = useState(new Date());
  const [selectedDate,  setSelectedDate]  = useState(new Date()); // default to today for better UX
  const [reportData,    setReportData]    = useState([]);
  const [loading,       setLoading]       = useState(true);

  // Auth guard
  useEffect(() => {
    if (!localStorage.getItem("token")) navigate("/");
  }, [navigate]);

  const [allMedicines, setAllMedicines] = useState([]);

  const fetchReports = useCallback(async () => {
    try {
      const [resReports, resMeds] = await Promise.all([
        API.get("/medicine/reports?period=month"),
        API.get("/medicine")
      ]);
      setReportData(resReports.data.dailyData || []);
      setAllMedicines(resMeds.data || []); // resMeds.data is the array directly from controller
    } catch (err) {
      console.error("Calendar reports error:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchReports(); }, [fetchReports]);

  // Lookup by date string
  const dataByDate = reportData.reduce((acc, d) => { acc[d.date] = d; return acc; }, {});

  const todayStr = localDateStr();
  const year     = currentDate.getFullYear();
  const month    = currentDate.getMonth();
  const firstDay = new Date(year, month, 1).getDay();   // 0=Sun
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const MONTHS = ["January","February","March","April","May","June",
                  "July","August","September","October","November","December"];

  const getDayDot = (dayStr) => {
    const d = dataByDate[dayStr];
    if (!d || d.total === 0) return null;
    if (d.adherence === 100) return "var(--success)";
    if (d.adherence >= 50)  return "var(--warning)";
    return "var(--danger)";
  };

  const selectedStr  = selectedDate ? localDateStr(selectedDate) : null;
  const selectedData = selectedStr  ? dataByDate[selectedStr]    : null;

  // Filter scheduled medicines active on selectedDate
  const scheduledForSelected = selectedStr ? allMedicines.filter(m => {
    if (m.startDate && selectedStr < m.startDate) return false;
    if (m.endDate && selectedStr > m.endDate) return false;
    return true;
  }) : [];

  const prevMonth = () => setCurrentDate(new Date(year, month - 1, 1));
  const nextMonth = () => setCurrentDate(new Date(year, month + 1, 1));

  return (
    <AppShell>
      <div style={{
        maxWidth: "1200px",
        margin: "0 auto", 
        padding: "var(--space-6)"
      }}>
        {/* Page Header */}
        <div style={{ marginBottom: "var(--space-8)" }}>
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={() => navigate("/dashboard")}
            style={{ marginBottom: "var(--space-4)" }}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="m15 18-6-6 6-6"/>
            </svg>
            Back
          </Button>
          <div>
            <h1 style={{ margin: "0 0 var(--space-2) 0", color: "var(--text-primary)" }}>Medication Calendar</h1>
            <p style={{ color: "var(--text-secondary)", margin: "0" }}>Track your medication schedule and adherence history</p>
          </div>
        </div>

        <div style={{
          display: "grid",
          gridTemplateColumns: "1fr 400px",
          gap: "var(--space-6)",
          alignItems: "start"
        }}>
          {/* Calendar Card */}
          <Card>
            <div style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              padding: "var(--space-6)",
              borderBottom: "1px solid var(--border)"
            }}>
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={prevMonth}
                style={{
                  width: "40px",
                  height: "40px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center"
                }}
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="m15 18-6-6 6-6"/>
                </svg>
              </Button>
              
              <div style={{ textAlign: "center" }}>
                <h2 style={{ margin: "0", color: "var(--text-primary)", fontWeight: "800" }}>{MONTHS[month]} {year}</h2>
                <p style={{ margin: "var(--space-1) 0 0", color: "var(--text-secondary)" }}>Click any date to view details</p>
              </div>
              
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={nextMonth}
                style={{
                  width: "40px",
                  height: "40px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center"
                }}
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="m9 18 6-6-6-6"/>
                </svg>
              </Button>
            </div>

            {/* Calendar Grid */}
            <div style={{ padding: "var(--space-6)" }}>
              {/* Day Headers */}
              <div style={{
                display: "grid",
                gridTemplateColumns: "repeat(7, 1fr)",
                gap: "var(--space-1)",
                marginBottom: "var(--space-4)"
              }}>
                {["Sun","Mon","Tue","Wed","Thu","Fri","Sat"].map(day => (
                  <div key={day} style={{
                    textAlign: "center",
                    padding: "var(--space-2) 0",
                    fontSize: "12px",
                    fontWeight: "800",
                    color: "var(--text-muted)",
                    textTransform: "uppercase",
                    letterSpacing: "0.05em"
                  }}>{day}</div>
                ))}
              </div>

              {/* Calendar Days */}
              <div style={{
                display: "grid",
                gridTemplateColumns: "repeat(7, 1fr)",
                gap: "var(--space-1)"
              }}>
                {/* Empty cells for offset */}
                {Array(firstDay).fill(null).map((_, i) => (
                  <div key={`empty-${i}`} />
                ))}

                {/* Day cells */}
                {Array(daysInMonth).fill(null).map((_, i) => {
                  const day    = i + 1;
                  const pad    = n => String(n).padStart(2, "0");
                  const dayStr = `${year}-${pad(month + 1)}-${pad(day)}`;
                  const isToday    = dayStr === todayStr;
                  const isSelected = dayStr === selectedStr;
                  const dot        = getDayDot(dayStr);
                  const isFuture   = dayStr > todayStr;

                  return (
                    <div
                      key={day}
                      onClick={() => setSelectedDate(new Date(year, month, day))}
                      style={{
                        position: "relative",
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "center",
                        justifyContent: "center",
                        minHeight: "48px",
                        padding: "var(--space-2)",
                        borderRadius: "var(--radius-md)",
                        cursor: "pointer",
                        transition: "all var(--duration-normal) var(--ease)",
                        border: "2px solid transparent",
                        background: isSelected ? "var(--primary)" : isToday ? "var(--primary-light)" : "transparent",
                        color: isSelected ? "white" : isToday ? "var(--primary)" : isFuture ? "var(--text-subtle)" : "var(--text-primary)",
                        fontWeight: isToday || isSelected ? "800" : "600",
                        ...(isToday && !isSelected ? { borderColor: "var(--primary)" } : {})
                      }}
                    >
                      <span style={{ fontWeight: "600" }}>{day}</span>
                      {dot && (
                        <div style={{
                          width: "6px",
                          height: "6px",
                          borderRadius: "50%",
                          backgroundColor: isSelected ? "white" : dot,
                          marginTop: "var(--space-1)"
                        }} />
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Legend */}
            <div style={{
              display: "flex",
              justifyContent: "center",
              gap: "var(--space-6)",
              padding: "var(--space-4) var(--space-6)",
              borderTop: "1px solid var(--border)"
            }}>
              {[
                { color: "var(--success)", label: "Perfect Compliance" },
                { color: "var(--warning)", label: "Partial Doses" },
                { color: "var(--danger)", label: "Missed Doses" }
              ].map(({ color, label }) => (
                <div key={label} style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "var(--space-2)"
                }}>
                  <div style={{
                    width: "8px",
                    height: "8px",
                    borderRadius: "50%",
                    backgroundColor: color
                  }} />
                  <span style={{
                    fontSize: "12px",
                    color: "var(--text-secondary)",
                    fontWeight: "500"
                  }}>{label}</span>
                </div>
              ))}
            </div>
          </Card>

          {/* Selected Date Details */}
          {selectedDate && (
            <Card style={{ position: "sticky", top: "var(--space-6)" }}>
              <div style={{
                display: "flex",
                alignItems: "flex-start",
                justifyContent: "space-between",
                padding: "var(--space-6) var(--space-6) 0"
              }}>
                <div style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "var(--space-3)"
                }}>
                  <h3 style={{
                    margin: "0",
                    color: "var(--text-primary)",
                    fontWeight: "600"
                  }}>
                    {selectedDate.toLocaleDateString("en-US", {
                      weekday: "long", 
                      day: "numeric", 
                      month: "long", 
                      year: "numeric"
                    })}
                  </h3>
                  {selectedStr === todayStr && (
                    <Badge variant="info" size="sm">Today</Badge>
                  )}
                </div>
              </div>

              <div style={{ padding: "0 var(--space-6) var(--space-6)" }}>
                {loading ? (
                  <div style={{
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    gap: "var(--space-4)",
                    padding: "var(--space-8)",
                    color: "var(--text-secondary)"
                  }}>
                    <div style={{ animation: "spin 1s linear infinite" }}>
                      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M21 12a9 9 0 11-6.219-8.56"/>
                      </svg>
                    </div>
                    <p>Loading schedule details...</p>
                  </div>
                ) : (selectedData && selectedData.total > 0) || scheduledForSelected.length > 0 ? (
                  <>
                    {/* Adherence Stats */}
                    {selectedData && selectedData.total > 0 && (
                      <div style={{ marginBottom: "var(--space-6)" }}>
                        <h4 style={{
                          display: "flex",
                          alignItems: "center",
                          gap: "var(--space-2)",
                          margin: "0 0 var(--space-4) 0",
                          color: "var(--text-primary)",
                          fontWeight: "600"
                        }}>
                          Daily Adherence
                        </h4>
                        
                        <div style={{
                          display: "grid",
                          gridTemplateColumns: "repeat(3, 1fr)",
                          gap: "var(--space-3)",
                          marginBottom: "var(--space-4)"
                        }}>
                          <div style={{
                            textAlign: "center",
                            padding: "var(--space-4)",
                            borderRadius: "var(--radius-lg)",
                            border: "1px solid var(--success-soft)",
                            background: "var(--success-light)"
                          }}>
                            <div style={{
                              fontSize: "20px",
                              fontWeight: "800",
                              marginBottom: "var(--space-1)",
                              color: "var(--success-hover)"
                            }}>{selectedData.taken}</div>
                            <div style={{
                              fontSize: "12px",
                              color: "var(--text-secondary)",
                              fontWeight: "500"
                            }}>Taken</div>
                          </div>
                          <div style={{
                            textAlign: "center",
                            padding: "var(--space-4)",
                            borderRadius: "var(--radius-lg)",
                            border: "1px solid var(--danger-soft)",
                            background: "var(--danger-light)"
                          }}>
                            <div style={{
                              fontSize: "20px",
                              fontWeight: "800",
                              marginBottom: "var(--space-1)",
                              color: "var(--danger-hover)"
                            }}>{selectedData.missed}</div>
                            <div style={{
                              fontSize: "12px",
                              color: "var(--text-secondary)",
                              fontWeight: "500"
                            }}>Missed</div>
                          </div>
                          <div style={{
                            textAlign: "center",
                            padding: "var(--space-4)",
                            borderRadius: "var(--radius-lg)",
                            border: "1px solid var(--primary-soft)",
                            background: "var(--primary-light)"
                          }}>
                            <div style={{
                              fontSize: "20px",
                              fontWeight: "800",
                              marginBottom: "var(--space-1)",
                              color: "var(--primary-hover)"
                            }}>{selectedData.adherence ?? 0}%</div>
                            <div style={{
                              fontSize: "12px",
                              color: "var(--text-secondary)",
                              fontWeight: "500"
                            }}>Adherence Rate</div>
                          </div>
                        </div>

                        <ProgressBar 
                          value={selectedData.adherence ?? 0} 
                          max={100}
                          variant={
                            (selectedData.adherence ?? 0) >= 80 ? "success" :
                            (selectedData.adherence ?? 0) >= 50 ? "warning" : "error"
                          }
                        />
                      </div>
                    )}

                    {/* Scheduled Medications */}
                    <div style={{ marginTop: "var(--space-6)" }}>
                      <h4 style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "var(--space-2)",
                        margin: "0 0 var(--space-4) 0",
                        color: "var(--text-primary)",
                        fontWeight: "600"
                      }}>
                        Scheduled Medications 
                        <Badge variant="neutral" size="sm">
                          {scheduledForSelected.length}
                        </Badge>
                      </h4>
                      
                      <div style={{
                        display: "flex",
                        flexDirection: "column",
                        gap: "var(--space-3)"
                      }}>
                        {scheduledForSelected.map((med) => {
                          const times = med.times?.length > 0 ? med.times : [med.time];
                          return times.map((t, idx) => {
                            const logged = selectedData?.doseLogs?.find(l => 
                              l.medicineName === med.name && l.scheduledTime === t
                            );
                            const status = logged ? logged.status : 
                              (selectedStr > todayStr ? "scheduled" : "pending");

                            return (
                              <div key={`${med._id}-${t}-${idx}`} style={{
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "space-between",
                                padding: "var(--space-4)",
                                borderRadius: "var(--radius-lg)",
                                border: "1px solid var(--border)",
                                background: status === "taken" ? "var(--success-light)" : 
                                           status === "missed" ? "var(--danger-light)" : "var(--bg-card)",
                                transition: "all var(--duration-normal) var(--ease)",
                                ...(status === "taken" ? { borderLeft: "4px solid var(--success)" } : {}),
                                ...(status === "missed" ? { borderLeft: "4px solid var(--danger)" } : {})
                              }}>
                                <div style={{ flex: "1" }}>
                                  <div style={{
                                    fontWeight: "600",
                                    color: "var(--text-primary)",
                                    marginBottom: "var(--space-1)"
                                  }}>
                                    {med.name}
                                    <span style={{
                                      fontWeight: "400",
                                      color: "var(--text-secondary)",
                                      fontSize: "14px"
                                    }}>({med.dosage})</span>
                                  </div>
                                  <div style={{
                                    display: "flex",
                                    alignItems: "center",
                                    gap: "var(--space-2)",
                                    fontSize: "14px",
                                    color: "var(--text-secondary)"
                                  }}>
                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                      <circle cx="12" cy="12" r="10"/>
                                      <polyline points="12,6 12,12 16,14"/>
                                    </svg>
                                    {formatTo12Hour(t)}
                                    {logged?.takenAt && (
                                      <span style={{
                                        color: "var(--success)",
                                        fontWeight: "500"
                                      }}>
                                        • Taken at {new Date(logged.takenAt).toLocaleTimeString([], { 
                                          hour: '2-digit', 
                                          minute: '2-digit' 
                                        })}
                                      </span>
                                    )}
                                  </div>
                                </div>
                                
                                <Badge 
                                  variant={
                                    status === "taken" ? "success" :
                                    status === "missed" ? "danger" : "neutral"
                                  }
                                  size="sm"
                                >
                                  {status === "taken" ? "✓ Taken" :
                                   status === "missed" ? "✕ Missed" : "Pending"}
                                </Badge>
                              </div>
                            );
                          });
                        })}
                      </div>
                    </div>
                  </>
                ) : (
                  <div style={{
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    textAlign: "center",
                    padding: "var(--space-8)",
                    color: "var(--text-secondary)"
                  }}>
                    <div style={{ marginBottom: "var(--space-4)", color: "var(--text-muted)" }}>
                      <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                        <path d="M8 2v4"/>
                        <path d="M16 2v4"/>
                        <rect width="18" height="18" x="3" y="4" rx="2"/>
                        <path d="M3 10h18"/>
                      </svg>
                    </div>
                    <h4 style={{
                      margin: "0 0 var(--space-2) 0",
                      color: "var(--text-primary)",
                      fontWeight: "600"
                    }}>No medications scheduled</h4>
                    <p style={{
                      margin: "0",
                      color: "var(--text-secondary)",
                      maxWidth: "300px"
                    }}>
                      No active medication schedules are configured for this date.
                    </p>
                  </div>
                )}
              </div>
            </Card>
          )}
        </div>
      </div>
    </AppShell>
  );
}

export default CalendarView;
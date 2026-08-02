import { useEffect, useState } from "react";

// Returns stroke color based on progress %
const progressColor = (pct) => {
  if (pct === 0) return "#e11d48";       // bold medical rose
  if (pct < 50)  return "#f97316";       // orange
  if (pct < 100) return "#d97706";       // warm amber
  return "#059669";                      // emerald green
};



function DailyProgress({ medicines = [], onNextDose }) {
  const [progress, setProgress] = useState(0);
  const [taken, setTaken]       = useState(0);
  const [total, setTotal]       = useState(0);

  useEffect(() => {
    const now = new Date();
    const pad = n => String(n).padStart(2, "0");
    const today = `${now.getFullYear()}-${pad(now.getMonth()+1)}-${pad(now.getDate())}`;
    
    const active = medicines.filter(m => {
      if (m.startDate && today < m.startDate) return false;
      if (m.endDate   && today > m.endDate)   return false;
      return true;
    });

    let totalScheduled = 0;
    let totalCompleted = 0;

    active.forEach(m => {
      const schedCount = m.times?.length > 0 ? m.times.length : 1;
      totalScheduled += schedCount;
      totalCompleted += m.takenTodayCount || 0;
    });

    setTotal(totalScheduled);
    setTaken(totalCompleted);
    setProgress(totalScheduled > 0 ? Math.round((totalCompleted / totalScheduled) * 100) : 0);

    // Compute next upcoming dose for the banner
    if (onNextDose) {
      const nowMins = now.getHours() * 60 + now.getMinutes();
      let next = null;
      active.forEach(m => {
        const times = m.times?.length > 0 ? m.times : [m.time];
        times.forEach(t => {
          if (!t) return;
          const isSlotTaken = m.todayLogs?.some(l => l.scheduledTime === t && l.status === "taken");
          if (isSlotTaken) return;

          const [h, min] = t.split(":").map(Number);
          const tMins = h * 60 + min;
          if (tMins >= nowMins) {
            if (!next || tMins < next.mins) {
              next = { name: m.name, time: t, mins: tMins };
            }
          }
        });
      });
      onNextDose(next);
    }
  }, [medicines, onNextDose]);

  const circumference = 2 * Math.PI * 80;
  const strokeDashoffset = circumference - (progress / 100) * circumference;
  const color = progressColor(progress);
  return (
    <div className="progress-card" style={{ padding: "35px" }}>
      <div className="progress-header">
        <h3 style={{ fontSize: "18px", letterSpacing: "0.5px" }}>Daily Progress</h3>
        <div style={{ color: "var(--primary)", display: "flex", alignItems: "center" }}>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M22 12h-4l-3 9L9 3l-3 9H2"/>
          </svg>
        </div>
      </div>
      <div className="progress-circle">
        <svg width="100%" height="100%" viewBox="0 0 200 200">
          <defs>
            <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="3" result="blur" />
              <feComposite in="SourceGraphic" in2="blur" operator="over" />
            </filter>
          </defs>
          <circle cx="100" cy="100" r="80"
            stroke="rgba(203, 213, 225, 0.6)" strokeWidth="16" fill="rgba(248, 250, 252, 0.5)" />
          <circle cx="100" cy="100" r="80"
            stroke={color} strokeWidth="16" fill="none"
            strokeDasharray={circumference}
            strokeDashoffset={progress === 0 ? circumference - 1 : strokeDashoffset}
            strokeLinecap="round"
            filter="url(#glow)"
            style={{ transition: "stroke-dashoffset 0.6s ease, stroke 0.4s ease" }}
          />
        </svg>
        <div className="progress-text" style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
          <div className="progress-percentage" style={{ color, fontSize: "42px", fontWeight: "800", letterSpacing: "-1px" }}>{progress}%</div>
          <div className="progress-label" style={{ fontSize: "13px", fontWeight: "700", color: "var(--text-muted)", marginTop: "2px" }}>{taken} of {total} Doses</div>
        </div>
      </div>
    </div>
  );
}

export default DailyProgress;

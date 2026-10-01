import React, { lazy, Suspense, useEffect } from "react";
import { BrowserRouter, Routes, Route, useNavigate } from "react-router-dom";
import ErrorBoundary from "./components/ErrorBoundary";
import { ToastProvider } from "./components/Toast";
import LoadingSpinner from "./components/LoadingSpinner";
import { initOfflineNotifications, clearOfflineStorage } from "./services/offlineSync";

// Import design system
import "./styles/design-system.css";
import "./styles/components.css";

// Lazy-loaded page components for route-level code splitting & bundle size optimization
const Login = lazy(() => import("./pages/Login"));
const Register = lazy(() => import("./pages/Register"));
const ForgotPassword = lazy(() => import("./pages/ForgotPassword"));
const Dashboard = lazy(() => import("./pages/Dashboard"));
const AddMedicinePage = lazy(() => import("./pages/AddMedicinePage"));
const CalendarView = lazy(() => import("./pages/CalendarView"));
const HistoryLog = lazy(() => import("./pages/HistoryLog"));
const RefillTracker = lazy(() => import("./pages/RefillTracker"));
const Profile = lazy(() => import("./pages/Profile"));
const Reports = lazy(() => import("./pages/Reports"));
const Admin = lazy(() => import("./pages/Admin"));
const CaregiverLinking = lazy(() => import("./pages/CaregiverLinking"));
const CaregiverDashboard = lazy(() => import("./pages/CaregiverDashboard"));
const NotFound = lazy(() => import("./pages/NotFound"));

/**
 * SessionGuard — Listens for the "medremind-session-expired" custom event
 * dispatched by the API interceptor (api.js) when a 401 response is received
 * on any protected route. Uses React Router's navigate() so the app NEVER
 * triggers a full browser page reload when a session expires.
 */
function SessionGuard() {
  const navigate = useNavigate();
  useEffect(() => {
    const handleSessionExpired = async () => {
      await clearOfflineStorage();
      navigate("/", { replace: true });
    };
    window.addEventListener("medremind-session-expired", handleSessionExpired);
    return () => window.removeEventListener("medremind-session-expired", handleSessionExpired);
  }, [navigate]);
  return null;
}

function App() {
  useEffect(() => {
    initOfflineNotifications();
  }, []);

  return (
    <ErrorBoundary>
      <ToastProvider>
        <BrowserRouter>
          <SessionGuard />
          <Suspense fallback={<LoadingSpinner />}>
            <Routes>
              <Route path="/" element={<Login />} />
              <Route path="/register" element={<Register />} />
              <Route path="/forgot-password" element={<ForgotPassword />} />
              <Route path="/dashboard" element={<Dashboard />} />
              <Route path="/add-medicine" element={<AddMedicinePage />} />
              <Route path="/calendar" element={<CalendarView />} />
              <Route path="/history" element={<HistoryLog />} />
              <Route path="/refill" element={<RefillTracker />} />
              <Route path="/profile" element={<Profile />} />
              <Route path="/reports" element={<Reports />} />
              <Route path="/admin" element={<Admin />} />
              <Route path="/caregiver/link" element={<CaregiverLinking />} />
              <Route path="/caregiver/dashboard" element={<CaregiverDashboard />} />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </Suspense>
        </BrowserRouter>
      </ToastProvider>
    </ErrorBoundary>
  );
}

export default App;
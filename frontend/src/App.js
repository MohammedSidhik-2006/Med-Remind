import React, { lazy, Suspense } from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import ErrorBoundary from "./components/ErrorBoundary";
import { ToastProvider } from "./components/Toast";
import LoadingSpinner from "./components/LoadingSpinner";

// Import design system
import "./styles/design-system.css";

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

function App() {
  return (
    <ErrorBoundary>
      <ToastProvider>
        <BrowserRouter>
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
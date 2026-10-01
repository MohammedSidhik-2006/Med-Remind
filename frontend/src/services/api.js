import axios from "axios";

// Determine the API base URL
// Priority: REACT_APP_API_URL env var → runtime hostname check → fallback to Render
const getBaseURL = () => {
  if (process.env.REACT_APP_API_URL) {
    return process.env.REACT_APP_API_URL.replace(/\/+$/, "");
  }
  const hostname = typeof window !== "undefined" ? window.location.hostname : "";
  if (hostname === "localhost" || hostname === "127.0.0.1") {
    return "http://localhost:5000";
  }
  return "https://medi-time-2peh.onrender.com";
};

const API = axios.create({
  baseURL: getBaseURL(),
  timeout: 60000 // 60s timeout to gracefully accommodate Render cold starts
});

// Request interceptor: normalize endpoint paths & attach JWT token
API.interceptors.request.use(
  (req) => {
    // If the base URL does not end with /api, and the request URL doesn't start with /api or http,
    // ensure /api prefix is present so requests match standard backend routes
    const currentBase = (req.baseURL || "").replace(/\/+$/, "");
    if (!currentBase.endsWith("/api") && req.url && !req.url.startsWith("/api") && !req.url.startsWith("http")) {
      const cleanUrl = req.url.startsWith("/") ? req.url : `/${req.url}`;
      req.url = `/api${cleanUrl}`;
    }

    const token = localStorage.getItem("token");
    if (token) {
      req.headers.Authorization = token.startsWith("Bearer ") ? token : `Bearer ${token}`;
    }
    return req;
  },
  (error) => Promise.reject(error)
);

// Response interceptor: handle token expirations and network errors
API.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      // Do NOT redirect or clear storage if the 401 comes from login/register/password-reset attempts
      const isAuthAttempt =
        err.config?.url?.includes("/auth/login") ||
        err.config?.url?.includes("/auth/register") ||
        err.config?.url?.includes("/auth/forgot-password") ||
        err.config?.url?.includes("/auth/reset-password");

      if (!isAuthAttempt) {
        localStorage.removeItem("token");
        if (typeof window !== "undefined") {
          const path = window.location.pathname;
          if (path !== "/" && path !== "/register" && path !== "/forgot-password") {
            // Dispatch a custom event so the SessionGuard in App.js can
            // navigate via React Router without triggering a full page reload.
            window.dispatchEvent(new CustomEvent("medremind-session-expired"));
          }
        }
      }
    }
    return Promise.reject(err);
  }
);

export default API;

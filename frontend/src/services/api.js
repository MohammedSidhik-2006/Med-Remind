import axios from "axios";

// Determine the API base URL
// Priority: REACT_APP_API_URL env var → runtime hostname check → fallback to Render
const getBaseURL = () => {
  // 1. Explicit env var (set in Vercel dashboard) always wins
  if (process.env.REACT_APP_API_URL) {
    const base = process.env.REACT_APP_API_URL.replace(/\/+$/, "");
    return base.endsWith("/api") ? base : `${base}/api`;
  }
  // 2. Runtime check — cannot be tree-shaken since window is evaluated at runtime
  const hostname = typeof window !== "undefined" ? window.location.hostname : "";
  if (hostname === "localhost" || hostname === "127.0.0.1") {
    return "http://localhost:5000/api";
  }
  // 3. Production fallback — always goes to Render backend
  return "https://medi-time-2peh.onrender.com/api";
};

const API = axios.create({
  baseURL: getBaseURL(),
  timeout: 15000
});


// Attach JWT token to every request
API.interceptors.request.use((req) => {
  const token = localStorage.getItem("token");
  if (token) {
    req.headers.Authorization = token;
  }
  return req;
});

// On 401 (expired / invalid token), clear storage and redirect to login
API.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      localStorage.removeItem("token");
      // Only redirect if not already on the login/register/forgot-password page
      if (!window.location.pathname.match(/^\/(register|forgot-password)?$/)) {
        window.location.href = "/";
      }
    }
    return Promise.reject(err);
  }
);

export default API;

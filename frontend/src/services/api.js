import axios from "axios";

const getBaseURL = () => {
  if (process.env.REACT_APP_API_URL) {
    const url = process.env.REACT_APP_API_URL;
    // Normalize: strip trailing slash, ensure it ends with /api
    const base = url.replace(/\/+$/, "");
    return base.endsWith("/api") ? base : `${base}/api`;
  }
  const hostname = window.location.hostname;
  // On localhost: connect to local backend normally
  if (hostname === "localhost" || hostname === "127.0.0.1") {
    return "http://localhost:5000/api";
  }
  // On production: default to deployed Render backend if REACT_APP_API_URL is unset
  return "https://medi-time-2peh.onrender.com/api";
};

const API = axios.create({
  baseURL: getBaseURL()
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

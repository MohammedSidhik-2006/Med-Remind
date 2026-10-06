const { rateLimit, MemoryStore } = require("express-rate-limit");

const store = new MemoryStore();

const rateLimitAuth = rateLimit({
  store,
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: process.env.NODE_ENV === "test" ? 1000 : 15, // Limit each IP per window
  message: { message: "Too many attempts. Try again in 15 minutes." },
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
});

const loginAttempts = {
  clear: () => {
    try {
      store.resetAll();
    } catch (e) {
      console.warn("Could not reset rate limit store:", e.message);
    }
  }
};

module.exports = { rateLimitAuth, loginAttempts };

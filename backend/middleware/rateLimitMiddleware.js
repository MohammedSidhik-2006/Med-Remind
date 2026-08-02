const loginAttempts = new Map();

const rateLimitAuth = (req, res, next) => {
  const ip = req.ip || req.connection.remoteAddress;
  const now = Date.now();
  const key = `${ip}:${req.path}`;
  const entry = loginAttempts.get(key) || { count: 0, resetAt: now + 15 * 60 * 1000 };

  if (now > entry.resetAt) {
    entry.count = 0;
    entry.resetAt = now + 15 * 60 * 1000;
  }
  entry.count++;
  loginAttempts.set(key, entry);

  if (entry.count > 10) {
    return res.status(429).json({ message: "Too many attempts. Try again in 15 minutes." });
  }
  next();
};

// Cleanup routine
setInterval(() => {
  const now = Date.now();
  for (const [key, val] of loginAttempts.entries()) {
    if (now > val.resetAt) loginAttempts.delete(key);
  }
}, 30 * 60 * 1000);

module.exports = { rateLimitAuth, loginAttempts };

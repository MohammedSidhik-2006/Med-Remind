const jwt = require("jsonwebtoken");

const authMiddleware = (req, res, next) => {
  const token = req.headers.authorization;

  if (!token || typeof token !== "string") {
    return res.status(401).json({ message: "Access denied. No token provided." });
  }

  try {
    const actualToken = token.startsWith("Bearer ") ? token.slice(7) : token;
    if (!actualToken) {
      return res.status(401).json({ message: "Access denied. Invalid token format." });
    }
    const verified = jwt.verify(actualToken, process.env.JWT_SECRET);
    req.user = verified;
    next();
  } catch (error) {
    if (error.name === "TokenExpiredError") {
      return res.status(401).json({ message: "Session expired. Please log in again." });
    }
    return res.status(401).json({ message: "Invalid token." });
  }
};

module.exports = authMiddleware;

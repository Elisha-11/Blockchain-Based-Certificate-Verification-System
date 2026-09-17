const rateLimit = require('express-rate-limit');

// Brute-force protection for login/register: narrow window, low ceiling.
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many attempts. Please try again later.' }
});

// Public verification endpoint: looser, since legitimate scanning/lookup traffic is expected.
const verifyLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 60,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many verification requests. Please try again later.' }
});

module.exports = { authLimiter, verifyLimiter };

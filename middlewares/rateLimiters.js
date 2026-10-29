const rateLimit = require('express-rate-limit');

// Limits are per IP address. They can be tuned with environment variables.
const minutes = (n) => n * 60 * 1000;

const limiter = (limit, windowMs, message) =>
  rateLimit({
    windowMs,
    limit,
    standardHeaders: 'draft-7', // RateLimit header tells clients when they can retry
    legacyHeaders: false,
    message: { message }
  });

const loginLimiter = limiter(
  Number(process.env.LOGIN_RATE_LIMIT) || 10,
  minutes(15),
  'Too many login attempts. Please try again in 15 minutes.'
);

const signupLimiter = limiter(
  Number(process.env.SIGNUP_RATE_LIMIT) || 5,
  minutes(60),
  'Too many sign-up attempts. Please try again later.'
);

module.exports = { loginLimiter, signupLimiter };

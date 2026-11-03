// Builds the Express app without starting it, so tests can use it directly.
const path = require('path');
const express = require('express');
const helmet = require('helmet');
const cors = require('cors');

const taskRoutes = require('./routes/taskRoutes');
const userRoutes = require('./routes/userRoutes');
const cronRoutes = require('./routes/cronRoutes');
const { notFound, errorHandler } = require('./middlewares/errorHandler');
const { validateEnv } = require('./config/env');

// On Vercel this file is the entry point (server.js is only used for `npm start`),
// so check the required settings here too and fail with a clear message.
if (process.env.VERCEL) {
  const { errors } = validateEnv();
  if (errors.length > 0) throw new Error(`Missing configuration: ${errors.join(', ')}`);
}

const app = express();

// Render (and most hosts) sit behind a proxy; needed for correct client IPs in rate limiting.
app.set('trust proxy', 1);

// Security headers. upgrade-insecure-requests is turned off so the site also works on http://localhost.
app.use(
  helmet({
    contentSecurityPolicy: { directives: { upgradeInsecureRequests: null } }
  })
);

// CORS: only origins listed in CORS_ORIGINS (comma-separated) get cross-origin access.
// The frontend is served from the same origin, so it never needs CORS.
const allowedOrigins = (process.env.CORS_ORIGINS || '')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);

app.use(
  cors({
    origin: (origin, callback) => callback(null, !origin || allowedOrigins.includes(origin))
  })
);

app.use(express.json({ limit: '100kb' }));

app.use('/api/tasks', taskRoutes);
app.use('/api/auth', userRoutes);
app.use('/api/cron', cronRoutes);
app.use('/api', notFound);

// Pages, CSS and browser JavaScript. Locally Express serves them; on Vercel the
// public/ folder is served by Vercel's CDN instead.
app.use(express.static(path.join(__dirname, 'public')));

app.use(errorHandler);

module.exports = app;

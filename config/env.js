// Checks environment variables at startup.
// Required variables stop the app with a clear message; optional ones only warn.

const REQUIRED = ['DATABASE_URL', 'JWT_SECRET'];
const MIN_JWT_SECRET_LENGTH = 16;

function validateEnv(env = process.env) {
  const errors = [];
  const warnings = [];

  for (const name of REQUIRED) {
    if (!env[name] || !String(env[name]).trim()) {
      errors.push(`${name} is required`);
    }
  }

  // A warning, not an error, so an existing deployment with a shorter secret keeps running.
  if (env.JWT_SECRET && env.JWT_SECRET.length < MIN_JWT_SECRET_LENGTH) {
    warnings.push(`JWT_SECRET is shorter than ${MIN_JWT_SECRET_LENGTH} characters: use a longer random value`);
  }

  if (env.PORT && !/^\d+$/.test(env.PORT)) {
    errors.push('PORT must be a number');
  }

  if (!env.MAIL_USER || !env.MAIL_PASS) {
    warnings.push('MAIL_USER/MAIL_PASS not set: emails will be skipped');
  }
  if (!env.CRON_SECRET) {
    warnings.push('CRON_SECRET not set: the reminder endpoint is disabled');
  }
  if (!env.CORS_ORIGINS) {
    warnings.push('CORS_ORIGINS not set: only same-origin requests are allowed');
  }

  return { errors, warnings };
}

module.exports = { validateEnv, REQUIRED };

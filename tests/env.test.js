const { test } = require('node:test');
const assert = require('node:assert/strict');
const { validateEnv } = require('../config/env');

test('missing required variables are errors', () => {
  const { errors } = validateEnv({});
  assert.deepEqual(errors, ['DATABASE_URL is required', 'JWT_SECRET is required']);
});

test('a short JWT secret produces a warning', () => {
  const { errors, warnings } = validateEnv({ DATABASE_URL: 'postgres://x', JWT_SECRET: 'short' });
  assert.deepEqual(errors, []);
  assert.ok(warnings.some((w) => w.startsWith('JWT_SECRET is shorter')));
});

test('optional variables only produce warnings', () => {
  const { errors, warnings } = validateEnv({ DATABASE_URL: 'postgres://x', JWT_SECRET: 'a-long-enough-secret' });
  assert.deepEqual(errors, []);
  assert.equal(warnings.length, 3);
});

test('a complete configuration has no errors or warnings', () => {
  const result = validateEnv({
    DATABASE_URL: 'postgres://x',
    JWT_SECRET: 'a-long-enough-secret',
    MAIL_USER: 'a@b.co',
    MAIL_PASS: 'x',
    CRON_SECRET: 'y',
    CORS_ORIGINS: 'https://example.com'
  });
  assert.deepEqual(result, { errors: [], warnings: [] });
});

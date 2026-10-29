// Small limits so rate limiting can be tested quickly. Set before the app loads.
process.env.LOGIN_RATE_LIMIT = '3';
process.env.SIGNUP_RATE_LIMIT = '2';
process.env.CORS_ORIGINS = 'https://allowed.example';
process.env.CRON_SECRET = 'test-cron-secret';

const { api, prisma } = require('./helpers/setup');
const { test, describe, beforeEach } = require('node:test');
const assert = require('node:assert/strict');

beforeEach(() => prisma.$reset());

describe('security headers', () => {
  test('are set by helmet', async () => {
    const res = await api().get('/');
    assert.equal(res.headers['x-content-type-options'], 'nosniff');
    assert.ok(res.headers['content-security-policy']);
    assert.ok(res.headers['strict-transport-security']);
    assert.equal(res.headers['x-powered-by'], undefined);
  });
});

describe('CORS', () => {
  test('allows an approved origin', async () => {
    const res = await api().get('/api/tasks').set('Origin', 'https://allowed.example');
    assert.equal(res.headers['access-control-allow-origin'], 'https://allowed.example');
  });

  test('does not allow other origins', async () => {
    const res = await api().get('/api/tasks').set('Origin', 'https://evil.example');
    assert.equal(res.headers['access-control-allow-origin'], undefined);
  });
});

describe('rate limiting', () => {
  test('blocks repeated login attempts with 429', async () => {
    const statuses = [];
    for (let i = 0; i < 4; i++) {
      statuses.push((await api().post('/api/auth/login').send({ email: 'a@b.co', password: 'wrong' })).status);
    }
    assert.deepEqual(statuses, [401, 401, 401, 429]);
  });

  test('blocks repeated sign-ups with 429', async () => {
    const statuses = [];
    for (let i = 0; i < 3; i++) {
      statuses.push((await api().post('/api/auth/signup').send({ name: 'X', email: `x${i}@b.co`, password: 'password123' })).status);
    }
    assert.deepEqual(statuses, [201, 201, 429]);
  });
});

describe('error handling', () => {
  test('malformed JSON returns 400', async () => {
    const res = await api().post('/api/auth/login').set('Content-Type', 'application/json').send('{"email":');
    assert.equal(res.status, 400);
    assert.equal(res.body.message, 'Request body is not valid JSON');
  });

  test('unknown API routes return a JSON 404', async () => {
    const res = await api().get('/api/does-not-exist');
    assert.equal(res.status, 404);
    assert.match(res.body.message, /Route not found/);
  });

  test('the reminder endpoint requires the secret key', async () => {
    assert.equal((await api().get('/api/cron/send-reminders')).status, 401);
    assert.equal((await api().get('/api/cron/send-reminders?key=wrong')).status, 401);
    const ok = await api().get('/api/cron/send-reminders').set('x-cron-secret', 'test-cron-secret');
    assert.equal(ok.status, 200);
    assert.deepEqual(ok.body, { checked: 0, sent: 0, skipped: 0, failed: 0 });
  });
});

const { api, prisma, createUser, tokenFor } = require('./helpers/setup');
const { test, describe, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const jwt = require('jsonwebtoken');

beforeEach(() => prisma.$reset());

describe('POST /api/auth/signup', () => {
  test('creates a user with a hashed password and lower-case email', async () => {
    const res = await api().post('/api/auth/signup').send({ name: 'Diya', email: 'Diya@Example.com', password: 'password123' });
    assert.equal(res.status, 201);
    assert.equal(res.body.email, 'diya@example.com');
    assert.equal(res.body.password, undefined);

    const [stored] = prisma.$rows('user');
    assert.notEqual(stored.password, 'password123');
    assert.equal(stored.role, 'user');
  });

  test('rejects invalid input with field errors', async () => {
    const res = await api().post('/api/auth/signup').send({ name: '', email: 'bad', password: '123' });
    assert.equal(res.status, 400);
    assert.deepEqual(res.body.errors.map((e) => e.field), ['name', 'email', 'password']);
  });

  test('rejects a duplicate email, ignoring case', async () => {
    await createUser({ email: 'diya@example.com' });
    const res = await api().post('/api/auth/signup').send({ name: 'Diya', email: 'DIYA@example.com', password: 'password123' });
    assert.equal(res.status, 409);
  });

  test('ignores a role sent in the body', async () => {
    const res = await api().post('/api/auth/signup').send({ name: 'X', email: 'x@example.com', password: 'password123', role: 'super_admin' });
    assert.equal(res.status, 201);
    assert.equal(prisma.$rows('user')[0].role, 'user');
  });
});

describe('POST /api/auth/login', () => {
  test('returns a token, role and permissions for valid credentials', async () => {
    const user = await createUser({ email: 'asha@example.com', role: 'admin' });
    const res = await api().post('/api/auth/login').send({ email: 'ASHA@example.com', password: user.plainPassword });
    assert.equal(res.status, 200);
    assert.equal(jwt.verify(res.body.token, process.env.JWT_SECRET).userId, user.id);
    assert.equal(res.body.user.role, 'admin');
    assert.deepEqual(res.body.user.permissions, ['users:read', 'tasks:read_all', 'tasks:assign']);
    assert.ok(prisma.$rows('user')[0].lastLogin instanceof Date);
  });

  test('gives the same 401 for a wrong password and an unknown email', async () => {
    await createUser({ email: 'asha@example.com' });
    const wrong = await api().post('/api/auth/login').send({ email: 'asha@example.com', password: 'wrong-pass1' });
    const unknown = await api().post('/api/auth/login').send({ email: 'nobody@example.com', password: 'password123' });
    assert.equal(wrong.status, 401);
    assert.equal(unknown.status, 401);
    assert.equal(wrong.body.message, unknown.body.message);
  });

  test('rejects missing fields', async () => {
    const res = await api().post('/api/auth/login').send({});
    assert.equal(res.status, 400);
  });
});

describe('protected routes', () => {
  test('need a token', async () => {
    assert.equal((await api().get('/api/tasks')).status, 401);
  });

  test('reject an invalid or expired token', async () => {
    const user = await createUser({ email: 'a@example.com' });
    const expired = jwt.sign({ userId: user.id, exp: Math.floor(Date.now() / 1000) - 10 }, process.env.JWT_SECRET);
    assert.equal((await api().get('/api/tasks').set('Authorization', 'Bearer not-a-token')).status, 401);
    assert.equal((await api().get('/api/tasks').set('Authorization', `Bearer ${expired}`)).status, 401);
    assert.equal((await api().get('/api/tasks').set('Authorization', tokenFor(user))).status, 401); // missing "Bearer"
  });
});

// Shared setup for API tests. Require this FIRST in every API test file.
// It swaps the real Prisma client for an in-memory fake, so tests need no database.
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-jwt-secret-that-is-long-enough';
process.env.LOGIN_RATE_LIMIT = process.env.LOGIN_RATE_LIMIT || '1000';
process.env.SIGNUP_RATE_LIMIT = process.env.SIGNUP_RATE_LIMIT || '1000';
delete process.env.MAIL_USER; // never send real emails from tests
delete process.env.MAIL_PASS;

const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const createFakePrisma = require('./fakePrisma');

const prisma = createFakePrisma();
const prismaPath = require.resolve('../../lib/prisma');
require.cache[prismaPath] = { id: prismaPath, filename: prismaPath, loaded: true, exports: prisma };

const request = require('supertest');
const app = require('../../app');

const api = () => request(app);

async function createUser({ name = 'Test User', email, password = 'password123', role = 'user' } = {}) {
  const user = await prisma.user.create({
    data: { name, email: email.toLowerCase(), password: await bcrypt.hash(password, 4), role }
  });
  return { ...user, plainPassword: password };
}

const tokenFor = (user) => jwt.sign({ userId: user.id }, process.env.JWT_SECRET, { expiresIn: '1h' });
const auth = (user) => ({ Authorization: `Bearer ${tokenFor(user)}` });

async function createTask(user, data = {}) {
  return prisma.task.create({ data: { title: 'A task', userId: user.id, ...data } });
}

const inDays = (days) => new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString();

module.exports = { api, prisma, createUser, createTask, tokenFor, auth, inDays };

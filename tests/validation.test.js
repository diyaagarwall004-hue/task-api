const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const { schemas } = require('../utils/validation');

const fields = (result) => result.errors.map((e) => e.field);
const future = new Date(Date.now() + 86400000).toISOString();

describe('signup validation', () => {
  test('accepts valid input and normalises it', () => {
    const { value, errors } = schemas.signup({ name: '  Diya ', email: ' Diya@Example.COM ', password: 'password123' });
    assert.deepEqual(errors, []);
    assert.equal(value.name, 'Diya');
    assert.equal(value.email, 'diya@example.com');
  });

  test('rejects missing name, bad email and weak password', () => {
    assert.deepEqual(fields(schemas.signup({ name: '', email: 'not-an-email', password: 'short' })), ['name', 'email', 'password']);
    assert.deepEqual(fields(schemas.signup({ name: 'A', email: 'a@b.co', password: 'onlyletters' })), ['password']);
    assert.deepEqual(fields(schemas.signup({ name: 'A', email: 'a@b.co', password: '12345678' })), ['password']);
  });

  test('rejects values that are too long', () => {
    const result = schemas.signup({ name: 'x'.repeat(101), email: 'a@b.co', password: 'p'.repeat(129) + '1' });
    assert.deepEqual(fields(result), ['name', 'password']);
  });
});

describe('login validation', () => {
  test('requires email and password but not password strength', () => {
    assert.deepEqual(schemas.login({ email: 'a@b.co', password: 'x' }).errors, []);
    assert.deepEqual(fields(schemas.login({})), ['email', 'password']);
  });
});

describe('task validation', () => {
  test('create: title required, description optional, due date must be in the future', () => {
    assert.deepEqual(schemas.createTask({ title: 'Report', dueDate: future }).errors, []);
    assert.equal(schemas.createTask({ title: 'Report', description: '' }).value.description, null);
    assert.deepEqual(fields(schemas.createTask({ title: '   ' })), ['title']);
    assert.deepEqual(fields(schemas.createTask({ title: 'x', dueDate: '2020-01-01T00:00:00Z' })), ['dueDate']);
    assert.deepEqual(fields(schemas.createTask({ title: 'x', dueDate: 'tomorrow' })), ['dueDate']);
  });

  test('update: keeps only allowed fields and validates status', () => {
    const { value, errors } = schemas.updateTask({ title: 'New', userId: 99, id: 5, createdAt: 'x' });
    assert.deepEqual(errors, []);
    assert.deepEqual(value, { title: 'New' });
    assert.deepEqual(fields(schemas.updateTask({ status: 'done' })), ['status']);
    assert.deepEqual(fields(schemas.updateTask({ userId: 2 })), ['body']);
  });

  test('assign: userId must be a positive whole number', () => {
    assert.equal(schemas.assignTask({ title: 'x', userId: '7' }).value.userId, 7);
    assert.deepEqual(fields(schemas.assignTask({ title: 'x', userId: 'abc' })), ['userId']);
  });
});

describe('list query validation', () => {
  test('applies defaults', () => {
    const { value, errors } = schemas.taskListQuery({});
    assert.deepEqual(errors, []);
    assert.deepEqual(value, { page: 1, limit: 10, search: undefined, sortBy: 'createdAt', order: 'desc' });
  });

  test('rejects bad paging, filters and sorting', () => {
    const result = schemas.taskListQuery({ page: '0', limit: '500', status: 'x', sortBy: 'password', order: 'up' });
    assert.deepEqual(fields(result), ['page', 'limit', 'status', 'sortBy', 'order']);
  });

  test('user list accepts a role filter', () => {
    assert.equal(schemas.userListQuery({ role: 'admin' }).value.role, 'admin');
    assert.deepEqual(fields(schemas.userListQuery({ role: 'boss' })), ['role']);
  });
});

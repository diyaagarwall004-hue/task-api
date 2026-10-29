const { api, prisma, createUser, createTask, auth, inDays } = require('./helpers/setup');
const { test, describe, beforeEach } = require('node:test');
const assert = require('node:assert/strict');

let owner;
let other;

beforeEach(async () => {
  prisma.$reset();
  owner = await createUser({ email: 'owner@example.com' });
  other = await createUser({ email: 'other@example.com' });
});

describe('task CRUD', () => {
  test('creates, reads, updates and deletes a task', async () => {
    const created = await api().post('/api/tasks').set(auth(owner)).send({ title: ' Report ', description: 'Q3', dueDate: inDays(2) });
    assert.equal(created.status, 201);
    assert.equal(created.body.title, 'Report');
    assert.equal(created.body.userId, owner.id);

    const id = created.body.id;
    const read = await api().get(`/api/tasks/${id}`).set(auth(owner));
    assert.equal(read.status, 200);

    const updated = await api().put(`/api/tasks/${id}`).set(auth(owner)).send({ status: 'completed', title: 'Final report' });
    assert.equal(updated.status, 200);
    assert.equal(updated.body.status, 'completed');
    assert.equal(updated.body.title, 'Final report');

    const removed = await api().delete(`/api/tasks/${id}`).set(auth(owner));
    assert.equal(removed.status, 200);
    assert.equal((await api().get(`/api/tasks/${id}`).set(auth(owner))).status, 404);
  });

  test('validates input', async () => {
    assert.equal((await api().post('/api/tasks').set(auth(owner)).send({ title: '' })).status, 400);
    assert.equal((await api().post('/api/tasks').set(auth(owner)).send({ title: 'x', dueDate: '2020-01-01T00:00:00Z' })).status, 400);
    assert.equal((await api().get('/api/tasks/abc').set(auth(owner))).status, 400);
  });
});

describe('task update security', () => {
  test('only title, description, status and dueDate can change', async () => {
    const task = await createTask(owner);
    const res = await api().put(`/api/tasks/${task.id}`).set(auth(owner))
      .send({ title: 'Still mine', userId: other.id, id: 999, createdAt: '2000-01-01T00:00:00Z' });
    assert.equal(res.status, 200);
    assert.equal(res.body.userId, owner.id);
    assert.equal(res.body.id, task.id);
    assert.notEqual(new Date(res.body.createdAt).getUTCFullYear(), 2000);
  });

  test('a body with only forbidden fields is rejected', async () => {
    const task = await createTask(owner);
    const res = await api().put(`/api/tasks/${task.id}`).set(auth(owner)).send({ userId: other.id });
    assert.equal(res.status, 400);
  });

  test('an invalid status is rejected', async () => {
    const task = await createTask(owner);
    assert.equal((await api().put(`/api/tasks/${task.id}`).set(auth(owner)).send({ status: 'done' })).status, 400);
  });

  test("users cannot read, update or delete someone else's task", async () => {
    const task = await createTask(owner, { title: 'Private' });
    assert.equal((await api().get(`/api/tasks/${task.id}`).set(auth(other))).status, 404);
    assert.equal((await api().put(`/api/tasks/${task.id}`).set(auth(other)).send({ title: 'Hacked' })).status, 404);
    assert.equal((await api().delete(`/api/tasks/${task.id}`).set(auth(other))).status, 404);
    assert.equal(prisma.$rows('task')[0].title, 'Private');
  });

  test('changing the due date restarts reminders', async () => {
    const task = await createTask(owner, { dueDate: new Date(inDays(1)), dayBeforeSentAt: new Date() });
    const res = await api().put(`/api/tasks/${task.id}`).set(auth(owner)).send({ dueDate: inDays(5) });
    assert.equal(res.status, 200);
    assert.equal(res.body.dayBeforeSentAt, null);
  });
});

describe('listing tasks', () => {
  test('returns only your own tasks, newest first, with pagination info', async () => {
    for (let i = 1; i <= 3; i++) await createTask(owner, { title: `Mine ${i}` });
    await createTask(other, { title: 'Not mine' });

    const res = await api().get('/api/tasks').set(auth(owner));
    assert.equal(res.status, 200);
    assert.deepEqual(res.body.tasks.map((t) => t.title), ['Mine 3', 'Mine 2', 'Mine 1']);
    assert.deepEqual(res.body.pagination, { page: 1, limit: 10, total: 3, totalPages: 1 });
  });

  test('a userId query cannot show other users\' tasks', async () => {
    await createTask(other, { title: 'Not mine' });
    const res = await api().get(`/api/tasks?userId=${other.id}`).set(auth(owner));
    assert.equal(res.body.tasks.length, 0);
  });

  test('paginates', async () => {
    for (let i = 1; i <= 5; i++) await createTask(owner, { title: `T${i}` });
    const res = await api().get('/api/tasks?page=2&limit=2').set(auth(owner));
    assert.deepEqual(res.body.tasks.map((t) => t.title), ['T3', 'T2']);
    assert.deepEqual(res.body.pagination, { page: 2, limit: 2, total: 5, totalPages: 3 });
  });

  test('filters by status and search text', async () => {
    await createTask(owner, { title: 'Write report', status: 'completed' });
    await createTask(owner, { title: 'Call client' });
    await createTask(owner, { title: 'Report review' });

    const done = await api().get('/api/tasks?status=completed').set(auth(owner));
    assert.deepEqual(done.body.tasks.map((t) => t.title), ['Write report']);

    const search = await api().get('/api/tasks?search=REPORT').set(auth(owner));
    assert.deepEqual(search.body.tasks.map((t) => t.title), ['Report review', 'Write report']);
  });

  test('sorts by due date with tasks without a due date last', async () => {
    await createTask(owner, { title: 'No date' });
    await createTask(owner, { title: 'Later', dueDate: new Date(inDays(5)) });
    await createTask(owner, { title: 'Sooner', dueDate: new Date(inDays(1)) });

    const res = await api().get('/api/tasks?sortBy=dueDate&order=asc').set(auth(owner));
    assert.deepEqual(res.body.tasks.map((t) => t.title), ['Sooner', 'Later', 'No date']);
  });

  test('rejects invalid query parameters', async () => {
    assert.equal((await api().get('/api/tasks?limit=1000').set(auth(owner))).status, 400);
    assert.equal((await api().get('/api/tasks?sortBy=password').set(auth(owner))).status, 400);
  });
});

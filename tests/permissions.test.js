const { api, prisma, createUser, createTask, auth, inDays } = require('./helpers/setup');
const { test, describe, beforeEach } = require('node:test');
const assert = require('node:assert/strict');

let user;
let admin;
let superAdmin;

beforeEach(async () => {
  prisma.$reset();
  user = await createUser({ name: 'User', email: 'user@example.com' });
  admin = await createUser({ name: 'Admin', email: 'admin@example.com', role: 'admin' });
  superAdmin = await createUser({ name: 'Boss', email: 'boss@example.com', role: 'super_admin' });
});

describe('normal users are denied admin routes', () => {
  const adminRoutes = [
    ['get', '/api/auth/users'],
    ['get', '/api/tasks/all/with-users'],
    ['get', '/api/tasks/all/count'],
    ['get', '/api/tasks/user/1'],
    ['post', '/api/tasks/assign'],
    ['post', '/api/tasks/assign-all'],
    ['patch', '/api/auth/users/2/role']
  ];

  for (const [method, path] of adminRoutes) {
    test(`${method.toUpperCase()} ${path} returns 403`, async () => {
      const res = await api()[method](path).set(auth(user)).send({});
      assert.equal(res.status, 403);
    });
  }
});

describe('admin access', () => {
  test('lists users with roles, task totals and recent tasks', async () => {
    await createTask(user, { status: 'completed' });
    await createTask(user);
    await createTask(user);

    const res = await api().get('/api/auth/users').set(auth(admin));
    assert.equal(res.status, 200);
    assert.equal(res.body.pagination.total, 3);
    const listed = res.body.users.find((u) => u.id === user.id);
    assert.equal(listed.role, 'user');
    assert.deepEqual(listed.taskStats, { total: 3, pending: 2, completed: 1 });
    assert.equal(listed.recentTasks.length, 3);
    assert.equal(listed.password, undefined);
  });

  test('filters users by role and search', async () => {
    const byRole = await api().get('/api/auth/users?role=admin').set(auth(admin));
    assert.deepEqual(byRole.body.users.map((u) => u.email), ['admin@example.com']);
    const bySearch = await api().get('/api/auth/users?search=BOSS').set(auth(admin));
    assert.deepEqual(bySearch.body.users.map((u) => u.email), ['boss@example.com']);
  });

  test('sees all tasks with owners, task counts and one user\'s tasks', async () => {
    await createTask(user, { title: 'U1' });
    await createTask(superAdmin, { title: 'S1', status: 'completed' });

    const all = await api().get('/api/tasks/all/with-users').set(auth(admin));
    assert.equal(all.status, 200);
    assert.deepEqual(all.body.tasks.map((t) => [t.title, t.user.email]), [['S1', 'boss@example.com'], ['U1', 'user@example.com']]);

    const counts = await api().get('/api/tasks/all/count').set(auth(admin));
    assert.deepEqual(counts.body, { total: 2, pending: 1, completed: 1 });

    const one = await api().get(`/api/tasks/user/${user.id}`).set(auth(admin));
    assert.equal(one.body.user.email, 'user@example.com');
    assert.deepEqual(one.body.tasks.map((t) => t.title), ['U1']);
    assert.equal((await api().get('/api/tasks/user/999').set(auth(admin))).status, 404);
  });

  test('assigns a task to a user and records who assigned it', async () => {
    const res = await api().post('/api/tasks/assign').set(auth(admin)).send({ title: 'Assigned', userId: user.id, dueDate: inDays(3) });
    assert.equal(res.status, 201);
    assert.equal(res.body.userId, user.id);
    assert.equal(res.body.assignedById, admin.id);
    assert.equal((await api().post('/api/tasks/assign').set(auth(admin)).send({ title: 'x', userId: 999 })).status, 404);
  });

  test('assigns a task to every user', async () => {
    const res = await api().post('/api/tasks/assign-all').set(auth(admin)).send({ title: 'Everyone' });
    assert.equal(res.status, 201);
    assert.equal(res.body.count, 3);
  });

  test('admins cannot change roles', async () => {
    const res = await api().patch(`/api/auth/users/${user.id}/role`).set(auth(admin)).send({ role: 'admin' });
    assert.equal(res.status, 403);
  });
});

describe('super admin role management', () => {
  test('can change another user\'s role, effective immediately', async () => {
    const res = await api().patch(`/api/auth/users/${user.id}/role`).set(auth(superAdmin)).send({ role: 'admin' });
    assert.equal(res.status, 200);
    assert.equal(res.body.role, 'admin');
    // The same token now has admin access, because the role is read from the database.
    assert.equal((await api().get('/api/auth/users').set(auth(user))).status, 200);
  });

  test('cannot change their own role', async () => {
    const res = await api().patch(`/api/auth/users/${superAdmin.id}/role`).set(auth(superAdmin)).send({ role: 'user' });
    assert.equal(res.status, 400);
  });

  test('can demote another super admin while at least one remains', async () => {
    const other = await createUser({ email: 'boss2@example.com', role: 'super_admin' });
    const res = await api().patch(`/api/auth/users/${other.id}/role`).set(auth(superAdmin)).send({ role: 'admin' });
    assert.equal(res.status, 200);
    assert.equal(prisma.$rows('user').filter((u) => u.role === 'super_admin').length, 1);
  });

  test('rejects an invalid role or user id', async () => {
    assert.equal((await api().patch(`/api/auth/users/${user.id}/role`).set(auth(superAdmin)).send({ role: 'boss' })).status, 400);
    assert.equal((await api().patch('/api/auth/users/abc/role').set(auth(superAdmin)).send({ role: 'admin' })).status, 400);
    assert.equal((await api().patch('/api/auth/users/999/role').set(auth(superAdmin)).send({ role: 'admin' })).status, 404);
  });
});

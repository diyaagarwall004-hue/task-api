const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const prisma = require('../lib/prisma');
const { getPermissions } = require('../config/roles');

const PUBLIC_USER_FIELDS = { id: true, name: true, email: true, role: true };
const RECENT_TASKS_PER_USER = 5;

// Emails are stored in lower case; lookups ignore case so older mixed-case accounts still work.
const findByEmail = (email) =>
  prisma.user.findFirst({ where: { email: { equals: email, mode: 'insensitive' } } });

// POST /api/auth/signup
exports.signup = async (req, res) => {
  const { name, email, password } = req.body;

  if (await findByEmail(email)) {
    return res.status(409).json({ message: 'An account with this email already exists' });
  }

  const user = await prisma.user.create({
    data: { name, email, password: await bcrypt.hash(password, 10) },
    select: { id: true, name: true, email: true }
  });
  res.status(201).json(user);
};

// POST /api/auth/login
exports.login = async (req, res) => {
  const { email, password } = req.body;

  const user = await findByEmail(email);
  // Same message for unknown email and wrong password, so accounts can't be discovered.
  if (!user || !(await bcrypt.compare(password, user.password))) {
    return res.status(401).json({ message: 'Invalid email or password' });
  }

  const token = jwt.sign({ userId: user.id }, process.env.JWT_SECRET, { expiresIn: '1d' });
  await prisma.user.update({ where: { id: user.id }, data: { lastLogin: new Date() } });

  res.status(200).json({
    token,
    user: { id: user.id, name: user.name, email: user.email, role: user.role, permissions: getPermissions(user.role) }
  });
};

// GET /api/auth/users?page&limit&role&search (admin)
// Each user comes with task totals and their most recent tasks, instead of every task they own.
exports.getAllUserWithTasks = async (req, res) => {
  const { page, limit, role, search } = req.validatedQuery;

  const where = {};
  if (role) where.role = role;
  if (search) {
    where.OR = [
      { name: { contains: search, mode: 'insensitive' } },
      { email: { contains: search, mode: 'insensitive' } }
    ];
  }

  const [totalUsers, users] = await prisma.$transaction([
    prisma.user.count({ where }),
    prisma.user.findMany({
      where,
      orderBy: { id: 'asc' },
      skip: (page - 1) * limit,
      take: limit,
      select: {
        ...PUBLIC_USER_FIELDS,
        createdAt: true,
        lastLogin: true,
        tasks: {
          orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
          take: RECENT_TASKS_PER_USER,
          select: { id: true, title: true, description: true, status: true, dueDate: true, createdAt: true }
        }
      }
    })
  ]);

  // Task totals for all users on this page in one grouped query.
  const groups = users.length
    ? await prisma.task.groupBy({
        by: ['userId', 'status'],
        where: { userId: { in: users.map((user) => user.id) } },
        _count: { _all: true }
      })
    : [];

  const result = users.map(({ tasks, ...user }) => {
    const taskStats = { total: 0, pending: 0, completed: 0 };
    for (const group of groups.filter((g) => g.userId === user.id)) {
      taskStats[group.status] = group._count._all;
      taskStats.total += group._count._all;
    }
    return { ...user, taskStats, recentTasks: tasks };
  });

  res.status(200).json({
    users: result,
    pagination: { page, limit, total: totalUsers, totalPages: Math.ceil(totalUsers / limit) }
  });
};

// PATCH /api/auth/users/:id/role (super admin)
exports.updateUserRole = async (req, res) => {
  const targetId = Number(req.params.id);
  const { role } = req.body;

  if (targetId === req.userId) {
    return res.status(400).json({ message: 'You cannot change your own role' });
  }

  const target = await prisma.user.findUnique({ where: { id: targetId }, select: { role: true } });
  if (!target) return res.status(404).json({ message: 'User not found' });

  // Never leave the system without a super admin.
  if (target.role === 'super_admin' && role !== 'super_admin') {
    const superAdmins = await prisma.user.count({ where: { role: 'super_admin' } });
    if (superAdmins <= 1) {
      return res.status(400).json({ message: 'Cannot remove the last super admin' });
    }
  }

  const updated = await prisma.user.update({
    where: { id: targetId },
    data: { role },
    select: PUBLIC_USER_FIELDS
  });
  res.status(200).json(updated);
};

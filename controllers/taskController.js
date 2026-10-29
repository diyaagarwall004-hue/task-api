const prisma = require('../lib/prisma');
const { sendMail } = require('../services/mailer');
const reminderEmails = require('../services/reminderEmails');

// Request bodies and queries are validated by middleware (utils/validation.js)
// before they reach these handlers. Unexpected errors go to the central error handler.

const REMINDERS_RESET = { dayBeforeSentAt: null, hourBeforeSentAt: null, lastOverdueSentAt: null };

// Turns a validated list query into Prisma options: filters, sorting and pagination.
// baseWhere is applied last, so a query parameter can never widen it (e.g. ?userId on /api/tasks).
function listOptions(query, baseWhere = {}) {
  const where = {};
  if (query.status) where.status = query.status;
  if (query.userId) where.userId = query.userId;
  if (query.search) {
    where.OR = [
      { title: { contains: query.search, mode: 'insensitive' } },
      { description: { contains: query.search, mode: 'insensitive' } }
    ];
  }
  Object.assign(where, baseWhere);

  // Tasks without a due date go last when sorting by due date. The id keeps the order stable.
  const primary = query.sortBy === 'dueDate'
    ? { dueDate: { sort: query.order, nulls: 'last' } }
    : { [query.sortBy]: query.order };

  return {
    where,
    orderBy: [primary, { id: query.order }],
    skip: (query.page - 1) * query.limit,
    take: query.limit
  };
}

function pageInfo(query, total) {
  return { page: query.page, limit: query.limit, total, totalPages: Math.ceil(total / query.limit) };
}

async function findPage(query, baseWhere, extra = {}) {
  const options = listOptions(query, baseWhere);
  const [total, tasks] = await prisma.$transaction([
    prisma.task.count({ where: options.where }),
    prisma.task.findMany({ ...options, ...extra })
  ]);
  return { tasks, pagination: pageInfo(query, total) };
}

// GET /api/tasks?page&limit&status&search&sortBy&order
exports.getTasks = async (req, res) => {
  res.status(200).json(await findPage(req.validatedQuery, { userId: req.userId }));
};

// GET /api/tasks/:id
exports.getTaskById = async (req, res) => {
  const task = await prisma.task.findFirst({
    where: { id: Number(req.params.id), userId: req.userId }
  });
  if (!task) return res.status(404).json({ message: 'Task not found' });
  res.status(200).json(task);
};

// POST /api/tasks
exports.createTask = async (req, res) => {
  const { title, description, dueDate } = req.body;
  const task = await prisma.task.create({
    data: { title, description, dueDate, userId: req.userId }
  });
  res.status(201).json(task);
};

// PUT /api/tasks/:id - only title, description, status and dueDate (enforced by validation)
exports.updateTask = async (req, res) => {
  const id = Number(req.params.id);
  const data = { ...req.body };
  if ('dueDate' in data) Object.assign(data, REMINDERS_RESET); // a new due date restarts reminders

  // Ownership is part of the query, so another user's task matches nothing and returns 404.
  const result = await prisma.task.updateMany({ where: { id, userId: req.userId }, data });
  if (result.count === 0) return res.status(404).json({ message: 'Task not found' });

  res.status(200).json(await prisma.task.findUnique({ where: { id } }));
};

// DELETE /api/tasks/:id
exports.deleteTask = async (req, res) => {
  const result = await prisma.task.deleteMany({
    where: { id: Number(req.params.id), userId: req.userId }
  });
  if (result.count === 0) return res.status(404).json({ message: 'Task not found' });
  res.status(200).json({ message: 'Task deleted successfully' });
};

// GET /api/tasks/all/with-users?page&limit&status&search&userId&sortBy&order (admin)
// Every task with its owner.
exports.getAllTasksWithUsers = async (req, res) => {
  const result = await findPage(req.validatedQuery, {}, {
    include: { user: { select: { id: true, name: true, email: true } } }
  });
  res.status(200).json(result);
};

// GET /api/tasks/all/count (admin) - one grouped query instead of three counts
exports.getTasksCount = async (req, res) => {
  const groups = await prisma.task.groupBy({ by: ['status'], _count: { _all: true } });
  const counts = { total: 0, pending: 0, completed: 0 };
  for (const group of groups) {
    counts[group.status] = group._count._all;
    counts.total += group._count._all;
  }
  res.status(200).json(counts);
};

// GET /api/tasks/user/:userId?page&limit&status&search&sortBy&order (admin)
exports.getTasksByUserId = async (req, res) => {
  const userId = Number(req.params.userId);
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, name: true, email: true }
  });
  if (!user) return res.status(404).json({ message: 'User not found' });

  res.status(200).json({ user, ...(await findPage(req.validatedQuery, { userId })) });
};

// POST /api/tasks/assign (admin) - creates the task and emails the assignee
exports.assignTask = async (req, res) => {
  const { title, description, dueDate, userId } = req.body;

  const assignee = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, name: true, email: true }
  });
  if (!assignee) return res.status(404).json({ message: 'User not found' });

  const task = await prisma.task.create({
    data: { title, description, dueDate, userId, assignedById: req.userId }
  });
  res.status(201).json(task);

  // Runs after the response, so an email problem never fails the request.
  prisma.user
    .findUnique({ where: { id: req.userId }, select: { name: true, email: true } })
    .then((assignedBy) =>
      sendMail({
        to: assignee.email,
        replyTo: assignedBy?.email,
        ...reminderEmails.assigned({ user: assignee, task, assignedBy })
      })
    )
    .catch((error) => console.error('[mail] assignment email failed:', error.message));
};

// POST /api/tasks/assign-all (admin) - the same task for every user
exports.assignTaskToAll = async (req, res) => {
  const { title, description } = req.body;
  const users = await prisma.user.findMany({ select: { id: true } });
  if (users.length === 0) return res.status(404).json({ message: 'No users found' });

  const result = await prisma.task.createMany({
    data: users.map((user) => ({ title, description, userId: user.id, assignedById: req.userId }))
  });
  res.status(201).json({ message: `Task assigned to ${result.count} users`, count: result.count });
};

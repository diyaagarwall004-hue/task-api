const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const { sendMail } = require('../services/mailer');
const reminderEmails = require('../services/reminderEmails');

const ALLOWED_STATUSES = ['pending', 'completed'];
const NEWEST_FIRST = [{ createdAt: 'desc' }, { id: 'desc' }];

// Returns { value } (a Date or null) or { error }. Due dates must be in the future.
const parseDueDate = (input) => {
    if (input === undefined || input === null || input === '') return { value: null };
    const date = new Date(input);
    if (typeof input !== 'string' || Number.isNaN(date.getTime())) {
        return { error: "Due date must be a valid date and time" };
    }
    if (date.getTime() <= Date.now()) {
        return { error: "Due date must be in the future" };
    }
    return { value: date };
};

const parseId = (value) => {
    const n = Number(value);
    return Number.isInteger(n) && n > 0 ? n : null;
};


exports.getTasks = async (req,res) => {
    try{
        const tasks = await prisma.task.findMany({
            where: { userId: req.userId },
            orderBy: NEWEST_FIRST
        });
        res.status(200).json(tasks);
    } catch (error) {
        res.status(500).json({ message: "Something went wrong" });
    }
};

exports.getTaskById = async (req,res) => {
    try {
        const id = parseId(req.params.id);
        if (!id) {
            return res.status(400).json({ message: "Invalid task id" });
        }
        const task = await prisma.task.findUnique({
            where: { id }
        });
        if (!task || task.userId !== req.userId) {
            return res.status(404).json({ message: "Task not found" });
        }
        res.status(200).json(task);
    } catch (error) {
        res.status(500).json({ message: "Something went wrong" });
    }
};

exports.createTask = async (req,res) => {
    try {
        const { title, description, dueDate } = req.body;
        if (!title) {
            return res.status(400).json({ message: "Title is required" });
        }
        const due = parseDueDate(dueDate);
        if (due.error) {
            return res.status(400).json({ message: due.error });
        }
        const newTask = await prisma.task.create({
            data: { title, description, userId: req.userId, dueDate: due.value }
        });
        res.status(201).json(newTask);
    } catch (error) {
        res.status(500).json({ message: "Something went wrong" });
    }
};

exports.updateTask = async (req, res) => {
    try {
        const id = parseId(req.params.id);
        if (!id) {
            return res.status(400).json({ message: "Invalid task id" });
        }

        // Only title, description, status and dueDate can ever be changed. Anything else in the body
        // (id, userId, createdAt, ...) is ignored.
        const body = req.body || {};
        const data = {};

        if ('title' in body) {
            if (typeof body.title !== 'string' || !body.title.trim()) {
                return res.status(400).json({ message: "Title must be a non-empty string" });
            }
            data.title = body.title.trim();
        }

        if ('description' in body) {
            if (body.description !== null && typeof body.description !== 'string') {
                return res.status(400).json({ message: "Description must be a string" });
            }
            data.description = body.description;
        }

        if ('status' in body) {
            if (!ALLOWED_STATUSES.includes(body.status)) {
                return res.status(400).json({ message: `Status must be one of: ${ALLOWED_STATUSES.join(', ')}` });
            }
            data.status = body.status;
        }

        if ('dueDate' in body) {
            const due = parseDueDate(body.dueDate);
            if (due.error) {
                return res.status(400).json({ message: due.error });
            }
            data.dueDate = due.value;
            // A new due date restarts the reminders for this task.
            data.dayBeforeSentAt = null;
            data.hourBeforeSentAt = null;
            data.lastOverdueSentAt = null;
        }

        if (Object.keys(data).length === 0) {
            return res.status(400).json({ message: "Nothing to update. Allowed fields: title, description, status, dueDate" });
        }

        // Ownership is part of the query itself, so a task that belongs to
        // someone else (or does not exist) matches nothing and returns 404.
        const result = await prisma.task.updateMany({
            where: { id, userId: req.userId },
            data
        });

        if (result.count === 0) {
            return res.status(404).json({ message: "Task not found" });
        }

        const task = await prisma.task.findUnique({ where: { id } });
        res.status(200).json(task);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Something went wrong" });
    }
};

exports.deleteTask = async (req, res) => {
    try{
        const id = parseId(req.params.id);
        if (!id) {
            return res.status(400).json({ message: "Invalid task id" });
        }

        const result = await prisma.task.deleteMany({
            where: { id, userId: req.userId }
        });

        if (result.count === 0) {
            return res.status(404).json({ message: "Task not found" });
        }

        res.status(200).json({ message: "Task deleted successfully" });
    } catch (error) {
        res.status(500).json({ message: "Something went wrong" });
    }
};

exports.getAllTasksWithUsers = async (req, res) => {
    try {
        const limit = parseInt(req.query.limit) || 10;
        const page = parseInt(req.query.page) || 1;
        const skip = (page - 1) * limit;

        const users = await prisma.user.findMany({
            take: limit,
            skip: skip,
            orderBy: { id: 'asc' },
            select: {
                id: true,
                name: true,
                email: true,
                createdAt: true,
                lastLogin: true,
                tasks: { orderBy: NEWEST_FIRST }
            }
        });
        res.status(200).json(users);
    } catch (error) {
        res.status(500).json({ message: "Something went wrong" });
    }
};

exports.getTasksCount = async (req, res) => {
    try {
        const total = await prisma.task.count();
        const pending = await prisma.task.count({ where: { status: 'pending' } });
        const completed = await prisma.task.count({ where: { status: 'completed' } });
        res.status(200).json({ total, pending, completed });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Something went wrong" });
    }
};

exports.getTasksByUserId = async (req, res) => {
  try {
    const userId = parseId(req.params.userId);
    if (!userId) {
      return res.status(400).json({ message: "Invalid user id" });
    }
    const limit = parseInt(req.query.limit) || 10;
    const page = parseInt(req.query.page) || 1;
    const skip = (page - 1) * limit;

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, name: true, email: true }
    });

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    const totalTasks = await prisma.task.count({
      where: { userId: userId }
    });

    const tasks = await prisma.task.findMany({
      where: { userId: userId },
      take: limit,
      skip: skip,
      orderBy: NEWEST_FIRST
    });

    res.status(200).json({
        user,
        totalTasks,
        page,
        limit,
        totalPages: Math.ceil(totalTasks / limit),
        tasks
    });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Something went wrong" });
    }
};

exports.assignTask = async (req, res) => {
  try {
    const { title, description, userId, dueDate } = req.body;

    if (!title || !userId) {
      return res.status(400).json({ message: "Title and userId are required" });
    }

    const due = parseDueDate(dueDate);
    if (due.error) {
      return res.status(400).json({ message: due.error });
    }

    const userExists = await prisma.user.findUnique({
      where: { id: parseInt(userId) }
    });

    if (!userExists) {
      return res.status(404).json({ message: "User not found" });
    }

    const newTask = await prisma.task.create({
      data: { title, description, userId: parseInt(userId), dueDate: due.value, assignedById: req.userId }
    });

    res.status(201).json(newTask);

    // Tell the assignee. Runs after the response, so a mail problem never fails the request.
    prisma.user.findUnique({ where: { id: req.userId }, select: { name: true, email: true } })
      .then((assignedBy) => sendMail({
        to: userExists.email,
        replyTo: assignedBy?.email,
        ...reminderEmails.assigned({ user: userExists, task: newTask, assignedBy })
      }))
      .catch((error) => console.error('[mail] assignment email failed:', error.message));
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Something went wrong" });
  }
};

exports.assignTaskToAll = async (req, res) => {
  try {
    const { title, description } = req.body;

    if (!title || !title.trim()) {
      return res.status(400).json({ message: "Title is required" });
    }

    const users = await prisma.user.findMany({ select: { id: true } });
    if (users.length === 0) {
      return res.status(404).json({ message: "No users found" });
    }

    const result = await prisma.task.createMany({
      data: users.map((u) => ({
        title: title.trim(),
        description: description || null,
        userId: u.id
      }))
    });

    res.status(201).json({ message: `Task assigned to ${result.count} users`, count: result.count });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Something went wrong" });
  }
};

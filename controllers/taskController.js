const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const { status } = require("express/lib/response");

exports.getTasks = async (req,res) => {
    try{
        const tasks = await prisma.task.findMany({
            where: { userId: req.userId }
        });
        res.status(200).json(tasks);
    } catch (error) {
        res.status(500).json({ message: "Something went wrong" });
    }
};

exports.getTaskById = async (req,res) => {
    try {
        const task = await prisma.task.findUnique({
            where: { id: parseInt(req.params.id) }
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
        const { title, description } = req.body;
        if (!title) {
            return res.status(400).json({ message: "Title is required" });
        }
        const newTask = await prisma.task.create({
            data: { title, description, userId: req.userId }
        });
        res.status(201).json(newTask);
    } catch (error) {
        res.status(500).json({ message: "Something went wrong" });
    }
};

exports.updateTask = async (req, res) => {
    try {
        const existingTask = await prisma.task.findUnique({
            where: { id: parseInt(req.params.id) }
        });

        if (!existingTask || existingTask.userId !== req.userId) {
            return res.status(404).json({ message: "Task not found" });   
        }

        const task = await prisma.task.update({
            where: { id: parseInt(req.params.id) },
            data: req.body
        });

        res.status(200).json(task);
    } catch (error) {
        res.status(500).json({ message: "Something went wrong" });
    }
};

exports.deleteTask = async (req, res) => {
    try{
        const existingTask = await prisma.task.findUnique({
            where: { id: parseInt(req.params.id) }
        });

        if (!existingTask || existingTask.userId !== req.userId) {
            return res.status(404).json({ message: "Task not found" });
        }

        await prisma.task.delete({
            where: { id: parseInt(req.params.id) }
        });

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
            select: {
                id: true,
                name: true,
                email: true,
                createdAt: true,
                lastLogin: true,
                tasks: true
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
    const userId = parseInt(req.params.userId);
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
      orderBy: { createdAt: 'desc' }
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
    const { title, description, userId } = req.body;

    if (!title || !userId) {
      return res.status(400).json({ message: "Title and userId are required" });
    }

    const userExists = await prisma.user.findUnique({
      where: { id: parseInt(userId) }
    });

    if (!userExists) {
      return res.status(404).json({ message: "User not found" });
    }

    const newTask = await prisma.task.create({
      data: { title, description, userId: parseInt(userId) }
    });

    res.status(201).json(newTask);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Something went wrong" });
  }
};
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { PrismaClient } = require('@prisma/client');
const { isValidRole, getPermissions } = require('../config/roles');
const prisma = new PrismaClient();


exports.signup = async (req, res) => {
    try {
        const { name, email, password } = req.body;

        if (!name || !email || !password) {
            return res.status(400).json({ message: "All fields are required" });
        }

        const existingUser = await prisma.user.findUnique({ where: { email } });
        if (existingUser) {
            return res.status(400).json({ message: "User already exists" });
        }

        const hashedPassword = await bcrypt.hash(password, 10);

        const newUser = await prisma.user.create({
            data: { name, email, password: hashedPassword }
        });

        res.status(201).json({ id: newUser.id, name: newUser.name, email: newUser.email });
    } catch (error) {
        res.status(500).json({ message: "Something went wrong" });
    }
};


exports.login =async (req, res) => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({ message: "Email and password are required" });
        }

        const user = await prisma.user.findUnique({ where: { email } });
        if (!user) {
            return res.status(400).json({ message: "Invalid credentials" });
        }

        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            return res.status(400).json({ message: "Invalid credentials" });
        }

        const token = jwt.sign({ userId: user.id }, process.env.JWT_SECRET, { expiresIn: '1d' });

        await prisma.user.update({
            where: { id: user.id },
            data: { lastLogin: new Date() }
        });

        res.status(200).json({
            token,
            user: { id: user.id, name: user.name, email: user.email, role: user.role, permissions: getPermissions(user.role) }
        });
    } catch (error) {
        res.status(500).json({ message: "Something went wrong" });
    }
};


exports.getAllUserWithTasks = async (req, res) => {
    try {
        const limit = parseInt(req.query.limit) || 10;
        const page = parseInt(req.query.page) || 1;
        const skip = (page - 1) * limit;

        const totalUsers = await prisma.user.count();

        const users = await prisma.user.findMany({
            take: limit,
            skip: skip,
            select: {
                id: true, 
                name: true,
                email: true,
                role: true,
                createdAt: true,
                lastLogin: true,
                tasks: { orderBy: [{ createdAt: 'desc' }, { id: 'desc' }] }
            },
            orderBy: { id: 'asc' }
        });

        res.status(200).json({
            totalUsers,
            page,
            limit,
            totalPages: Math.ceil(totalUsers / limit),
            users
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Something went wrong" });
    }
};


exports.updateUserRole = async (req, res) => {
    try {
        const targetId = parseInt(req.params.id);
        const { role } = req.body;

        if (Number.isNaN(targetId)) {
            return res.status(400).json({ message: "Invalid user id" });
        }
        if (!isValidRole(role)) {
            return res.status(400).json({ message: "Invalid role" });
        }
        if (targetId === req.userId) {
            return res.status(400).json({ message: "You cannot change your own role" });
        }

        const target = await prisma.user.findUnique({ where: { id: targetId } });
        if (!target) {
            return res.status(404).json({ message: "User not found" });
        }

        // Never leave the system without a super admin.
        if (target.role === 'super_admin' && role !== 'super_admin') {
            const superAdmins = await prisma.user.count({ where: { role: 'super_admin' } });
            if (superAdmins <= 1) {
                return res.status(400).json({ message: "Cannot remove the last super admin" });
            }
        }

        const updated = await prisma.user.update({
            where: { id: targetId },
            data: { role },
            select: { id: true, name: true, email: true, role: true }
        });

        res.status(200).json(updated);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Something went wrong" });
    }
};

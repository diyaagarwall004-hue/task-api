const { PrismaClient } = require('@prisma/client');
const { hasPermission } = require('../config/roles');
const prisma = new PrismaClient();

// Use after `protect`. The role is read from the database on every request,
// so a role change takes effect immediately (not after the token expires).
const requirePermission = (permission) => async (req, res, next) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.userId },
      select: { role: true }
    });

    if (!user || !hasPermission(user.role, permission)) {
      return res.status(403).json({ message: "Access denied. You don't have permission to do this." });
    }

    req.userRole = user.role;
    next();
  } catch (error) {
    res.status(500).json({ message: "Something went wrong" });
  }
};

module.exports = requirePermission;

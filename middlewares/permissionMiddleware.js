const prisma = require('../lib/prisma');
const { hasPermission } = require('../config/roles');

// Use after `protect`. The role is read from the database on every request,
// so a role change takes effect immediately (not after the token expires).
const requirePermission = (permission) => async (req, res, next) => {
  const user = await prisma.user.findUnique({
    where: { id: req.userId },
    select: { role: true }
  });

  if (!user || !hasPermission(user.role, permission)) {
    return res.status(403).json({ message: "Access denied. You don't have permission to do this." });
  }

  req.userRole = user.role;
  next();
};

module.exports = requirePermission;

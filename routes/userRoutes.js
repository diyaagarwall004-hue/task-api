const express = require('express');
const router = express.Router();
const { signup, login, getAllUserWithTasks, updateUserRole } = require('../controllers/userController');
const protect = require('../middlewares/authMiddleware');
const requirePermission = require('../middlewares/permissionMiddleware');
const { PERMISSIONS } = require('../config/roles');

router.post('/signup', signup);
router.post('/login', login);
router.get('/users', protect, requirePermission(PERMISSIONS.USERS_READ), getAllUserWithTasks);
router.patch('/users/:id/role', protect, requirePermission(PERMISSIONS.ROLES_MANAGE), updateUserRole);

module.exports = router;

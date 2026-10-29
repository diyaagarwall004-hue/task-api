const express = require('express');
const router = express.Router();
const { signup, login, getAllUserWithTasks, updateUserRole } = require('../controllers/userController');
const protect = require('../middlewares/authMiddleware');
const requirePermission = require('../middlewares/permissionMiddleware');
const { loginLimiter, signupLimiter } = require('../middlewares/rateLimiters');
const { PERMISSIONS } = require('../config/roles');
const { schemas, validate, validateIdParam } = require('../utils/validation');

router.post('/signup', signupLimiter, validate(schemas.signup), signup);
router.post('/login', loginLimiter, validate(schemas.login), login);
router.get('/users', protect, requirePermission(PERMISSIONS.USERS_READ), validate(schemas.userListQuery, 'query'), getAllUserWithTasks);
router.patch('/users/:id/role', protect, requirePermission(PERMISSIONS.ROLES_MANAGE), validateIdParam('id'), validate(schemas.updateRole), updateUserRole);

module.exports = router;

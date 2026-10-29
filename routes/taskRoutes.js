const express = require('express');
const router = express.Router();
const tasks = require('../controllers/taskController');
const protect = require('../middlewares/authMiddleware');
const requirePermission = require('../middlewares/permissionMiddleware');
const { PERMISSIONS } = require('../config/roles');
const { schemas, validate, validateIdParam } = require('../utils/validation');

// Every task route requires login.
router.use(protect);

// Admin routes (registered before /:id so "all" and "user" are not read as ids)
router.get('/all/with-users', requirePermission(PERMISSIONS.TASKS_READ_ALL), validate(schemas.taskListQuery, 'query'), tasks.getAllTasksWithUsers);
router.get('/all/count', requirePermission(PERMISSIONS.TASKS_READ_ALL), tasks.getTasksCount);
router.get('/user/:userId', requirePermission(PERMISSIONS.TASKS_READ_ALL), validateIdParam('userId'), validate(schemas.taskListQuery, 'query'), tasks.getTasksByUserId);
router.post('/assign', requirePermission(PERMISSIONS.TASKS_ASSIGN), validate(schemas.assignTask), tasks.assignTask);
router.post('/assign-all', requirePermission(PERMISSIONS.TASKS_ASSIGN), validate(schemas.assignTaskToAll), tasks.assignTaskToAll);

// Your own tasks
router.get('/', validate(schemas.taskListQuery, 'query'), tasks.getTasks);
router.post('/', validate(schemas.createTask), tasks.createTask);
router.get('/:id', validateIdParam('id'), tasks.getTaskById);
router.put('/:id', validateIdParam('id'), validate(schemas.updateTask), tasks.updateTask);
router.delete('/:id', validateIdParam('id'), tasks.deleteTask);

module.exports = router;

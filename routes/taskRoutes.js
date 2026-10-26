const express = require('express');
const router = express.Router();
const { getTasks, getTaskById, createTask, updateTask, deleteTask, getAllTasksWithUsers, getTasksCount, getTasksByUserId, assignTask, assignTaskToAll } = require('../controllers/taskController');
const protect = require('../middlewares/authMiddleware');
const requirePermission = require('../middlewares/permissionMiddleware');
const { PERMISSIONS } = require('../config/roles');

router.get('/', protect, getTasks);
router.get('/all/with-users', protect, requirePermission(PERMISSIONS.TASKS_READ_ALL), getAllTasksWithUsers);
router.get('/all/count', protect, requirePermission(PERMISSIONS.TASKS_READ_ALL), getTasksCount);
router.get('/user/:userId', protect, requirePermission(PERMISSIONS.TASKS_READ_ALL), getTasksByUserId);
router.get('/:id', protect, getTaskById);
router.post('/', protect, createTask);
router.post('/assign-all', protect, requirePermission(PERMISSIONS.TASKS_ASSIGN), assignTaskToAll);
router.post('/assign', protect, requirePermission(PERMISSIONS.TASKS_ASSIGN), assignTask);
router.put('/:id', protect, updateTask);
router.delete('/:id', protect, deleteTask);

module.exports = router;
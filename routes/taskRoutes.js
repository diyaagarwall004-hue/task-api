const express = require('express');
const router = express.Router();
const { getTasks, getTaskById, createTask, updateTask, deleteTask, getAllTasksWithUsers, getTasksCount, getTasksByUserId, assignTask } = require('../controllers/taskController');
const protect = require('../middlewares/authMiddleware');
const adminOnly = require('../middlewares/adminMiddleware');

router.get('/', protect, getTasks);
router.get('/all/with-users', protect, adminOnly, getAllTasksWithUsers);
router.get('/all/count', protect, adminOnly, getTasksCount);
router.get('/user/:userId', protect, adminOnly, getTasksByUserId);
router.get('/:id', protect, getTaskById);
router.post('/', protect, createTask);
router.post('/assign', protect, adminOnly, assignTask);
router.put('/:id', protect, updateTask);
router.delete('/:id', protect, deleteTask);

module.exports = router;
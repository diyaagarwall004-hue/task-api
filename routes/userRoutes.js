const express = require('express');
const router = express.Router();
const { signup, login, getAllUserWithTasks } = require('../controllers/userController');
const protect = require('../middlewares/authMiddleware');
const adminOnly = require('../middlewares/adminMiddleware');

router.post('/signup', signup);
router.post('/login', login);
router.get('/users', protect, adminOnly, getAllUserWithTasks);

module.exports =router;
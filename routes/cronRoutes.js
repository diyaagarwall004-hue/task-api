const express = require('express');
const router = express.Router();
const { sendReminders } = require('../controllers/cronController');

router.get('/send-reminders', sendReminders);

module.exports = router;

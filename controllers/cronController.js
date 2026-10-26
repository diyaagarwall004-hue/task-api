const crypto = require('crypto');
const { PrismaClient } = require('@prisma/client');
const { sendMail } = require('../services/mailer');
const { runReminders } = require('../services/reminderJob');
const prisma = new PrismaClient();

const safeEqual = (a, b) => {
  const x = Buffer.from(String(a));
  const y = Buffer.from(String(b));
  return x.length === y.length && crypto.timingSafeEqual(x, y);
};

// Called by an external scheduler (e.g. cron-job.org) every 5-10 minutes.
// Auth: header "x-cron-secret: <CRON_SECRET>" or query "?key=<CRON_SECRET>".
exports.sendReminders = async (req, res) => {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return res.status(503).json({ message: "Reminders are disabled: CRON_SECRET is not set" });
  }
  const provided = req.headers['x-cron-secret'] || req.query.key;
  if (!provided || !safeEqual(provided, secret)) {
    return res.status(401).json({ message: "Invalid cron key" });
  }

  try {
    const result = await runReminders({ prisma, sendMail });
    res.status(200).json(result);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Something went wrong" });
  }
};

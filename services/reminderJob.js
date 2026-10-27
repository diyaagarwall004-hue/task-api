// Finds pending tasks that need a reminder and sends it.
// Safe to run as often as you like (every 5-10 minutes): every email type is
// recorded on the task, so nothing is sent twice.
//
//   assigned     : sent when the task is assigned (see taskController)
//   day before   : once, when 24h or less is left (not if the task was created later than that)
//   hour before  : once, when 1h or less is left (not if the task was created later than that)
//   overdue      : once when the due time passes, then once every day after 9:00 AM IST

const emails = require('./reminderEmails');

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;
// 9:00 AM IST (UTC+05:30) is 03:30 UTC.
const OVERDUE_DAILY_UTC_HOUR = 3;
const OVERDUE_DAILY_UTC_MINUTE = 30;

// The most recent 9:00 AM IST at or before `now`.
const latestDailyMark = (now) => {
  const mark = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(),
    OVERDUE_DAILY_UTC_HOUR, OVERDUE_DAILY_UTC_MINUTE));
  if (mark > now) mark.setUTCDate(mark.getUTCDate() - 1);
  return mark;
};

// Decides which reminder (if any) a task needs right now.
const pickReminder = (task, now) => {
  const due = new Date(task.dueDate);
  const created = new Date(task.createdAt);
  const left = due - now;

  if (left <= 0) {
    if (!task.lastOverdueSentAt) return 'overdue';
    const last = new Date(task.lastOverdueSentAt);
    const mark = latestDailyMark(now);
    // A new daily mail once 9:00 AM IST has passed since the last one (and at least 12h apart).
    if (last < mark && mark > due && now - last >= 12 * HOUR) return 'overdue';
    return null;
  }
  if (left <= HOUR) {
    return !task.hourBeforeSentAt && due - created > HOUR ? 'hourBefore' : null;
  }
  if (left <= DAY) {
    return !task.dayBeforeSentAt && due - created > DAY ? 'dayBefore' : null;
  }
  return null;
};

const FLAG = { dayBefore: 'dayBeforeSentAt', hourBefore: 'hourBeforeSentAt', overdue: 'lastOverdueSentAt' };

async function runReminders({ prisma, sendMail, now = new Date() }) {
  const tasks = await prisma.task.findMany({
    where: { status: 'pending', dueDate: { not: null } },
    include: {
      user: { select: { name: true, email: true } },
      assignedBy: { select: { name: true, email: true } }
    }
  });

  const result = { checked: tasks.length, sent: 0, skipped: 0, failed: 0 };

  for (const task of tasks) {
    const kind = pickReminder(task, now);
    if (!kind) continue;

    const flag = FLAG[kind];
    // Claim the reminder first, so two overlapping runs cannot both send it.
    const claim = await prisma.task.updateMany({
      where: { id: task.id, [flag]: task[flag] ?? null },
      data: { [flag]: now }
    });
    if (claim.count === 0) continue;

    try {
      const message = emails[kind]({ user: task.user, task, assignedBy: task.assignedBy });
      const sent = await sendMail({ to: task.user.email, replyTo: task.assignedBy?.email, ...message });
      if (sent) {
        result.sent++;
      } else {
        // Mail is not configured: undo the claim so it goes out once it is.
        await prisma.task.updateMany({ where: { id: task.id }, data: { [flag]: task[flag] ?? null } });
        result.skipped++;
      }
    } catch (error) {
      console.error(`[reminders] task ${task.id} (${kind}) failed:`, error.message);
      await prisma.task.updateMany({ where: { id: task.id }, data: { [flag]: task[flag] ?? null } });
      result.failed++;
    }
  }
  return result;
}

module.exports = { runReminders, pickReminder, latestDailyMark };

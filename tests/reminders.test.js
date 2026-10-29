const { test } = require('node:test');
const assert = require('node:assert/strict');
const { pickReminder, latestDailyMark } = require('../services/reminderJob');

const H = 3600000;
const due = new Date('2026-10-30T12:00:00Z');
const task = (extra = {}) => ({ dueDate: due, createdAt: new Date('2026-10-01T00:00:00Z'), ...extra });

test('picks the right reminder for the time left', () => {
  assert.equal(pickReminder(task(), new Date(+due - 72 * H)), null);
  assert.equal(pickReminder(task(), new Date(+due - 23 * H)), 'dayBefore');
  assert.equal(pickReminder(task(), new Date(+due - 0.5 * H)), 'hourBefore');
  assert.equal(pickReminder(task(), new Date(+due + 0.1 * H)), 'overdue');
});

test('does not repeat a reminder that was already sent', () => {
  assert.equal(pickReminder(task({ dayBeforeSentAt: new Date() }), new Date(+due - 23 * H)), null);
  assert.equal(pickReminder(task({ hourBeforeSentAt: new Date() }), new Date(+due - 0.5 * H)), null);
});

test('skips reminders whose moment had already passed when the task was created', () => {
  assert.equal(pickReminder(task({ createdAt: new Date(+due - 3 * H) }), new Date(+due - 2 * H)), null);
});

test('overdue repeats once a day after 9:00 AM IST', () => {
  const sent = new Date('2026-10-30T12:05:00Z');
  assert.equal(pickReminder(task({ lastOverdueSentAt: sent }), new Date('2026-10-30T20:00:00Z')), null);
  assert.equal(pickReminder(task({ lastOverdueSentAt: sent }), new Date('2026-10-31T03:31:00Z')), 'overdue');
  assert.equal(latestDailyMark(new Date('2026-10-31T10:00:00Z')).toISOString(), '2026-10-31T03:30:00.000Z');
});

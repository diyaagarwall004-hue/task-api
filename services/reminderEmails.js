// Email texts. Times are always shown in IST.

const escapeHtml = (value) =>
  String(value ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

const formatIST = (date) =>
  new Date(date).toLocaleString('en-IN', {
    timeZone: 'Asia/Kolkata',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true
  }) + ' IST';

const build = ({ subject, user, task, intro, assignedBy }) => {
  const due = task.dueDate ? formatIST(task.dueDate) : 'No due date';
  const lines = [
    `Hi ${user.name},`,
    '',
    intro,
    '',
    `Task: ${task.title}`,
    task.description ? `Details: ${task.description}` : null,
    `Due: ${due}`,
    assignedBy ? `Assigned by: ${assignedBy.name}` : null,
    '',
    'Please log in to Task Manager to update or complete it.'
  ].filter((l) => l !== null);

  const html = `
    <p>Hi ${escapeHtml(user.name)},</p>
    <p>${escapeHtml(intro)}</p>
    <table cellpadding="4" style="border-collapse:collapse">
      <tr><td><b>Task</b></td><td>${escapeHtml(task.title)}</td></tr>
      ${task.description ? `<tr><td><b>Details</b></td><td>${escapeHtml(task.description)}</td></tr>` : ''}
      <tr><td><b>Due</b></td><td>${escapeHtml(due)}</td></tr>
      ${assignedBy ? `<tr><td><b>Assigned by</b></td><td>${escapeHtml(assignedBy.name)}</td></tr>` : ''}
    </table>
    <p>Please log in to Task Manager to update or complete it.</p>`;

  return { subject, text: lines.join('\n'), html };
};

exports.formatIST = formatIST;

exports.assigned = ({ user, task, assignedBy }) =>
  build({ subject: `New task assigned: ${task.title}`, user, task, assignedBy,
    intro: 'A new task has been assigned to you.' });

exports.dayBefore = ({ user, task }) =>
  build({ subject: `Reminder: "${task.title}" is due in 24 hours`, user, task,
    intro: 'This task is due within the next 24 hours.' });

exports.hourBefore = ({ user, task }) =>
  build({ subject: `Reminder: "${task.title}" is due in 1 hour`, user, task,
    intro: 'This task is due within the next hour.' });

exports.overdue = ({ user, task }) =>
  build({ subject: `Overdue: "${task.title}"`, user, task,
    intro: 'The due date for this task has passed and it is still not completed.' });

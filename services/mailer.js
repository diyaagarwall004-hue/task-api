// Sends email through Gmail (or any SMTP server) using Nodemailer.
// Needs MAIL_USER and MAIL_PASS (a Gmail App Password) in the environment.
// Without them, mail is skipped with a log line and the app keeps working.

let transporter = null;

const isConfigured = () => Boolean(process.env.MAIL_USER && process.env.MAIL_PASS);

const getTransporter = () => {
  if (transporter) return transporter;
  const nodemailer = require('nodemailer');
  transporter = nodemailer.createTransport({
    host: process.env.MAIL_HOST || 'smtp.gmail.com',
    port: Number(process.env.MAIL_PORT) || 465,
    secure: (process.env.MAIL_PORT || '465') === '465',
    auth: { user: process.env.MAIL_USER, pass: process.env.MAIL_PASS }
  });
  return transporter;
};

// Returns true if the mail was handed to the mail server, false if skipped.
// Throws if sending fails, so callers can retry later.
const sendMail = async ({ to, subject, text, html, replyTo }) => {
  if (!isConfigured()) {
    console.warn(`[mail] MAIL_USER/MAIL_PASS not set. Skipped "${subject}" to ${to}`);
    return false;
  }
  await getTransporter().sendMail({
    from: `"Task Manager" <${process.env.MAIL_USER}>`,
    to,
    replyTo,
    subject,
    text,
    html
  });
  return true;
};

module.exports = { sendMail, isConfigured };

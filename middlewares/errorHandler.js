// 404 for API routes that don't exist (the frontend is served separately).
const notFound = (req, res) => {
  res.status(404).json({ message: `Route not found: ${req.method} ${req.originalUrl}` });
};

// Central error handler. Express 5 forwards errors from async handlers here,
// so controllers don't need their own try/catch blocks.
// eslint-disable-next-line no-unused-vars
const errorHandler = (err, req, res, next) => {
  // Body parser errors
  if (err.type === 'entity.parse.failed') {
    return res.status(400).json({ message: 'Request body is not valid JSON' });
  }
  if (err.type === 'entity.too.large') {
    return res.status(413).json({ message: 'Request body is too large' });
  }

  // Known Prisma errors
  if (err.code === 'P2002') {
    return res.status(409).json({ message: 'A record with this value already exists' });
  }
  if (err.code === 'P2025') {
    return res.status(404).json({ message: 'Record not found' });
  }

  console.error(`[error] ${req.method} ${req.originalUrl}:`, err);
  res.status(500).json({ message: 'Something went wrong' });
};

module.exports = { notFound, errorHandler };

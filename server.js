require('dotenv').config();
const { validateEnv } = require('./config/env');

// Stop early with a clear message if required settings are missing.
const { errors, warnings } = validateEnv();
warnings.forEach((warning) => console.warn(`[config] ${warning}`));
if (errors.length > 0) {
  console.error('[config] The server cannot start:');
  errors.forEach((error) => console.error(`  - ${error}`));
  process.exit(1);
}

const app = require('./app');
const prisma = require('./lib/prisma');

const PORT = process.env.PORT || 5000;
const server = app.listen(PORT, () => console.log(`Server running on port ${PORT}`));

// Close the database connection cleanly when the host stops the app.
const shutdown = () => {
  server.close(async () => {
    await prisma.$disconnect();
    process.exit(0);
  });
};
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

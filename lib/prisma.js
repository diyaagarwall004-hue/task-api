// One PrismaClient for the whole app. Every file imports this instead of
// creating its own client, so the app keeps a single connection pool.
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

module.exports = prisma;

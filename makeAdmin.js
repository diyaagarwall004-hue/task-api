const { PrismaClient } = require('@prisma/client');
const { ROLES, isValidRole } = require('./config/roles');
const prisma = new PrismaClient();

async function main() {
  const email = process.argv[2];
  const role = process.argv[3] || 'admin';

  if (!email) {
    console.log(`Usage: node makeAdmin.js <email> [${Object.keys(ROLES).join('|')}]  (default: admin)`);
    return;
  }
  if (!isValidRole(role)) {
    console.log(`Invalid role "${role}". Choose one of: ${Object.keys(ROLES).join(', ')}`);
    return;
  }

  const user = await prisma.user.update({
    where: { email },
    data: { role }
  });

  console.log(`${user.name} is now ${role}!`);
}

main()
  .catch((error) => console.error('Error:', error.message))
  .finally(() => prisma.$disconnect());

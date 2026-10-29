// Sets a user's role from the command line. Used once to create the first super admin.
//   node makeAdmin.js <email> [user|admin|super_admin]   (default: admin)
require('dotenv').config();
const prisma = require('./lib/prisma');
const { ROLES, isValidRole } = require('./config/roles');

async function main() {
  const email = (process.argv[2] || '').trim().toLowerCase();
  const role = process.argv[3] || 'admin';

  if (!email) {
    console.log(`Usage: node makeAdmin.js <email> [${Object.keys(ROLES).join('|')}]  (default: admin)`);
    return;
  }
  if (!isValidRole(role)) {
    console.log(`Invalid role "${role}". Choose one of: ${Object.keys(ROLES).join(', ')}`);
    return;
  }

  const user = await prisma.user.findFirst({ where: { email: { equals: email, mode: 'insensitive' } } });
  if (!user) {
    console.log(`No user found with email ${email}`);
    return;
  }

  await prisma.user.update({ where: { id: user.id }, data: { role } });
  console.log(`${user.name} is now ${role}!`);
}

main()
  .catch((error) => console.error('Error:', error.message))
  .finally(() => prisma.$disconnect());

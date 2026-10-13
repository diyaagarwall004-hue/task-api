const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const email = process.argv[2];

  if (!email) {
    console.log('Usage: node makeAdmin.js <email>');
    return;
  }

  const user = await prisma.user.update({
    where: { email },
    data: { role: 'admin' }
  });

  console.log(`${user.name} is now an admin!`);
}

main()
  .catch((error) => console.error('Error:', error.message))
  .finally(() => prisma.$disconnect());
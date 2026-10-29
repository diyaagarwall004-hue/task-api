// Creates 30 demo users (user1@example.com ... user30@example.com, password: password123).
// Safe to run more than once: existing demo users are left as they are.
require('dotenv').config();
const bcrypt = require('bcryptjs');
const prisma = require('./lib/prisma');

async function main() {
  const password = await bcrypt.hash('password123', 10);
  const result = await prisma.user.createMany({
    data: Array.from({ length: 30 }, (_, i) => ({
      name: `User ${i + 1}`,
      email: `user${i + 1}@example.com`,
      password
    })),
    skipDuplicates: true
  });
  console.log(`Created ${result.count} demo users (others already existed).`);
}

main()
  .catch((error) => console.error(error))
  .finally(() => prisma.$disconnect());

const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const prisma = new PrismaClient();

async function createUsers() {
    for (let i = 1; i <= 30; i++) {
        const hashedPassword = await bcrypt.hash('password123', 10);
        await prisma.user.create({
            data: {
                name: `User ${i}`,
                email: `user${i}@example.com`,
                password: hashedPassword
            }
        });
        console.log(`Created User ${i}`);
    }
    console.log('All 30 users created!');
}

createUsers()
    .catch((error) => console.error(error))
    .finally(() => prisma.$disconnect());
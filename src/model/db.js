const { PrismaClient } = require('@prisma/client');

const prismaClient = new PrismaClient();

console.log('\nNew prisma client is instantiated successfully!\n');

process.on('beforeExit', async () => {
  await prismaClient.$disconnect();
  console.log('\nPrisma client is disconnected successfully!\n');
});

module.exports = { prismaClient };

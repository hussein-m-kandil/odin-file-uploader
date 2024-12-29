const { PrismaClient } = require('@prisma/client');

// Consider using `Prisma Accelerate` for future serverless environments

if (!global.prismaClient) {
  global.prismaClient = new PrismaClient();
}

let prismaClient = global.prismaClient;

const ensureConnected = async () => {
  try {
    // Execute a lightweight query to ensure the connection is alive
    await prismaClient.$queryRaw`SELECT 1`;
  } catch {
    console.error('Prisma Client is not connected. Reinitializing...');
    global.prismaClient = new PrismaClient();
    prismaClient = global.prismaClient;
  }
};

ensureConnected();

module.exports = { prismaClient };

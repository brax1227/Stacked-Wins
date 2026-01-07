// NOTE: Deprecated. This project is migrating away from Prisma/Postgres toward Firebase/Firestore.
// Kept temporarily to avoid breaking existing controllers/routes during the transition.
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

process.on('beforeExit', async () => {
  await prisma.$disconnect();
});

export default prisma;


const { PrismaClient } = require('./node_modules/.prisma/client');
(async () => {
  const prisma = new PrismaClient();
  const users = await prisma.user.findMany({
    where: { deletedAt: null },
    select: { id: true, username: true, phone: true, role: true, orgId: true, passwordHash: true },
    take: 10,
  });
  console.log(JSON.stringify(users, null, 2));
  await prisma.$disconnect();
})();

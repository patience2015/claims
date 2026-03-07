process.env.DATABASE_URL = 'file:./dev.db';
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const prisma = new PrismaClient();
async function main() {
  const users = await prisma.user.findMany({ select: { email: true, name: true, password: true, role: true, active: true } });
  for (const u of users) {
    const ok123 = await bcrypt.compare('password123', u.password);
    console.log(u.email, '| active:', u.active, '| password123 OK:', ok123);
  }
}
main().catch(console.error).finally(() => prisma.$disconnect());

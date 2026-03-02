import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  const email = 'admin@admin.com';
  const password = 'Admin123#';
  const password_hash = await bcrypt.hash(password, 10);

  const user = await prisma.user.upsert({
    where: { email },
    update: {},
    create: {
      email,
      password_hash,
      name: 'Admin',
      phone: '0000000000',
      role: 'ADMIN',
    },
  });

  await prisma.adminUser.upsert({
    where: { user_id: user.id },
    update: {},
    create: {
      user_id: user.id,
      role: 'SUPER_ADMIN',
      permissions: ['all'],
    },
  });

  console.log(`Admin account created: ${email}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());

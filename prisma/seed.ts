import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting database seed...');

  // Check if admin user already exists
  const existingAdmin = await prisma.user.findUnique({
    where: { email: 'admin@school.edu' }
  });

  if (existingAdmin) {
    console.log('✅ Admin user already exists');
    return;
  }

  // Create admin user (password will be handled by NextAuth in demo mode)
  const adminUser = await prisma.user.create({
    data: {
      email: 'admin@school.edu',
      name: 'System Administrator',
      role: 'ADMIN',
    }
  });

  console.log('✅ Admin user created successfully');
  console.log('📧 Email: admin@school.edu');
  console.log('🔑 Password: admin123 (demo credentials)');
  console.log('👤 Role: ADMIN');
}

main()
  .catch((e) => {
    console.error('❌ Error during seeding:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

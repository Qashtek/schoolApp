import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const DEFAULT_SCHOOL_NAME = 'Demo School';
const DEMO_ADMIN_EMAIL = 'admin@school.edu';

async function getOrCreateDefaultSchool() {
  const existingSchool = await prisma.school.findFirst({
    where: { name: DEFAULT_SCHOOL_NAME },
  });

  if (existingSchool) {
    return existingSchool;
  }

  return prisma.school.create({
    data: { name: DEFAULT_SCHOOL_NAME },
  });
}

async function main() {
  console.log('Starting database seed...');

  const school = await getOrCreateDefaultSchool();
  console.log(`Default school ready: ${school.name} (${school.id})`);

  const adminUser = await prisma.user.findUnique({
    where: { email: DEMO_ADMIN_EMAIL },
  });

  if (!adminUser) {
    console.log(`Admin user not found: ${DEMO_ADMIN_EMAIL}`);
    return;
  }

  if (adminUser.schoolId === school.id) {
    console.log(`Admin already linked to school: ${DEMO_ADMIN_EMAIL}`);
    return;
  }

  await prisma.user.update({
    where: { id: adminUser.id },
    data: { schoolId: school.id },
  });

  console.log(`Linked admin to school: ${DEMO_ADMIN_EMAIL} -> ${school.name}`);

  // Assign all teachers to default school
  const teachers = await prisma.user.findMany({ where: { role: "TEACHER" } });
  for (const teacher of teachers) {
    if (!teacher.schoolId) {
      await prisma.user.update({
        where: { id: teacher.id },
        data: { schoolId: school.id },
      });
      console.log(`Assigned school to teacher: ${teacher.name} (${teacher.id})`);
    }
  }
}

main()
  .catch((e) => {
    console.error('Error during seeding:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

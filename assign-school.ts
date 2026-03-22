import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const school = await prisma.school.findFirst();
  if (!school) {
    return;
  }

  const teachers = await prisma.user.findMany({
    where: { role: 'TEACHER' },
    include: { teacher: true }
  });

  for (const teacher of teachers) {
    if (!teacher.schoolId) {
      await prisma.user.update({
        where: { id: teacher.id },
        data: { schoolId: school.id }
      });
    }

    // Also update teacher record if it exists
    if (teacher.teacher && !teacher.teacher.schoolId) {
      await prisma.teacher.update({
        where: { id: teacher.teacher.id },
        data: { schoolId: school.id }
      });
    }
  }
}

main()
  .catch((e) => {
    console.error('Error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

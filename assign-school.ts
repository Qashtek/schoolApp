import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Assigning school to teachers...');

  const school = await prisma.school.findFirst();
  if (!school) {
    console.log('No school found');
    return;
  }

  console.log(`Using school: ${school.name} (${school.id})`);

  const teachers = await prisma.user.findMany({
    where: { role: 'TEACHER' },
    include: { teacher: true }
  });

  console.log(`Found ${teachers.length} teachers`);

  for (const teacher of teachers) {
    if (!teacher.schoolId) {
      await prisma.user.update({
        where: { id: teacher.id },
        data: { schoolId: school.id }
      });
      console.log(`Assigned school to teacher: ${teacher.name} (${teacher.id})`);
    } else {
      console.log(`Teacher already has school: ${teacher.name} (${teacher.id})`);
    }

    // Also update teacher record if it exists
    if (teacher.teacher && !teacher.teacher.schoolId) {
      await prisma.teacher.update({
        where: { id: teacher.teacher.id },
        data: { schoolId: school.id }
      });
      console.log(`Updated teacher record: ${teacher.teacher.id}`);
    }
  }

  console.log('Done!');
}

main()
  .catch((e) => {
    console.error('Error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

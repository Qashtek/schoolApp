import { PrismaClient } from '@prisma/client';
import { hash } from 'bcryptjs';

const prisma = new PrismaClient();
const DEFAULT_SCHOOL_NAME = 'Demo School';
const DEMO_ADMIN_EMAIL = 'admin@school.edu';
const DEMO_ADMIN_PASSWORD = 'admin123';

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

  const adminUser = await prisma.user.findUnique({ where: { email: DEMO_ADMIN_EMAIL } });

  if (!adminUser) {
    const hashedPassword = await hash(DEMO_ADMIN_PASSWORD, 12);
    const createdAdmin = await prisma.user.create({
      data: {
        email: DEMO_ADMIN_EMAIL,
        name: 'Admin User',
        role: 'ADMIN',
        password: hashedPassword,
        schoolId: school.id,
      },
    });
    console.log(
      `Created default admin: ${createdAdmin.email} (password: ${DEMO_ADMIN_PASSWORD})`
    );
  } else {
    const needsUpdate =
      adminUser.schoolId !== school.id || adminUser.role !== 'ADMIN' || !adminUser.password;

    if (needsUpdate) {
      await prisma.user.update({
        where: { id: adminUser.id },
        data: {
          schoolId: school.id,
          role: 'ADMIN',
          password: adminUser.password ?? (await hash(DEMO_ADMIN_PASSWORD, 12)),
        },
      });
      console.log(`Updated default admin: ${DEMO_ADMIN_EMAIL}`);
    } else {
      console.log(`Default admin already configured: ${DEMO_ADMIN_EMAIL}`);
    }
  }

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

  // Assign all users with null schoolId to default school
  const usersWithoutSchool = await prisma.user.findMany({
    where: { schoolId: null },
  });
  console.log(`Found ${usersWithoutSchool.length} users without schoolId`);
  for (const user of usersWithoutSchool) {
    await prisma.user.update({
      where: { id: user.id },
      data: { schoolId: school.id },
    });
    console.log(`Assigned school to user: ${user.name} (${user.email})`);
  }

  // Assign all teachers with null schoolId to default school
  const teachersWithoutSchool = await prisma.teacher.findMany({
    where: { schoolId: null },
    include: { user: true },
  });
  console.log(`Found ${teachersWithoutSchool.length} teachers without schoolId`);
  for (const teacher of teachersWithoutSchool) {
    await prisma.teacher.update({
      where: { id: teacher.id },
      data: { schoolId: school.id },
    });
    console.log(`Assigned school to teacher: ${teacher.user.name}`);
  }

  // Assign all students with null schoolId to default school
  // NOTE: `Student.schoolId` is required in the Prisma schema, so Prisma Client
  // doesn't allow `where: { schoolId: null }`. If legacy data exists with NULL
  // values (from older migrations), handle it via a raw query to avoid crashing.
  const studentsWithNullSchoolId = await prisma.$queryRaw<Array<{ id: string }>>`
    SELECT id FROM students WHERE schoolId IS NULL
  `;
  console.log(`Found ${studentsWithNullSchoolId.length} students with NULL schoolId`);
  for (const student of studentsWithNullSchoolId) {
    await prisma.student.update({
      where: { id: student.id },
      data: { schoolId: school.id },
    });
    console.log(`Assigned school to student: ${student.id}`);
  }

  // Assign all classes with null schoolId to default school
  const classesWithoutSchool = await prisma.class.findMany({
    where: { schoolId: null },
  });
  console.log(`Found ${classesWithoutSchool.length} classes without schoolId`);
  for (const cls of classesWithoutSchool) {
    await prisma.class.update({
      where: { id: cls.id },
      data: { schoolId: school.id },
    });
    console.log(`Assigned school to class: ${cls.name}`);
  }
  console.log('Database seed completed successfully');
}

main()
  .catch((e) => {
    console.error('Error during seeding:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

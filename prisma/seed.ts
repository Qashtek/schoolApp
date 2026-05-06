import { PrismaClient } from '@prisma/client';
import { hash } from 'bcryptjs';

const prisma = new PrismaClient();
const DEFAULT_SCHOOL_NAME = 'Demo School';
const DEMO_ADMIN_EMAIL = 'admin@school.edu';
const DEMO_ADMIN_PASSWORD = 'admin123';
const SUPER_ADMIN_NAME = 'Super Admin';
const SUPER_ADMIN_EMAIL = 'superadmin@system.com';
const SUPER_ADMIN_PASSWORD = 'superadmin123';

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
  const school = await getOrCreateDefaultSchool();

  const adminUser = await prisma.user.findUnique({ where: { email: DEMO_ADMIN_EMAIL } });

  if (!adminUser) {
    const hashedPassword = await hash(DEMO_ADMIN_PASSWORD, 12);
    await prisma.user.create({
      data: {
        email: DEMO_ADMIN_EMAIL,
        name: 'Admin User',
        role: 'ADMIN',
        password: hashedPassword,
        schoolId: school.id,
      },
    });
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
    }
  }

  const superAdminUser = await prisma.user.findUnique({
    where: { email: SUPER_ADMIN_EMAIL },
  });

  if (!superAdminUser) {
    const hashedPassword = await hash(SUPER_ADMIN_PASSWORD, 12);
    await prisma.user.create({
      data: {
        email: SUPER_ADMIN_EMAIL,
        name: SUPER_ADMIN_NAME,
        role: 'SUPER_ADMIN',
        password: hashedPassword,
        schoolId: null,
      },
    });
  } else {
    const needsUpdate =
      superAdminUser.name !== SUPER_ADMIN_NAME ||
      superAdminUser.role !== 'SUPER_ADMIN' ||
      superAdminUser.schoolId !== null ||
      !superAdminUser.password;

    if (needsUpdate) {
      await prisma.user.update({
        where: { id: superAdminUser.id },
        data: {
          name: SUPER_ADMIN_NAME,
          role: 'SUPER_ADMIN',
          schoolId: null,
          password: superAdminUser.password ?? (await hash(SUPER_ADMIN_PASSWORD, 12)),
        },
      });
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
    }
  }

  // Assign all users with null schoolId to default school
  const usersWithoutSchool = await prisma.user.findMany({
    where: {
      schoolId: null,
      role: {
        not: 'SUPER_ADMIN',
      },
    },
  });
  for (const user of usersWithoutSchool) {
    await prisma.user.update({
      where: { id: user.id },
      data: { schoolId: school.id },
    });
  }

  // Assign all teachers with null schoolId to default school
  const teachersWithoutSchool = await prisma.teacher.findMany({
    where: { schoolId: null },
    include: { user: true },
  });
  for (const teacher of teachersWithoutSchool) {
    await prisma.teacher.update({
      where: { id: teacher.id },
      data: { schoolId: school.id },
    });
  }

  // Assign all students with null schoolId to default school
  // NOTE: `Student.schoolId` is required in the Prisma schema, so Prisma Client
  // doesn't allow `where: { schoolId: null }`. If legacy data exists with NULL
  // values (from older migrations), handle it via a raw query to avoid crashing.
  const studentsWithNullSchoolId = await prisma.$queryRaw<Array<{ id: string }>>`
    SELECT id FROM students WHERE schoolId IS NULL
  `;
  for (const student of studentsWithNullSchoolId) {
    await prisma.student.update({
      where: { id: student.id },
      data: { schoolId: school.id },
    });
  }

  // Assign all classes with null schoolId to default school
  const classesWithoutSchool = await prisma.class.findMany({
    where: { schoolId: null },
  });
  for (const cls of classesWithoutSchool) {
    await prisma.class.update({
      where: { id: cls.id },
      data: { schoolId: school.id },
    });
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

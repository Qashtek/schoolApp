import { PrismaClient } from '@prisma/client';

/**
 * Backfill script: creates missing class_subjects rows.
 *
 * When a teacher is assigned as a SUBJECT_TEACHER for a subject in a class,
 * the assignment lives in teacher_class_subjects. The subject should also be
 * linked to the class through class_subjects (which is what the grade entry
 * page, class/subject detail pages and report cards rely on). Older data may
 * have teacher assignments without the corresponding class_subjects link.
 *
 * Run with: npx ts-node --project tsconfig.seed.json scripts/backfill-class-subjects.ts
 */
const prisma = new PrismaClient();

async function main() {
  const assignments = await prisma.teacherClassSubject.findMany({
    where: {
      assignmentType: 'SUBJECT_TEACHER',
      subjectId: { not: null },
    },
    select: {
      classId: true,
      subjectId: true,
    },
  });

  const seen = new Set<string>();
  let created = 0;
  let alreadyLinked = 0;

  for (const assignment of assignments) {
    const key = `${assignment.classId}:${assignment.subjectId}`;
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);

    const existing = await prisma.classSubject.findUnique({
      where: {
        classId_subjectId: {
          classId: assignment.classId,
          subjectId: assignment.subjectId,
        },
      },
      select: { id: true },
    });

    if (existing) {
      alreadyLinked += 1;
      continue;
    }

    await prisma.classSubject.create({
      data: {
        classId: assignment.classId,
        subjectId: assignment.subjectId,
      },
    });
    created += 1;
  }

  console.log(`Backfill complete: ${created} class_subjects created, ${alreadyLinked} already linked.`);
}

main()
  .catch((e) => {
    console.error('Error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

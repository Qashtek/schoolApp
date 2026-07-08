import Link from 'next/link';
import { getServerSession } from 'next-auth';
import { redirect } from 'next/navigation';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export default async function TeacherGradesIndexPage() {
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    redirect('/login');
  }

  if (session.user.role !== 'TEACHER') {
    redirect('/dashboard');
  }

  const teacher = await prisma.teacher.findFirst({
    where: {
      userId: session.user.id,
      deletedAt: null,
    },
    select: {
      id: true,
      type: true,
    },
  });

  if (!teacher) {
    redirect('/dashboard/teacher');
  }

  // Fetch all SUBJECT_TEACHER assignments for this teacher via TeacherClassSubject
  const subjectAssignments = await prisma.teacherClassSubject.findMany({
    where: {
      teacherId: teacher.id,
      assignmentType: 'SUBJECT_TEACHER',
      subjectId: { not: null },
    },
    select: {
      subject: {
        select: {
          id: true,
          name: true,
          code: true,
        },
      },
      class: {
        select: {
          id: true,
          name: true,
          grade: true,
        },
      },
    },
    orderBy: [
      { class: { name: 'asc' } },
    ],
  });

  // Also include CLASS_TEACHER assignments (class teachers can grade any subject in their class)
  const classTeacherAssignments = await prisma.teacherClassSubject.findMany({
    where: {
      teacherId: teacher.id,
      assignmentType: 'CLASS_TEACHER',
    },
    select: {
      class: {
        select: {
          id: true,
          name: true,
          grade: true,
        },
      },
    },
  });

  // For class teacher assignments, fetch all subjects for those classes
  const classTeacherClassIds = classTeacherAssignments.map((a) => a.class.id);

  if (classTeacherClassIds.length > 0) {
    const allClassSubjects = await prisma.classSubject.findMany({
      where: {
        classId: { in: classTeacherClassIds },
      },
      select: {
        class: {
          select: {
            id: true,
            name: true,
            grade: true,
          },
        },
        subject: {
          select: {
            id: true,
            name: true,
            code: true,
          },
        },
      },
      orderBy: [
        { class: { name: 'asc' } },
      ],
    });

    subjectAssignments.push(...allClassSubjects);
  }

  const subjects = Array.from(
    (subjectAssignments as Array<{
      class: { id: string; name: string; grade: string };
      subject: { id: string; name: string; code: string };
    }>).reduce((map, assignment) => {
      const existing = map.get(assignment.subject.id) ?? {
        id: assignment.subject.id,
        name: assignment.subject.name,
        code: assignment.subject.code,
        classes: [] as Array<{ id: string; name: string; grade: string }>,
      };

      if (!existing.classes.some((c) => c.id === assignment.class.id)) {
        existing.classes.push(assignment.class);
      }

      map.set(assignment.subject.id, existing);
      return map;
    }, new Map<string, { id: string; name: string; code: string; classes: Array<{ id: string; name: string; grade: string }> }>())
      .values()
  ).sort((a, b) => a.name.localeCompare(b.name));

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-2xl font-semibold text-gray-900">Grades</h1>
        <p className="mt-1 text-sm text-gray-500">
          Select a matching subject and class to enter grades.
        </p>
      </div>

      {subjects.length === 0 ? (
        <div className="rounded-lg border border-dashed border-gray-300 bg-white p-10 text-center">
          <h2 className="text-lg font-medium text-gray-900">No matching assignments</h2>
          <p className="mt-2 text-sm text-gray-500">
            You need both subject assignments and matching class assignments before you can enter grades.
          </p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {subjects.map((subject) => (
            <div
              key={subject.id}
              className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm"
            >
              <p className="text-xs uppercase tracking-wide text-gray-500">Subject</p>
              <h2 className="mt-1 text-base font-semibold text-gray-900">
                {subject.name}
              </h2>
              <p className="mt-1 text-sm text-gray-500">Code: {subject.code}</p>
              <div className="mt-4 space-y-2">
                {subject.classes
                  .sort((a, b) => a.name.localeCompare(b.name))
                  .map((classItem) => (
                    <Link
                      key={classItem.id}
                      href={`/dashboard/teacher/grades/${classItem.id}?subjectId=${subject.id}`}
                      className="flex items-center justify-between rounded-md bg-blue-50 px-3 py-2 text-sm hover:bg-blue-100"
                    >
                      <span className="font-medium text-gray-900">{classItem.name}</span>
                      <span className="text-xs font-medium text-blue-700">Grade</span>
                    </Link>
                  ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

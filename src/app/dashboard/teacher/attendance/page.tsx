import Link from 'next/link';
import { getServerSession } from 'next-auth';
import { redirect } from 'next/navigation';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export default async function TeacherAttendanceIndexPage() {
  const session = await getServerSession(authOptions);

  if (!session?.user || session.user.role !== 'TEACHER') {
    redirect('/login');
  }

  const teacher = await prisma.teacher.findFirst({
    where: {
      userId: session.user.id,
      deletedAt: null,
    },
    select: {
      id: true,
    },
  });

  if (!teacher) {
    redirect('/dashboard/teacher');
  }

  const classTeacherAssignment = await prisma.teacherClassSubject.findFirst({
    where: {
      teacherId: teacher.id,
      assignmentType: 'CLASS_TEACHER',
    },
    select: { id: true },
  });

  if (!classTeacherAssignment) {
    return (
      <div className="p-8">
        <div className="mb-8">
          <h1 className="text-2xl font-semibold text-gray-900">Attendance</h1>
          <p className="mt-1 text-sm text-gray-500">
            Attendance is managed by class teachers.
          </p>
        </div>

        <div className="rounded-lg border border-amber-200 bg-amber-50 p-6">
          <h2 className="text-base font-semibold text-amber-900">Subject teacher access</h2>
          <p className="mt-2 text-sm text-amber-800">
            You can grade students for your assigned subjects and classes, but you cannot take attendance.
          </p>
          <Link
            href="/dashboard/teacher/grades"
            className="mt-4 inline-flex rounded-md bg-amber-600 px-4 py-2 text-sm font-medium text-white hover:bg-amber-700"
          >
            Open grades
          </Link>
        </div>
      </div>
    );
  }

  const assignedClasses = await prisma.teacherClassSubject.findMany({
    where: {
      teacherId: teacher.id,
      assignmentType: 'CLASS_TEACHER',
    },
    select: {
      class: {
        select: {
          id: true,
          name: true,
        },
      },
    },
  });

  const classes = assignedClasses
    .map((assignment) => ({
      classId: assignment.class.id,
      className: assignment.class.name,
    }))
    .sort((a, b) => a.className.localeCompare(b.className));

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-2xl font-semibold text-gray-900">Attendance</h1>
        <p className="mt-1 text-sm text-gray-500">
          Select a class to mark attendance.
        </p>
      </div>

      {classes.length === 0 ? (
        <div className="rounded-lg border border-dashed border-gray-300 bg-white p-10 text-center">
          <h2 className="text-lg font-medium text-gray-900">No classes assigned</h2>
          <p className="mt-2 text-sm text-gray-500">
            You do not have any class assignments yet.
          </p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {classes.map((classItem) => (
            <Link
              key={classItem.classId}
              href={`/dashboard/teacher/attendance/${classItem.classId}`}
              className="group rounded-lg border border-gray-200 bg-white p-5 transition hover:border-blue-300 hover:shadow-sm"
            >
              <p className="text-xs uppercase tracking-wide text-gray-500">Class</p>
              <h2 className="mt-1 text-base font-semibold text-gray-900 group-hover:text-blue-700">
                {classItem.className}
              </h2>
              <p className="mt-4 text-sm font-medium text-blue-600">Take attendance</p>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

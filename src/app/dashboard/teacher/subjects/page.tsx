import { getServerSession } from 'next-auth';
import { redirect } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { authOptions } from '@/lib/auth';
import { BookOpen, ArrowLeft } from 'lucide-react';
import Link from 'next/link';

export default async function TeacherSubjectsPage() {
  const session = await getServerSession(authOptions);

  // Check authentication and teacher role
  if (!session?.user) {
    redirect('/login');
  }

  if (session.user.role !== 'TEACHER') {
    redirect('/dashboard');
  }

  // Get the teacher's class-subject assignments via the new TeacherClassSubject model
  const teacherClassSubjects = await prisma.teacherClassSubject.findMany({
    where: {
      teacher: {
        userId: session.user.id,
        deletedAt: null,
      },
    },
    include: {
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
    orderBy: {
      createdAt: 'desc',
    },
  });

  if (teacherClassSubjects.length === 0) {
    // Check if teacher record exists at all
    const teacher = await prisma.teacher.findFirst({
      where: { userId: session.user.id, deletedAt: null },
      select: { id: true },
    });

    if (!teacher) {
      redirect('/dashboard/teacher');
    }
  }

  // Check if teacher has any CLASS_TEACHER assignment
  const teacher = await prisma.teacher.findFirst({
    where: { userId: session.user.id, deletedAt: null },
    select: { id: true },
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
  const isClassTeacher = Boolean(classTeacherAssignment);

  // Group by subject: each subject shows which classes the teacher teaches it in
  const subjectsMap = new Map<string, {
    id: string;
    name: string;
    code: string;
    classes: Array<{ id: string; name: string; grade: string }>;
  }>();

  for (const tcs of teacherClassSubjects) {
    if (!tcs.subject) continue;

    const existing = subjectsMap.get(tcs.subject.id) ?? {
      id: tcs.subject.id,
      name: tcs.subject.name,
      code: tcs.subject.code,
      classes: [],
    };

    if (!existing.classes.some((c) => c.id === tcs.class.id)) {
      existing.classes.push(tcs.class);
    }

    subjectsMap.set(tcs.subject.id, existing);
  }

  const subjectsWithClasses = Array.from(subjectsMap.values())
    .map((subject) => ({
      ...subject,
      classes: subject.classes.sort((a, b) => a.name.localeCompare(b.name)),
    }))
    .sort((a, b) => a.name.localeCompare(b.name));

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center gap-4">
            <Link
              href="/dashboard/teacher"
              className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <div>
              <h1 className="text-2xl font-semibold text-gray-900 flex items-center gap-2">
                <BookOpen className="w-6 h-6" />
                My Subjects
              </h1>
              <p className="mt-1 text-sm text-gray-500">View all assigned subjects and classes</p>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {subjectsWithClasses.length === 0 ? (
          <div className="rounded-lg border border-gray-200 bg-white p-12 text-center">
            <BookOpen className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No Subjects Assigned</h3>
            <p className="text-gray-500">
              You haven't been assigned any subjects yet. Contact your administrator to assign subjects to your account.
            </p>
          </div>
        ) : (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {subjectsWithClasses.map((subject) => (
              <div
                key={subject.id}
                className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm hover:shadow-md transition-shadow"
              >
                {/* Subject Header */}
                <div className="mb-4">
                  <h2 className="text-lg font-semibold text-gray-900">{subject.name}</h2>
                  <p className="text-sm text-gray-500">Code: {subject.code}</p>
                </div>

                {/* Classes List */}
                <div className="border-t pt-4">
                  <h3 className="text-sm font-medium text-gray-700 mb-3">Classes</h3>
                  {subject.classes.length === 0 ? (
                    <p className="text-sm text-gray-500 italic">No classes assigned for this subject</p>
                  ) : (
                    <ul className="space-y-2">
                      {subject.classes.map((cls) => (
                        <li key={cls.id}>
                          <Link
                            href={`/dashboard/teacher/grades/${cls.id}?subjectId=${subject.id}`}
                            className="flex items-center gap-2 rounded-md bg-blue-50 px-3 py-2 text-sm hover:bg-blue-100"
                          >
                            <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-blue-200 text-blue-700 text-xs font-semibold">
                              {cls.grade}
                            </span>
                            <span className="font-medium text-gray-900">{cls.name}</span>
                            <span className="ml-auto text-xs font-medium text-blue-700">Grade</span>
                          </Link>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>

                {/* Subject Stats */}
                <div className="mt-4 border-t pt-4 text-xs text-gray-500">
                  <p>Classes: {subject.classes.length}</p>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Info Section */}
        {!isClassTeacher && (
          <div className="mt-8 rounded-lg bg-blue-50 border border-blue-200 p-4">
            <h3 className="text-sm font-medium text-blue-900 mb-2">Subject Teacher Information</h3>
            <p className="text-sm text-blue-700">
              As a subject teacher, you can grade students for the subjects and classes shown above. You cannot take attendance.
            </p>
          </div>
        )}

        {isClassTeacher && (
          <div className="mt-8 rounded-lg bg-green-50 border border-green-200 p-4">
            <h3 className="text-sm font-medium text-green-900 mb-2">Class Teacher Information</h3>
            <p className="text-sm text-green-700">
              As a class teacher, you can take attendance and grade students for the classes and subjects shown above.
            </p>
          </div>
        )}
      </main>
    </div>
  );
}

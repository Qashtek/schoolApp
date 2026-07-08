import { getServerSession } from 'next-auth';
import { notFound, redirect } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, BookOpen, Users } from 'lucide-react';
import { authOptions, Role } from '@/lib/auth';
import { isAdmin, isSuperAdmin } from '@/lib/permissions';
import { prisma } from '@/lib/prisma';
import { TeacherService } from '@/lib/services/teacher.service';
import { ClassDetailAssignmentManager } from './assignment-forms';

export default async function AdminClassDetailPage({
  params,
}: {
  params: { classId: string };
}) {
  const session = await getServerSession(authOptions);

  if (!session?.user?.role || !isAdmin(session.user.role)) {
    redirect('/dashboard');
  }

  const classId = params.classId;
  const schoolId = session.user.schoolId;

  if (!schoolId) {
    redirect('/dashboard');
  }

  // Fetch class directly
  const classRecord = await prisma.class.findFirst({
    where: { id: classId, deletedAt: null },
    include: {
      school: {
        select: { id: true, name: true },
      },
      _count: {
        select: { students: true },
      },
    },
  });

  if (!classRecord) {
    notFound();
  }

  // Verify school access
  if (!isSuperAdmin(session.user.role) && classRecord.schoolId !== schoolId) {
    redirect('/dashboard');
  }

  const user = {
    id: session.user.id,
    email: session.user.email ?? '',
    name: session.user.name,
    role: session.user.role as Role,
    schoolId,
  };

  const teacherService = new TeacherService(user);

  // Fetch assignments using TeacherService
  const [classTeacher, subjectTeachers] = await Promise.all([
    teacherService.getClassTeacher(classId),
    teacherService.getSubjectTeachers(classId),
  ]);

  // Fetch all teachers in the school for form dropdowns
  const allTeachers = await prisma.teacher.findMany({
    where: { schoolId, deletedAt: null, isActive: true },
    select: {
      id: true,
      user: {
        select: { name: true, email: true },
      },
    },
    orderBy: { user: { name: 'asc' } },
  });

  const teacherOptions = allTeachers.map((t) => ({
    id: t.id,
    name: t.user.name,
    email: t.user.email,
  }));

  // Fetch subjects assigned to this class for the add subject teacher form
  const classSubjects = await prisma.classSubject.findMany({
    where: { classId },
    select: {
      subject: {
        select: { id: true, name: true, code: true },
      },
    },
    orderBy: { subject: { name: 'asc' } },
  });

  const subjectOptions = classSubjects.map((cs) => cs.subject);

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm">
        <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
          <div className="flex items-center gap-4">
            <Link
              href="/dashboard/admin/classes"
              className="rounded-lg p-2 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600"
            >
              <ArrowLeft className="h-5 w-5" />
            </Link>
            <div>
              <h1 className="text-2xl font-semibold text-gray-900">{classRecord.name}</h1>
              <p className="mt-1 text-sm text-gray-500">
                Grade {classRecord.grade}
                {classRecord.school ? ` - ${classRecord.school.name}` : ''}
              </p>
            </div>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl space-y-8 px-4 py-8 sm:px-6 lg:px-8">
        {/* Class Info Card */}
        <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
          <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold text-gray-900">
            <BookOpen className="h-5 w-5" />
            Class Information
          </h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <p className="text-xs font-medium uppercase text-gray-500">Name</p>
              <p className="text-sm text-gray-900">{classRecord.name}</p>
            </div>
            <div>
              <p className="text-xs font-medium uppercase text-gray-500">Grade</p>
              <p className="text-sm text-gray-900">{classRecord.grade}</p>
            </div>
            {classRecord.description && (
              <div className="sm:col-span-2">
                <p className="text-xs font-medium uppercase text-gray-500">Description</p>
                <p className="text-sm text-gray-900">{classRecord.description}</p>
              </div>
            )}
            <div>
              <p className="text-xs font-medium uppercase text-gray-500">Students</p>
              <p className="text-sm text-gray-900">{classRecord._count.students}</p>
            </div>
          </div>
        </div>

        {/* Assignment Manager Client Component */}
        <ClassDetailAssignmentManager
          classId={classId}
          classTeacher={
            classTeacher
              ? {
                  id: classTeacher.id,
                  teacherId: classTeacher.teacher.id,
                  teacherName: classTeacher.teacher.user.name ?? null,
                  teacherEmail: classTeacher.teacher.user.email,
                }
              : null
          }
          subjectTeachers={subjectTeachers.map((a) => ({
            id: a.id,
            teacherId: a.teacher.id,
            teacherName: a.teacher.user.name ?? null,
            teacherEmail: a.teacher.user.email,
            subjectId: a.subject?.id ?? '',
            subjectName: a.subject?.name ?? '',
            subjectCode: a.subject?.code ?? '',
          }))}
          teacherOptions={teacherOptions}
          subjectOptions={subjectOptions}
        />
      </main>
    </div>
  );
}

import { getServerSession } from 'next-auth';
import { notFound, redirect } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Mail, User } from 'lucide-react';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { AssignmentManager } from './assignment-forms';

export default async function TeacherDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    redirect('/login');
  }

  if (session.user.role !== 'ADMIN') {
    redirect('/dashboard');
  }

  if (!session.user.schoolId) {
    redirect('/dashboard');
  }

  const teacherId = params.id;
  const schoolId = session.user.schoolId;

  // Fetch teacher with user details and all current assignments
  const teacher = await prisma.teacher.findFirst({
    where: {
      id: teacherId,
      schoolId,
      deletedAt: null,
    },
    include: {
      user: {
        select: {
          id: true,
          name: true,
          email: true,
        },
      },
      classSubjects: {
        include: {
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
        orderBy: { createdAt: 'desc' },
      },
    },
  });

  if (!teacher) {
    notFound();
  }

  // Separate assignments by type
  const classTeacherAssignment = teacher.classSubjects.find(
    (cs) => cs.assignmentType === 'CLASS_TEACHER'
  ) ?? null;

  const subjectTeacherAssignments = teacher.classSubjects.filter(
    (cs) => cs.assignmentType === 'SUBJECT_TEACHER'
  );

  // Fetch all classes and subjects for the add forms
  const [allClasses, allSubjects] = await Promise.all([
    prisma.class.findMany({
      where: { schoolId, deletedAt: null },
      select: { id: true, name: true, grade: true },
      orderBy: { name: 'asc' },
    }),
    prisma.subject.findMany({
      where: { schoolId, deletedAt: null },
      select: { id: true, name: true, code: true },
      orderBy: { name: 'asc' },
    }),
  ]);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center gap-4">
            <Link
              href="/dashboard/admin/teachers"
              className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <div>
              <h1 className="text-2xl font-semibold text-gray-900">
                {teacher.user.name || 'Unnamed Teacher'}
              </h1>
              <p className="mt-1 text-sm text-gray-500">Manage class and subject assignments</p>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        {/* Teacher Info Card */}
        <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Teacher Information</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="flex items-start gap-3">
              <User className="w-5 h-5 text-gray-400 mt-0.5" />
              <div>
                <p className="text-xs font-medium text-gray-500 uppercase">Name</p>
                <p className="text-sm text-gray-900">{teacher.user.name || 'Not set'}</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <Mail className="w-5 h-5 text-gray-400 mt-0.5" />
              <div>
                <p className="text-xs font-medium text-gray-500 uppercase">Email</p>
                <p className="text-sm text-gray-900">{teacher.user.email}</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <span
                className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${
                  teacher.isActive
                    ? 'bg-green-100 text-green-800'
                    : 'bg-gray-100 text-gray-800'
                }`}
              >
                {teacher.isActive ? 'Active' : 'Inactive'}
              </span>
            </div>
          </div>
        </div>

        {/* Assignment Manager Client Component */}
        <AssignmentManager
          teacherId={teacherId}
          classTeacherAssignment={
            classTeacherAssignment
              ? {
                  id: classTeacherAssignment.id,
                  classId: classTeacherAssignment.classId,
                  className: classTeacherAssignment.class.name,
                  classGrade: classTeacherAssignment.class.grade,
                }
              : null
          }
          subjectTeacherAssignments={subjectTeacherAssignments.map((a) => ({
            id: a.id,
            classId: a.classId,
            className: a.class.name,
            classGrade: a.class.grade,
            subjectId: a.subjectId ?? '',
            subjectName: a.subject?.name ?? '',
            subjectCode: a.subject?.code ?? '',
          }))}
          allClasses={allClasses.map((c) => ({
            id: c.id,
            name: c.name,
            grade: c.grade,
          }))}
          allSubjects={allSubjects.map((s) => ({
            id: s.id,
            name: s.name,
            code: s.code,
          }))}
        />
      </main>
    </div>
  );
}

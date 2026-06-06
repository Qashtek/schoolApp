import { getServerSession } from 'next-auth';
import { notFound, redirect } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, BookOpen, Mail, User } from 'lucide-react';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { ManageSubjectsForm } from './assignment-forms';

export default async function TeacherDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const session = await getServerSession(authOptions);

  // Check authentication and admin role
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

  // Fetch teacher details with subjects and classes
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
      subjects: {
        include: {
          subject: {
            select: {
              id: true,
              name: true,
              code: true,
            },
          },
        },
        orderBy: {
          createdAt: 'desc',
        },
      },
      classes: {
        include: {
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
      },
    },
  });

  if (!teacher) {
    notFound();
  }

  // Fetch all subjects available in the school
  const allSubjects = await prisma.subject.findMany({
    where: {
      schoolId,
      deletedAt: null,
    },
    select: {
      id: true,
      name: true,
      code: true,
    },
    orderBy: {
      name: 'asc',
    },
  });

  // Get assigned subject IDs
  const assignedSubjectIds = new Set(teacher.subjects.map((ts) => ts.subjectId));

  // Filter available subjects (not yet assigned)
  const availableSubjects = allSubjects.filter(
    (subject) => !assignedSubjectIds.has(subject.id)
  );

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
              <p className="mt-1 text-sm text-gray-500">Manage subject assignments</p>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Teacher Info Card */}
        <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm mb-8">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Teacher Information</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="flex items-start gap-3">
              <User className="w-5 h-5 text-gray-400 mt-0.5" />
              <div>
                <p className="text-xs font-medium text-gray-500 uppercase">Name</p>
                <p className="text-sm text-gray-900">
                  {teacher.user.name || 'Not set'}
                </p>
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

        <div className="grid gap-8 lg:grid-cols-3">
          {/* Main Content - Subject Management */}
          <div className="lg:col-span-2">
            <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
              <ManageSubjectsForm
                teacherId={teacherId}
                assignedSubjects={teacher.subjects.map((ts) => ({
                  id: ts.subject.id,
                  teacherSubjectId: ts.id,
                  name: ts.subject.name,
                  code: ts.subject.code,
                }))}
                availableSubjects={availableSubjects}
              />
            </div>
          </div>

          {/* Sidebar - Classes */}
          <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <BookOpen className="w-5 h-5" />
              Assigned Classes
            </h2>
            {teacher.classes.length === 0 ? (
              <p className="text-sm text-gray-500">No classes assigned yet.</p>
            ) : (
              <ul className="space-y-2">
                {teacher.classes.map((tc) => (
                  <li
                    key={tc.id}
                    className="rounded-md border border-gray-100 bg-gray-50 px-3 py-2 text-sm"
                  >
                    <p className="font-medium text-gray-900">{tc.class.name}</p>
                    <p className="text-xs text-gray-500">Grade: {tc.class.grade}</p>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}

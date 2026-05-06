import { getServerSession } from 'next-auth';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { Users, Plus, BookOpen } from 'lucide-react';
import { authOptions } from '@/lib/auth';
import { TeacherService } from '@/lib/services/teacher.service';
import { isAdmin, Role } from '@/lib/permissions';
import { prisma } from '@/lib/prisma';
import { FlashSuccess } from '../sessions/flash-success';
import { ConfirmSubmitButton } from '@/components/confirm-submit-button';

async function deleteTeacherAction(formData: FormData) {
  'use server';

  const session = await getServerSession(authOptions);

  if (!session?.user?.role || !isAdmin(session.user.role)) {
    return;
  }

  const teacherId = String(formData.get('teacherId') ?? '').trim();
  if (!teacherId) {
    return;
  }

  const teacher = await prisma.teacher.findUnique({
    where: { id: teacherId },
    select: {
      id: true,
      schoolId: true,
      userId: true,
      user: {
        select: {
          role: true,
        },
      },
    },
  });

  if (!teacher) {
    return;
  }

  if (session.user.role !== 'SUPER_ADMIN') {
    if (!session.user.schoolId || teacher.schoolId !== session.user.schoolId) {
      return;
    }
  }

  if (teacher.user.role === 'TEACHER') {
    await prisma.user.delete({
      where: {
        id: teacher.userId,
      },
    });
  } else {
    await prisma.teacher.delete({
      where: {
        id: teacher.id,
      },
    });
  }

  revalidatePath('/dashboard/admin/teachers');
  redirect('/dashboard/admin/teachers?teacherDeleted=1');
}

export default async function AdminTeachersPage({
  searchParams,
}: {
  searchParams?: { teacherDeleted?: string };
}) {
  const session = await getServerSession(authOptions);

  // Check authentication and admin role
  if (!session?.user) {
    redirect('/login');
  }

  const userRole = session.user.role as Role;
  if (!isAdmin(userRole)) {
    redirect('/dashboard');
  }

  if (userRole !== 'SUPER_ADMIN' && !session.user.schoolId) {
    redirect('/dashboard');
  }

  // Fetch teachers using service directly (server-side)
  const user = {
    id: session.user.id,
    role: userRole,
    email: session.user.email,
    schoolId: session.user.schoolId,
  };

  const teacherService = new TeacherService(user);
  const { teachers } = await teacherService.getAllTeachers(
    userRole === 'SUPER_ADMIN'
      ? undefined
      : {
          schoolId: session.user.schoolId,
        }
  );

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-semibold text-gray-900">
                Teachers Management
              </h1>
              <p className="mt-1 text-sm text-gray-500">
                Manage teacher accounts and assignments
              </p>
            </div>
            <Link
              href="/dashboard/admin/teachers/new"
              className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              <Plus className="w-4 h-4" />
              Add Teacher
            </Link>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {searchParams?.teacherDeleted === '1' && (
          <FlashSuccess
            message="Teacher deleted successfully."
            queryKey="teacherDeleted"
            timeoutMs={15000}
          />
        )}

        {/* Teachers List */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-100">
          {teachers.length === 0 ? (
            <div className="p-12 text-center">
              <Users className="w-12 h-12 text-gray-300 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">
                No teachers found
              </h3>
              <p className="text-sm text-gray-500 mb-6">
                Get started by adding your first teacher
              </p>
              <Link
                href="/dashboard/admin/teachers/new"
                className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                <Plus className="w-4 h-4" />
                Add Teacher
              </Link>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-100">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Teacher
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Subject
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Classes
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Joined
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {teachers.map((teacher) => (
                    <tr key={teacher.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 bg-gray-100 rounded-full flex items-center justify-center">
                            <span className="text-sm font-medium text-gray-600">
                              {teacher.user.name
                                ?.split(' ')
                                .map((n) => n[0])
                                .join('')
                                .toUpperCase() || 'T'}
                            </span>
                          </div>
                          <div>
                            <p className="text-sm font-medium text-gray-900">
                              {teacher.user.name || 'Unnamed Teacher'}
                            </p>
                            <p className="text-xs text-gray-500">
                              {teacher.user.email}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className="text-sm text-gray-900">
                          {teacher.subject || 'Not assigned'}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <BookOpen className="w-4 h-4 text-gray-400" />
                          <span className="text-sm text-gray-900">
                            {teacher.classes.length > 0
                              ? teacher.classes.map((tc) => tc.class.name).join(', ')
                              : 'No classes'}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span
                          className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${
                            teacher.isActive
                              ? 'bg-green-100 text-green-800'
                              : 'bg-gray-100 text-gray-800'
                          }`}
                        >
                          {teacher.isActive ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <span className="text-sm text-gray-500">
                          {new Date(teacher.createdAt).toLocaleDateString()}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <form action={deleteTeacherAction}>
                          <input type="hidden" name="teacherId" value={teacher.id} />
                          <ConfirmSubmitButton
                            confirmMessage={`Delete teacher "${teacher.user.name || teacher.user.email}"? This action cannot be undone.`}
                            className="inline-flex items-center rounded-md border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-medium text-red-700 hover:bg-red-100"
                          >
                            Delete
                          </ConfirmSubmitButton>
                        </form>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Stats Cards */}
        <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-white rounded-lg shadow-sm border border-gray-100 p-6">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-blue-50 rounded-lg">
                <Users className="w-6 h-6 text-blue-600" />
              </div>
              <div>
                <p className="text-sm text-gray-500">Total Teachers</p>
                <p className="text-2xl font-semibold text-gray-900">
                  {teachers.length}
                </p>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-lg shadow-sm border border-gray-100 p-6">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-green-50 rounded-lg">
                <Users className="w-6 h-6 text-green-600" />
              </div>
              <div>
                <p className="text-sm text-gray-500">Active Teachers</p>
                <p className="text-2xl font-semibold text-gray-900">
                  {teachers.filter((t) => t.isActive).length}
                </p>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-lg shadow-sm border border-gray-100 p-6">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-purple-50 rounded-lg">
                <BookOpen className="w-6 h-6 text-purple-600" />
              </div>
              <div>
                <p className="text-sm text-gray-500">Assigned Classes</p>
                <p className="text-2xl font-semibold text-gray-900">
                  {teachers.reduce((acc, t) => acc + t.classes.length, 0)}
                </p>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

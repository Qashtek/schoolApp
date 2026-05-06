import { getServerSession } from 'next-auth';
import { redirect } from 'next/navigation';
import { BookOpen, Users, Calendar, User, Lock } from 'lucide-react';
import { authOptions } from '@/lib/auth';
import { TeacherService } from '@/lib/services/teacher.service';
import { Role } from '@/lib/permissions';
import Link from 'next/link';

export default async function TeacherDashboardPage() {
  const session = await getServerSession(authOptions);

  // Check authentication and teacher role
  if (!session?.user) {
    redirect('/login');
  }

  const userRole = session.user.role as Role;
  if (userRole !== 'TEACHER') {
    redirect('/dashboard');
  }

  // Fetch teacher data using service
  const user = {
    id: session.user.id,
    role: userRole,
    email: session.user.email,
  };

  const teacherService = new TeacherService(user);
  let teacher;
  try {
    teacher = await teacherService.getTeacherByUserId(session.user.id);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to load teacher profile';
    return (
      <div className="p-8">
        <div className="max-w-2xl rounded-lg border border-amber-200 bg-amber-50 p-6">
          <h1 className="text-xl font-semibold text-amber-900">Teacher Profile Missing</h1>
          <p className="mt-2 text-sm text-amber-800">
            Your account is authenticated but no teacher profile is linked yet. Contact an admin to complete setup.
          </p>
          <p className="mt-3 text-xs text-amber-700">{message}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-8">
      {/* Page header */}
      <div className="mb-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold text-gray-900">
              Teacher Dashboard
            </h1>
            <p className="mt-1 text-sm text-gray-500">
              Welcome back, {teacher.user.name}
            </p>
          </div>
          <Link
            href="/dashboard/change-password"
            className="inline-flex items-center gap-2 rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            <Lock className="h-4 w-4" />
            Change Password
          </Link>
        </div>
      </div>

      <div className="mb-8 rounded-lg border border-amber-200 bg-amber-50 p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-amber-800">
            For security, change your admin-provided default password as soon as you sign in.
          </p>
          <Link
            href="/dashboard/change-password"
            className="inline-flex items-center gap-2 rounded-md bg-amber-600 px-3 py-2 text-xs font-semibold text-white hover:bg-amber-700"
          >
            <Lock className="h-3.5 w-3.5" />
            Update Password
          </Link>
        </div>
      </div>

      {/* Teacher Info Card */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-100 p-6 mb-8">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center">
            <User className="w-8 h-8 text-blue-600" />
          </div>
          <div>
            <h2 className="text-xl font-semibold text-gray-900">
              {teacher.user.name}
            </h2>
            <p className="text-sm text-gray-500">{teacher.user.email}</p>
            {teacher.subject && (
              <p className="text-sm text-gray-600 mt-1">
                Subject: {teacher.subject}
              </p>
            )}
            {teacher.school && (
              <p className="text-sm text-gray-600">
                School: {teacher.school.name}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="bg-white rounded-lg shadow-sm border border-gray-100 p-6">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-blue-50 rounded-lg">
              <BookOpen className="w-6 h-6 text-blue-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Assigned Classes</p>
              <p className="text-2xl font-semibold text-gray-900">
                {teacher.classes.length}
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
              <p className="text-sm text-gray-500">Total Students</p>
              <p className="text-2xl font-semibold text-gray-900">
                {teacher.classes.reduce((acc, tc) => acc + tc.class._count.students, 0)}
              </p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-lg shadow-sm border border-gray-100 p-6">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-purple-50 rounded-lg">
              <Calendar className="w-6 h-6 text-purple-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Active Since</p>
              <p className="text-lg font-semibold text-gray-900">
                {new Date(teacher.createdAt).toLocaleDateString()}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Assigned Classes */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-100">
        <div className="px-6 py-4 border-b border-gray-100">
          <h3 className="text-lg font-medium text-gray-900">My Classes</h3>
          <p className="text-sm text-gray-500">Classes you are assigned to teach</p>
        </div>

        {teacher.classes.length === 0 ? (
          <div className="p-12 text-center">
            <BookOpen className="w-12 h-12 text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              No classes assigned
            </h3>
            <p className="text-sm text-gray-500">
              You haven't been assigned to any classes yet.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Class Name
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Grade
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Students
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    School
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {teacher.classes.map((tc) => (
                  <tr key={tc.class.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4">
                      <span className="text-sm font-medium text-gray-900">
                        {tc.class.name}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-sm text-gray-900">
                        Grade {tc.class.grade}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-sm text-gray-900">
                        {tc.class._count.students} students
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-sm text-gray-500">
                        {tc.class.school?.name || 'Not assigned'}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <Link
                        href={`/dashboard/teacher/attendance/${tc.class.id}`}
                        className="text-sm font-medium text-blue-600 hover:text-blue-800"
                      >
                        Take Attendance
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

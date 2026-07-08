import { getServerSession } from 'next-auth';
import { redirect } from 'next/navigation';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export default async function SuperAdminDashboardPage() {
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    redirect('/login');
  }

  if (session.user.role !== 'SUPER_ADMIN') {
    redirect('/dashboard');
  }

  const [schoolCount, adminCount, teacherCount, studentCount] = await prisma.$transaction([
    prisma.school.count(),
    prisma.user.count({ where: { role: 'ADMIN' } }),
    prisma.user.count({ where: { role: 'TEACHER' } }),
    prisma.user.count({ where: { role: 'STUDENT' } }),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-gray-900">Super Admin Dashboard</h1>
        <p className="mt-1 text-sm text-gray-500">
          Manage global setup across all schools and administrators.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
          <p className="text-sm text-gray-500">Schools</p>
          <p className="mt-2 text-2xl font-semibold text-gray-900">{schoolCount}</p>
        </div>
        <div className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
          <p className="text-sm text-gray-500">Admins</p>
          <p className="mt-2 text-2xl font-semibold text-gray-900">{adminCount}</p>
        </div>
        <div className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
          <p className="text-sm text-gray-500">Teachers</p>
          <p className="mt-2 text-2xl font-semibold text-gray-900">{teacherCount}</p>
        </div>
        <div className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
          <p className="text-sm text-gray-500">Students</p>
          <p className="mt-2 text-2xl font-semibold text-gray-900">{studentCount}</p>
        </div>
      </div>

      <div className="rounded-lg border border-blue-200 bg-blue-50 p-6">
        <p className="text-sm text-blue-800">
          To manage school operations, log in as a school administrator.
        </p>
      </div>
    </div>
  );
}

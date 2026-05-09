import { getServerSession } from 'next-auth/next';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { AdminsList } from './admins-list';

export default async function SuperAdminAdminsPage() {
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    redirect('/login');
  }

  if (session.user.role !== 'SUPER_ADMIN') {
    redirect('/dashboard');
  }

  const [admins, schools] = await prisma.$transaction([
    prisma.user.findMany({
      where: { role: 'ADMIN' },
      select: {
        id: true,
        name: true,
        email: true,
        schoolId: true
      },
      orderBy: { email: 'asc' }
    }),
    prisma.school.findMany({
      select: {
        id: true,
        name: true
      },
      orderBy: { name: 'asc' }
    })
  ]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Manage Admins</h1>
          <p className="mt-1 text-sm text-gray-500">
            View all admins and reset their passwords if needed
          </p>
        </div>
        <Link
          href="/dashboard/super-admin/admins/new"
          className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
        >
          Create Admin
        </Link>
      </div>

      <AdminsList admins={admins} schools={schools} />
    </div>
  );
}

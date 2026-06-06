import Link from 'next/link';
import { getServerSession } from 'next-auth';
import { redirect } from 'next/navigation';
import { authOptions } from '@/lib/auth';
import { SuperAdminService } from '@/lib/services/super-admin.service';
import { FlashSuccess } from '@/app/dashboard/admin/sessions/flash-success';

export const dynamic = 'force-dynamic';

export default async function SuperAdminSchoolsPage({
  searchParams,
}: {
  searchParams?: { created?: string; adminCreated?: string };
}) {
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    redirect('/login');
  }

  if (session.user.role !== 'SUPER_ADMIN') {
    redirect('/dashboard');
  }

  const service = new SuperAdminService({
    id: session.user.id,
    role: session.user.role,
    email: session.user.email ?? undefined,
  });

  const schools = await service.getAllSchools();

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Schools</h1>
          <p className="mt-1 text-sm text-gray-500">
            Manage all schools and global tenant setup.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/dashboard/super-admin/admins/new"
            className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            Create Admin
          </Link>
          <Link
            href="/dashboard/super-admin/schools/new"
            className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
          >
            Create School
          </Link>
        </div>
      </div>

      {searchParams?.created === '1' && (
        <FlashSuccess
          message="School created successfully."
          queryKey="created"
          timeoutMs={15000}
        />
      )}

      {searchParams?.adminCreated === '1' && (
        <FlashSuccess
          message="Admin account created successfully."
          queryKey="adminCreated"
          timeoutMs={15000}
        />
      )}

      <div className="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm">
        {schools.length === 0 ? (
          <div className="p-6 text-sm text-gray-500">No schools created yet.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                    School
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                    Users
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                    Teachers
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                    Students
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                    Classes
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 bg-white">
                {schools.map((school) => (
                  <tr key={school.id}>
                    <td className="px-4 py-3 text-sm text-gray-900">
                      <div className="font-medium">{school.name}</div>
                      <div className="text-xs text-gray-500">{school.address || 'No address'}</div>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-700">{school._count.users}</td>
                    <td className="px-4 py-3 text-sm text-gray-700">{school._count.teachers}</td>
                    <td className="px-4 py-3 text-sm text-gray-700">{school._count.students}</td>
                    <td className="px-4 py-3 text-sm text-gray-700">{school._count.classes}</td>
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

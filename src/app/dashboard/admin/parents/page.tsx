import Link from 'next/link';
import { getServerSession } from 'next-auth';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { ParentService } from '@/lib/services/parent.service';

export const dynamic = 'force-dynamic';

async function resetParentPasswordAction(formData: FormData) {
  'use server';

  const session = await getServerSession(authOptions);

  if (!session?.user) {
    redirect('/login');
  }

  if (session.user.role !== 'ADMIN' || !session.user.schoolId) {
    redirect('/dashboard');
  }

  const parentId = String(formData.get('parentId') ?? '').trim();
  if (!parentId) {
    return;
  }

  const parentService = new ParentService({
    id: session.user.id,
    role: session.user.role,
    email: session.user.email ?? '',
    schoolId: session.user.schoolId,
  });

  await parentService.resetParentPasswordToDefault(parentId);
  revalidatePath('/dashboard/admin/parents');
  redirect('/dashboard/admin/parents?parentPasswordReset=1');
}

export default async function AdminParentsPage({
  searchParams,
}: {
  searchParams?: { parentPasswordReset?: string };
}) {
  const session = await getServerSession(authOptions);

  if (!session?.user || session.user.role !== 'ADMIN' || !session.user.schoolId) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-semibold text-gray-900">Parents</h1>
        <div className="rounded-lg border border-red-200 bg-red-50 p-4">
          <p className="text-sm text-red-700">Access denied.</p>
        </div>
      </div>
    );
  }

  const parents = await prisma.parent.findMany({
    where: {
      schoolId: session.user.schoolId,
    },
    select: {
      id: true,
      user: {
        select: {
          name: true,
          email: true,
        },
      },
      students: {
        select: {
          student: {
            select: {
              firstName: true,
              lastName: true,
            },
          },
        },
      },
    },
    orderBy: {
      createdAt: 'desc',
    },
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-gray-900">Parents</h1>
        <Link
          href="/dashboard/admin/parents/new"
          className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700"
        >
          New Parent
        </Link>
      </div>

      {searchParams?.parentPasswordReset === '1' && (
        <div className="rounded-md border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
          Parent password reset to default successfully.
        </div>
      )}

      {parents.length === 0 ? (
        <div className="rounded-lg border border-gray-200 bg-white p-8 text-center">
          <h2 className="text-base font-medium text-gray-900">No parents found</h2>
          <p className="mt-1 text-sm text-gray-500">
            Add a parent account to start linking students.
          </p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg border border-gray-200 bg-white">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                    Parent Name
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                    Email
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                    Linked Children
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 bg-white">
                {parents.map((parent) => {
                  const linkedChildren = parent.students
                    .map(({ student }) => `${student.firstName} ${student.lastName}`)
                    .join(', ');

                  return (
                    <tr key={parent.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 text-sm text-gray-900">
                        {parent.user.name || 'Unnamed Parent'}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600">
                        {parent.user.email}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600">
                        {linkedChildren || 'No linked children'}
                      </td>
                      <td className="px-4 py-3 text-sm">
                        <div className="flex items-center gap-3">
                          <Link
                            href={`/dashboard/admin/parents/${parent.id}`}
                            className="font-medium text-blue-600 hover:text-blue-700"
                          >
                            View
                          </Link>
                          <form action={resetParentPasswordAction}>
                            <input type="hidden" name="parentId" value={parent.id} />
                            <button
                              type="submit"
                              className="font-medium text-amber-700 hover:text-amber-800"
                            >
                              Reset Password
                            </button>
                          </form>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

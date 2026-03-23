import { getServerSession } from 'next-auth';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export default async function AdminSubjectsPage() {
  const session = await getServerSession(authOptions);

  if (!session?.user || session.user.role !== 'ADMIN') {
    redirect('/login');
  }

  if (!session.user.schoolId) {
    redirect('/login');
  }

  const subjects = await prisma.subject.findMany({
    where: {
      schoolId: session.user.schoolId,
    },
    include: {
      classes: {
        include: {
          class: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      },
      teachers: {
        include: {
          teacher: {
            include: {
              user: {
                select: {
                  id: true,
                  name: true,
                  email: true,
                },
              },
            },
          },
        },
      },
    },
    orderBy: {
      name: 'asc',
    },
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Subjects</h1>
        <Link
          href="/dashboard/admin/subjects/new"
          className="inline-flex items-center rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
        >
          Create New Subject
        </Link>
      </div>

      <div className="rounded-lg border border-gray-200 bg-white shadow-sm">
        {subjects.length === 0 ? (
          <div className="px-6 py-12 text-center">
            <h2 className="text-lg font-medium text-gray-900">No subjects yet</h2>
            <p className="mt-1 text-sm text-gray-500">
              Create your first subject to start assigning classes and teachers.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-600">
                    Subject Name
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-600">
                    Code
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-600">
                    Description
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-600">
                    Assigned Classes
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-600">
                    Assigned Teachers
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-600">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 bg-white">
                {subjects.map((subject) => (
                  <tr key={subject.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 text-sm font-medium text-gray-900">{subject.name}</td>
                    <td className="px-6 py-4 text-sm text-gray-700">{subject.code}</td>
                    <td className="px-6 py-4 text-sm text-gray-700">
                      {subject.description || '—'}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-700">
                      {subject.classes.length > 0
                        ? subject.classes.map((item) => item.class.name).join(', ')
                        : 'None'}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-700">
                      {subject.teachers.length > 0
                        ? subject.teachers
                            .map((item) => item.teacher.user.name || item.teacher.user.email)
                            .join(', ')
                        : 'None'}
                    </td>
                    <td className="px-6 py-4 text-sm">
                      <Link
                        href={`/dashboard/admin/subjects/${subject.id}`}
                        className="font-medium text-blue-600 hover:text-blue-700"
                      >
                        Manage
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

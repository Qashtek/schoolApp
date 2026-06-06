import { getServerSession } from 'next-auth';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { authOptions } from '@/lib/auth';
import { isAdmin } from '@/lib/permissions';
import Link from 'next/link';
import { prisma } from '@/lib/prisma';
import { FlashSuccess } from '../sessions/flash-success';
import { ConfirmSubmitButton } from '@/components/confirm-submit-button';

export const dynamic = 'force-dynamic';
const PAGE_SIZE = 20;

async function deleteStudentAction(formData: FormData) {
  'use server';

  const session = await getServerSession(authOptions);

  if (!session?.user?.role || !isAdmin(session.user.role)) {
    return;
  }

  const studentId = String(formData.get('studentId') ?? '').trim();
  if (!studentId) {
    return;
  }

  const student = await prisma.student.findUnique({
    where: { id: studentId },
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

  if (!student) {
    return;
  }

  if (session.user.role !== 'SUPER_ADMIN') {
    if (!session.user.schoolId || student.schoolId !== session.user.schoolId) {
      return;
    }
  }

  if (student.user.role === 'STUDENT') {
    await prisma.user.delete({
      where: {
        id: student.userId,
      },
    });
  } else {
    await prisma.student.delete({
      where: {
        id: student.id,
      },
    });
  }

  revalidatePath('/dashboard/admin/students');
  redirect('/dashboard/admin/students?studentDeleted=1');
}

export default async function AdminStudentsPage({
  searchParams,
}: {
  searchParams?: { studentDeleted?: string; page?: string };
}) {
  const session = await getServerSession(authOptions);

  if (!session?.user?.role || !isAdmin(session.user.role)) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold">Students</h1>
        <div className="bg-white shadow rounded-lg">
          <div className="px-4 py-5 sm:p-6">
            <p className="text-red-600">Access denied</p>
          </div>
        </div>
      </div>
    );
  }

  if (!session.user.schoolId) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold">Students</h1>
        <div className="bg-white shadow rounded-lg">
          <div className="px-4 py-5 sm:p-6">
            <p className="text-red-600">Access denied</p>
          </div>
        </div>
      </div>
    );
  }

  const requestedPage = Number(searchParams?.page ?? '1');
  const currentPage = Number.isFinite(requestedPage) && requestedPage >= 1
    ? Math.floor(requestedPage)
    : 1;
  const skip = (currentPage - 1) * PAGE_SIZE;

  const [students, total] = await prisma.$transaction([
    prisma.student.findMany({
      where: { schoolId: session.user.schoolId },
      include: {
        class: {
          select: {
            name: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
      skip,
      take: PAGE_SIZE,
    }),
    prisma.student.count({
      where: { schoolId: session.user.schoolId },
    }),
  ]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const previousPageHref = `/dashboard/admin/students?page=${Math.max(1, currentPage - 1)}`;
  const nextPageHref = `/dashboard/admin/students?page=${currentPage + 1}`;

  return (
    <div className="space-y-6">
      {searchParams?.studentDeleted === '1' && (
        <FlashSuccess
          message="Student deleted successfully."
          queryKey="studentDeleted"
          timeoutMs={15000}
        />
      )}

      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold">Students</h1>
        <Link
          href="/dashboard/admin/students/new"
          className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
        >
          Create New Student
        </Link>
      </div>

      <div className="bg-white shadow rounded-lg">
        <div className="px-4 py-5 sm:p-6">
          {students.length === 0 ? (
            <p className="text-gray-500">No students yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Name
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Class
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Created
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {students.map((student) => (
                    <tr key={student.id}>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {student.firstName} {student.lastName}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
                        {student.class?.name ?? 'Unassigned'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
                        {student.createdAt.toDateString()}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
                        <form action={deleteStudentAction}>
                          <input type="hidden" name="studentId" value={student.id} />
                          <ConfirmSubmitButton
                            confirmMessage={`Delete student "${student.firstName} ${student.lastName}"? This action cannot be undone.`}
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

          <div className="mt-6 flex items-center justify-between border-t border-gray-200 pt-4">
            {currentPage > 1 ? (
              <Link
                href={previousPageHref}
                className="rounded border border-gray-300 px-3 py-1 text-sm text-gray-700 hover:bg-gray-50"
              >
                Previous
              </Link>
            ) : (
              <span className="rounded border border-gray-200 px-3 py-1 text-sm text-gray-400">
                Previous
              </span>
            )}

            <p className="text-sm text-gray-600">
              Page {Math.min(currentPage, totalPages)} of {totalPages}
            </p>

            {currentPage < totalPages ? (
              <Link
                href={nextPageHref}
                className="rounded border border-gray-300 px-3 py-1 text-sm text-gray-700 hover:bg-gray-50"
              >
                Next
              </Link>
            ) : (
              <span className="rounded border border-gray-200 px-3 py-1 text-sm text-gray-400">
                Next
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

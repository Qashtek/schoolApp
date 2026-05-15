import { getServerSession } from 'next-auth';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { SubjectService } from '@/lib/services/subject.service';
import { ConfirmSubmitButton } from '@/components/confirm-submit-button';
import { FlashSuccess } from '../sessions/flash-success';

const PAGE_SIZE = 20;

export default async function AdminSubjectsPage({
  searchParams,
}: {
  searchParams?: { page?: string; deleted?: string; deleteError?: string };
}) {
  const session = await getServerSession(authOptions);

  if (!session?.user || session.user.role !== 'ADMIN') {
    redirect('/login');
  }

  if (!session.user.schoolId) {
    redirect('/login');
  }

  async function deleteSubjectAction(formData: FormData) {
    'use server';

    const currentSession = await getServerSession(authOptions);

    if (!currentSession?.user || currentSession.user.role !== 'ADMIN' || !currentSession.user.schoolId) {
      redirect('/login');
    }

    const subjectId = String(formData.get('subjectId') ?? '').trim();
    if (!subjectId) {
      return;
    }

    const subjectService = new SubjectService({
      id: currentSession.user.id,
      role: currentSession.user.role,
      email: currentSession.user.email ?? undefined,
      schoolId: currentSession.user.schoolId,
    });

    try {
      await subjectService.deleteSubject(subjectId);
    } catch (_error) {
      redirect('/dashboard/admin/subjects?deleteError=1');
    }

    revalidatePath('/dashboard/admin/subjects');
    redirect('/dashboard/admin/subjects?deleted=1');
  }

  const requestedPage = Number(searchParams?.page ?? '1');
  const currentPage = Number.isFinite(requestedPage) && requestedPage >= 1
    ? Math.floor(requestedPage)
    : 1;
  const skip = (currentPage - 1) * PAGE_SIZE;
  const where = {
    schoolId: session.user.schoolId,
    deletedAt: null,
  };

  const [subjects, total] = await prisma.$transaction([
    prisma.subject.findMany({
      where,
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
      skip,
      take: PAGE_SIZE,
    }),
    prisma.subject.count({
      where,
    }),
  ]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const previousPageHref = `/dashboard/admin/subjects?page=${Math.max(1, currentPage - 1)}`;
  const nextPageHref = `/dashboard/admin/subjects?page=${currentPage + 1}`;

  return (
    <div className="space-y-6">
      {searchParams?.deleted === '1' && (
        <FlashSuccess
          message="Subject deleted successfully."
          queryKey="deleted"
          timeoutMs={12000}
        />
      )}
      {searchParams?.deleted !== '1' && searchParams?.deleteError === '1' && (
        <p className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          Failed to delete subject. Please try again.
        </p>
      )}

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
                      <div className="flex items-center gap-3">
                        <Link
                          href={`/dashboard/admin/subjects/${subject.id}`}
                          className="font-medium text-blue-600 hover:text-blue-700"
                        >
                          Edit
                        </Link>
                        <form action={deleteSubjectAction}>
                          <input type="hidden" name="subjectId" value={subject.id} />
                          <ConfirmSubmitButton
                            confirmMessage={`Delete subject "${subject.name}"? This action cannot be undone.`}
                            className="font-medium text-red-600 hover:text-red-700"
                          >
                            Delete
                          </ConfirmSubmitButton>
                        </form>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div className="flex items-center justify-between border-t border-gray-200 px-6 py-4">
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
  );
}

import Link from 'next/link';
import { getServerSession } from 'next-auth';
import { revalidatePath } from 'next/cache';
import { notFound, redirect } from 'next/navigation';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { ParentService } from '@/lib/services/parent.service';
import { LinkStudentForm } from './link-student-form';

async function unlinkStudentAction(formData: FormData) {
  'use server';

  const session = await getServerSession(authOptions);

  if (!session?.user) {
    redirect('/login');
  }

  if (session.user.role !== 'ADMIN') {
    redirect('/dashboard');
  }

  if (!session.user.schoolId) {
    redirect('/login');
  }

  const parentId = String(formData.get('parentId') ?? '').trim();
  const studentId = String(formData.get('studentId') ?? '').trim();

  if (!parentId || !studentId) {
    return;
  }

  const parentService = new ParentService({
    id: session.user.id,
    role: session.user.role,
    email: session.user.email ?? '',
    schoolId: session.user.schoolId,
  });

  await parentService.unlinkParentFromStudent({ parentId, studentId });
  revalidatePath(`/dashboard/admin/parents/${parentId}`);
  revalidatePath('/dashboard/admin/parents');
}

export default async function AdminParentDetailPage({
  params,
}: {
  params: { parentId: string };
}) {
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    redirect('/login');
  }

  if (session.user.role !== 'ADMIN') {
    redirect('/dashboard');
  }

  if (!session.user.schoolId) {
    redirect('/login');
  }

  const parentId = params.parentId?.trim();
  if (!parentId) {
    redirect('/dashboard/admin/parents');
  }

  const parent = await prisma.parent.findFirst({
    where: {
      id: parentId,
      schoolId: session.user.schoolId,
    },
    include: {
      user: {
        select: {
          name: true,
          email: true,
          createdAt: true,
        },
      },
      students: {
        include: {
          student: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              admissionNumber: true,
              class: {
                select: {
                  name: true,
                },
              },
            },
          },
        },
      },
    },
  });

  if (!parent) {
    notFound();
  }

  const linkedStudents = [...parent.students]
    .map((entry) => entry.student)
    .sort((a, b) => {
      const firstNameCompare = a.firstName.localeCompare(b.firstName);
      if (firstNameCompare !== 0) {
        return firstNameCompare;
      }
      return a.lastName.localeCompare(b.lastName);
    });

  const linkedStudentIds = linkedStudents.map((student) => student.id);

  const unlinkedStudents = await prisma.student.findMany({
    where: {
      schoolId: session.user.schoolId,
      ...(linkedStudentIds.length > 0 ? { id: { notIn: linkedStudentIds } } : {}),
    },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      admissionNumber: true,
      grade: true,
    },
    orderBy: [{ firstName: 'asc' }, { lastName: 'asc' }],
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Parent Details</h1>
          <p className="mt-1 text-sm text-gray-500">View and manage this parent&apos;s linked students.</p>
        </div>
        <Link
          href="/dashboard/admin/parents"
          className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
        >
          Back to Parents
        </Link>
      </div>

      <section className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-gray-900">Parent Information</h2>
        <dl className="mt-4 grid gap-3 text-sm text-gray-700 sm:grid-cols-2">
          <div>
            <dt className="font-medium text-gray-900">Name</dt>
            <dd className="mt-1">{parent.user.name || 'Unnamed Parent'}</dd>
          </div>
          <div>
            <dt className="font-medium text-gray-900">Email</dt>
            <dd className="mt-1">{parent.user.email}</dd>
          </div>
          <div>
            <dt className="font-medium text-gray-900">Linked Students</dt>
            <dd className="mt-1">{linkedStudents.length}</dd>
          </div>
          <div>
            <dt className="font-medium text-gray-900">Created</dt>
            <dd className="mt-1">{parent.user.createdAt.toDateString()}</dd>
          </div>
        </dl>
      </section>

      <section className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-gray-900">Link a Student</h2>
        {unlinkedStudents.length === 0 ? (
          <p className="mt-2 text-sm text-gray-500">
            All students in this school are already linked to this parent.
          </p>
        ) : (
          <LinkStudentForm parentId={parent.id} students={unlinkedStudents} />
        )}
      </section>

      <section className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-gray-900">Linked Students</h2>
        {linkedStudents.length === 0 ? (
          <p className="mt-2 text-sm text-gray-500">No students linked yet.</p>
        ) : (
          <div className="mt-4 overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                    Student
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                    Admission No.
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                    Class
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                    Action
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 bg-white">
                {linkedStudents.map((student) => (
                  <tr key={student.id}>
                    <td className="px-4 py-3 text-sm text-gray-900">
                      {student.firstName} {student.lastName}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">{student.admissionNumber}</td>
                    <td className="px-4 py-3 text-sm text-gray-600">
                      {student.class?.name || 'Unassigned'}
                    </td>
                    <td className="px-4 py-3 text-sm">
                      <form action={unlinkStudentAction}>
                        <input type="hidden" name="parentId" value={parent.id} />
                        <input type="hidden" name="studentId" value={student.id} />
                        <button
                          type="submit"
                          className="rounded-md border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-medium text-red-700 hover:bg-red-100"
                        >
                          Unlink
                        </button>
                      </form>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

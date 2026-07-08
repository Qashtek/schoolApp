import { getServerSession } from 'next-auth';
import { revalidatePath } from 'next/cache';
import { notFound, redirect } from 'next/navigation';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { SubjectService } from '@/lib/services/subject.service';
import { AssignClassForm, AssignTeacherForm } from './assignment-forms';
import { ConfirmSubmitButton } from '@/components/confirm-submit-button';
import { FlashSuccess } from '../../sessions/flash-success';

export default async function AdminSubjectDetailPage({
  params,
  searchParams,
}: {
  params: { subjectId: string };
  searchParams?: { updated?: string; error?: string };
}) {
  const session = await getServerSession(authOptions);

  if (!session?.user || session.user.role !== 'ADMIN') {
    redirect('/login');
  }

  if (!session.user.schoolId) {
    redirect('/login');
  }

  const subjectId = params.subjectId;
  const schoolId = session.user.schoolId;

  async function updateSubjectAction(formData: FormData) {
    'use server';

    const currentSession = await getServerSession(authOptions);

    if (!currentSession?.user || currentSession.user.role !== 'ADMIN' || !currentSession.user.schoolId) {
      redirect('/login');
    }

    const name = String(formData.get('name') ?? '').trim();
    const code = String(formData.get('code') ?? '').trim();
    const descriptionInput = String(formData.get('description') ?? '').trim();

    const subjectService = new SubjectService({
      id: currentSession.user.id,
      role: currentSession.user.role,
      email: currentSession.user.email ?? undefined,
      schoolId: currentSession.user.schoolId,
    });

    try {
      await subjectService.updateSubject(subjectId, {
        name,
        code,
        description: descriptionInput || null,
      });
    } catch (_error) {
      redirect(`/dashboard/admin/subjects/${subjectId}?error=update_failed`);
    }

    revalidatePath('/dashboard/admin/subjects');
    revalidatePath(`/dashboard/admin/subjects/${subjectId}`);
    redirect(`/dashboard/admin/subjects/${subjectId}?updated=1`);
  }

  async function deleteSubjectAction() {
    'use server';

    const currentSession = await getServerSession(authOptions);

    if (!currentSession?.user || currentSession.user.role !== 'ADMIN' || !currentSession.user.schoolId) {
      redirect('/login');
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
      redirect(`/dashboard/admin/subjects/${subjectId}?error=delete_failed`);
    }

    revalidatePath('/dashboard/admin/subjects');
    redirect('/dashboard/admin/subjects?deleted=1');
  }

  const [subject, classes, teachers] = await Promise.all([
    prisma.subject.findFirst({
      where: {
        id: subjectId,
        schoolId,
        deletedAt: null,
      },
      include: {
        school: {
          select: {
            id: true,
            name: true,
          },
        },
        classes: {
          include: {
            class: {
              select: {
                id: true,
                name: true,
                grade: true,
              },
            },
          },
          orderBy: {
            createdAt: 'desc',
          },
        },
        classSubjects: {
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
          orderBy: {
            createdAt: 'desc',
          },
        },
      },
    }),
    prisma.class.findMany({
      where: { schoolId },
      select: {
        id: true,
        name: true,
        grade: true,
      },
      orderBy: {
        name: 'asc',
      },
    }),
    prisma.teacher.findMany({
      where: { schoolId },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    }),
  ]);

  if (!subject) {
    notFound();
  }

  const assignedClassIds = new Set(subject.classes.map((entry) => entry.classId));
  // Collect unique teacher IDs from classSubjects (a teacher may teach this subject in multiple classes)
  const assignedTeacherIds = new Set(subject.classSubjects.map((entry) => entry.teacherId));

  const availableClasses = classes.filter((entry) => !assignedClassIds.has(entry.id));
  const availableTeachers = teachers.filter((entry) => !assignedTeacherIds.has(entry.id));

  return (
    <div className="space-y-6">
      {searchParams?.updated === '1' && (
        <FlashSuccess
          message="Subject updated successfully."
          queryKey="updated"
          timeoutMs={12000}
        />
      )}
      {searchParams?.error === 'update_failed' && (
        <p className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          Failed to update subject. Please check your inputs and try again.
        </p>
      )}
      {searchParams?.error === 'delete_failed' && (
        <p className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          Failed to delete subject. Please try again.
        </p>
      )}

      <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
        <h1 className="text-2xl font-semibold text-gray-900">{subject.name}</h1>
        <div className="mt-3 grid gap-2 text-sm text-gray-700">
          <p>
            <span className="font-medium text-gray-900">Code:</span> {subject.code}
          </p>
          <p>
            <span className="font-medium text-gray-900">School:</span> {subject.school?.name || '—'}
          </p>
          <p>
            <span className="font-medium text-gray-900">Description:</span>{' '}
            {subject.description || 'No description'}
          </p>
        </div>
      </div>

      <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-gray-900">Edit Subject</h2>
        <form action={updateSubjectAction} className="mt-4 space-y-4">
          <div>
            <label htmlFor="name" className="block text-sm font-medium text-gray-700">
              Name
            </label>
            <input
              id="name"
              name="name"
              type="text"
              defaultValue={subject.name}
              className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            />
          </div>
          <div>
            <label htmlFor="code" className="block text-sm font-medium text-gray-700">
              Code
            </label>
            <input
              id="code"
              name="code"
              type="text"
              defaultValue={subject.code}
              className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            />
          </div>
          <div>
            <label htmlFor="description" className="block text-sm font-medium text-gray-700">
              Description
            </label>
            <textarea
              id="description"
              name="description"
              rows={3}
              defaultValue={subject.description ?? ''}
              className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <button
            type="submit"
            className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
          >
            Save Changes
          </button>
        </form>
      </div>

      <div className="rounded-lg border border-red-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-gray-900">Delete Subject</h2>
        <p className="mt-2 text-sm text-gray-600">
          Deleting this subject will remove it from active subject lists.
        </p>
        <form action={deleteSubjectAction} className="mt-4">
          <ConfirmSubmitButton
            confirmMessage={`Delete subject "${subject.name}"? This action cannot be undone.`}
            className="rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700"
          >
            Delete Subject
          </ConfirmSubmitButton>
        </form>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-gray-900">Assigned Classes</h2>
          {subject.classes.length === 0 ? (
            <p className="mt-3 text-sm text-gray-500">No classes assigned yet.</p>
          ) : (
            <ul className="mt-3 space-y-2">
              {subject.classes.map((entry) => (
                <li
                  key={entry.id}
                  className="rounded-md border border-gray-100 bg-gray-50 px-3 py-2 text-sm text-gray-700"
                >
                  {entry.class.name} ({entry.class.grade})
                </li>
              ))}
            </ul>
          )}
          <AssignClassForm
            subjectId={subjectId}
            availableClasses={availableClasses.map((entry) => ({
              id: entry.id,
              name: entry.name,
              grade: entry.grade,
            }))}
          />
        </section>

        <section className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-gray-900">Assigned Teachers</h2>
          {subject.classSubjects.length === 0 ? (
            <p className="mt-3 text-sm text-gray-500">No teachers assigned yet.</p>
          ) : (
            <ul className="mt-3 space-y-2">
              {subject.classSubjects.map((entry) => (
                <li
                  key={entry.id}
                  className="rounded-md border border-gray-100 bg-gray-50 px-3 py-2 text-sm text-gray-700"
                >
                  {entry.teacher.user.name || 'Unnamed Teacher'} ({entry.teacher.user.email})
                </li>
              ))}
            </ul>
          )}
          <AssignTeacherForm
            subjectId={subjectId}
            availableTeachers={availableTeachers.map((entry) => ({
              id: entry.id,
              name: entry.user.name || 'Unnamed Teacher',
              email: entry.user.email,
            }))}
          />
        </section>
      </div>
    </div>
  );
}

import { getServerSession } from 'next-auth';
import { notFound, redirect } from 'next/navigation';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { AssignClassForm, AssignTeacherForm } from './assignment-forms';

export default async function AdminSubjectDetailPage({
  params,
}: {
  params: { subjectId: string };
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

  const [subject, classes, teachers] = await Promise.all([
    prisma.subject.findFirst({
      where: {
        id: subjectId,
        schoolId,
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
  const assignedTeacherIds = new Set(subject.teachers.map((entry) => entry.teacherId));

  const availableClasses = classes.filter((entry) => !assignedClassIds.has(entry.id));
  const availableTeachers = teachers.filter((entry) => !assignedTeacherIds.has(entry.id));

  return (
    <div className="space-y-6">
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
          {subject.teachers.length === 0 ? (
            <p className="mt-3 text-sm text-gray-500">No teachers assigned yet.</p>
          ) : (
            <ul className="mt-3 space-y-2">
              {subject.teachers.map((entry) => (
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

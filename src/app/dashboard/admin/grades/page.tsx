import { getServerSession } from 'next-auth';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

type SearchParams = {
  classId?: string;
  termId?: string;
};

function formatScore(value: number | null | undefined): string {
  if (value === null || value === undefined) {
    return '-';
  }

  if (Number.isInteger(value)) {
    return String(value);
  }

  return value.toFixed(2).replace(/\.?0+$/, '');
}

function resolveTotal(caScore: number | null, examScore: number | null, total: number | null): number | null {
  if (total !== null) {
    return total;
  }

  if (caScore === null && examScore === null) {
    return null;
  }

  return (caScore ?? 0) + (examScore ?? 0);
}

export default async function AdminGradesPage({
  searchParams,
}: {
  searchParams?: SearchParams;
}) {
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    redirect('/login');
  }

  if (session.user.role !== 'ADMIN') {
    redirect('/dashboard');
  }

  if (!session.user.schoolId) {
    throw new Error('Admin not assigned to school');
  }

  const schoolId = session.user.schoolId;
  const selectedClassId = searchParams?.classId?.trim() || '';
  const selectedTermId = searchParams?.termId?.trim() || '';

  const [classes, sessions] = await prisma.$transaction([
    prisma.class.findMany({
      where: { schoolId },
      select: {
        id: true,
        name: true,
        grade: true,
      },
      orderBy: { name: 'asc' },
    }),
    prisma.academicSession.findMany({
      where: { schoolId },
      select: {
        id: true,
        name: true,
        terms: {
          select: {
            id: true,
            name: true,
            isActive: true,
            startDate: true,
          },
          orderBy: [{ isActive: 'desc' }, { startDate: 'asc' }],
        },
      },
      orderBy: { createdAt: 'desc' },
    }),
  ]);

  const grades = await prisma.grade.findMany({
    where: {
      schoolId,
      ...(selectedClassId ? { classId: selectedClassId } : {}),
      ...(selectedTermId ? { termId: selectedTermId } : {}),
    },
    select: {
      id: true,
      caScore: true,
      examScore: true,
      total: true,
      grade: true,
      student: {
        select: {
          firstName: true,
          lastName: true,
        },
      },
      subject: {
        select: {
          name: true,
        },
      },
    },
    orderBy: [
      { student: { lastName: 'asc' } },
      { student: { firstName: 'asc' } },
      { subject: { name: 'asc' } },
    ],
  });

  const totals = grades
    .map((item) => resolveTotal(item.caScore, item.examScore, item.total))
    .filter((value): value is number => value !== null);

  const classAverage =
    totals.length > 0 ? totals.reduce((sum, value) => sum + value, 0) / totals.length : null;
  const highestScore = totals.length > 0 ? Math.max(...totals) : null;
  const lowestScore = totals.length > 0 ? Math.min(...totals) : null;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Grades Overview</h1>
          <p className="mt-1 text-sm text-gray-500">
            View grades by class and term for your school.
          </p>
        </div>
        <Link
          href="/dashboard/admin/grades/bands"
          className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
        >
          Manage Grade Bands
        </Link>
      </div>

      <form method="GET" className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <label htmlFor="classId" className="block text-sm font-medium text-gray-700">
              Class
            </label>
            <select
              id="classId"
              name="classId"
              defaultValue={selectedClassId}
              className="mt-1 block w-full rounded-md border-gray-300 text-sm focus:border-blue-500 focus:ring-blue-500"
            >
              <option value="">All classes</option>
              {classes.map((classItem) => (
                <option key={classItem.id} value={classItem.id}>
                  {classItem.name} (Grade {classItem.grade})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="termId" className="block text-sm font-medium text-gray-700">
              Term
            </label>
            <select
              id="termId"
              name="termId"
              defaultValue={selectedTermId}
              className="mt-1 block w-full rounded-md border-gray-300 text-sm focus:border-blue-500 focus:ring-blue-500"
            >
              <option value="">All terms</option>
              {sessions.map((academicSession) => (
                <optgroup key={academicSession.id} label={academicSession.name}>
                  {academicSession.terms.map((term) => (
                    <option key={term.id} value={term.id}>
                      {term.name}{term.isActive ? ' (Active)' : ''}
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>
          </div>
        </div>

        <div className="mt-4">
          <button
            type="submit"
            className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
          >
            Apply Filters
          </button>
        </div>
      </form>

      <div className="grid gap-4 md:grid-cols-3">
        <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
          <p className="text-sm text-gray-500">Class Average</p>
          <p className="mt-1 text-2xl font-semibold text-gray-900">
            {classAverage === null ? '-' : formatScore(classAverage)}
          </p>
        </div>

        <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
          <p className="text-sm text-gray-500">Highest Score</p>
          <p className="mt-1 text-2xl font-semibold text-gray-900">
            {highestScore === null ? '-' : formatScore(highestScore)}
          </p>
        </div>

        <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
          <p className="text-sm text-gray-500">Lowest Score</p>
          <p className="mt-1 text-2xl font-semibold text-gray-900">
            {lowestScore === null ? '-' : formatScore(lowestScore)}
          </p>
        </div>
      </div>

      <div className="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm">
        <div className="border-b border-gray-200 px-4 py-3">
          <h2 className="text-sm font-semibold text-gray-900">Grades</h2>
        </div>

        {grades.length === 0 ? (
          <div className="px-4 py-8 text-center text-sm text-gray-500">
            No grades found for the selected filters.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-600">
                    Student Name
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-600">
                    Subject Name
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-600">
                    CA Score
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-600">
                    Exam Score
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-600">
                    Total
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-600">
                    Letter Grade
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 bg-white">
                {grades.map((grade) => {
                  const totalValue = resolveTotal(grade.caScore, grade.examScore, grade.total);

                  return (
                    <tr key={grade.id}>
                      <td className="px-4 py-3 text-sm text-gray-900">
                        {grade.student.firstName} {grade.student.lastName}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-700">{grade.subject.name}</td>
                      <td className="px-4 py-3 text-sm text-gray-700">{formatScore(grade.caScore)}</td>
                      <td className="px-4 py-3 text-sm text-gray-700">{formatScore(grade.examScore)}</td>
                      <td className="px-4 py-3 text-sm font-medium text-gray-900">
                        {formatScore(totalValue)}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-700">{grade.grade ?? '-'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

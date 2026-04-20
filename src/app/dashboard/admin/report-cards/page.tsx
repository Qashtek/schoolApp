import Link from 'next/link';
import { getServerSession } from 'next-auth';
import { redirect } from 'next/navigation';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { ReportCardService } from '@/lib/services/report-card.service';

type SearchParams = {
  classId?: string;
  termId?: string;
};

type TermOption = {
  id: string;
  name: string;
  sessionName: string;
};

function formatAverage(value: number | null): string {
  if (value === null) {
    return '-';
  }

  if (Number.isInteger(value)) {
    return String(value);
  }

  return value.toFixed(2).replace(/\.?0+$/, '');
}

export default async function AdminReportCardsPage({
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
    redirect('/login');
  }

  const schoolId = session.user.schoolId;
  const selectedClassId = searchParams?.classId?.trim() ?? '';
  const selectedTermId = searchParams?.termId?.trim() ?? '';
  const hasSelection = Boolean(selectedClassId && selectedTermId);

  const [classes, terms] = await prisma.$transaction([
    prisma.class.findMany({
      where: {
        schoolId,
      },
      select: {
        id: true,
        name: true,
        grade: true,
      },
      orderBy: [
        { grade: 'asc' },
        { name: 'asc' },
      ],
    }),
    prisma.term.findMany({
      where: {
        session: {
          is: {
            schoolId,
          },
        },
      },
      select: {
        id: true,
        name: true,
        startDate: true,
        session: {
          select: {
            name: true,
          },
        },
      },
      orderBy: [
        { session: { name: 'asc' } },
        { startDate: 'asc' },
      ],
    }),
  ]);

  const termOptions: TermOption[] = terms.map((term) => ({
    id: term.id,
    name: term.name,
    sessionName: term.session.name,
  }));

  const reportCardService = new ReportCardService({
    id: session.user.id,
    email: session.user.email ?? '',
    name: session.user.name,
    role: session.user.role,
    schoolId,
  });

  let reportCards: Awaited<ReturnType<ReportCardService['getClassReportCards']>> = [];
  let loadError: string | null = null;

  if (hasSelection) {
    try {
      reportCards = await reportCardService.getClassReportCards(selectedClassId, selectedTermId);
    } catch (error) {
      loadError = error instanceof Error ? error.message : 'Failed to load report cards';
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-gray-900">Report Cards</h1>
        <p className="mt-1 text-sm text-gray-500">
          Select a class and term to view students and open individual report cards.
        </p>
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
              <option value="">Select class</option>
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
              <option value="">Select term</option>
              {termOptions.map((term) => (
                <option key={term.id} value={term.id}>
                  {term.sessionName} - {term.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="mt-4">
          <button
            type="submit"
            className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
          >
            Load Report Cards
          </button>
        </div>
      </form>

      {!hasSelection ? (
        <div className="rounded-lg border border-dashed border-gray-300 bg-white p-8 text-center text-sm text-gray-500">
          Select both class and term to view report cards.
        </div>
      ) : loadError ? (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {loadError}
        </div>
      ) : reportCards.length === 0 ? (
        <div className="rounded-lg border border-gray-200 bg-white p-6 text-sm text-gray-500 shadow-sm">
          No students or report cards found for the selected class and term.
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm">
          <div className="border-b border-gray-200 px-4 py-3">
            <h2 className="text-sm font-semibold text-gray-900">Students</h2>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-600">
                    Student
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-600">
                    Admission No.
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-600">
                    Average
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-600">
                    Position
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-600">
                    Action
                  </th>
                </tr>
              </thead>

              <tbody className="divide-y divide-gray-100 bg-white">
                {reportCards.map((reportCard) => (
                  <tr key={reportCard.student.id}>
                    <td className="px-4 py-3 text-sm text-gray-900">{reportCard.student.name}</td>
                    <td className="px-4 py-3 text-sm text-gray-700">
                      {reportCard.student.admissionNumber}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-700">
                      {formatAverage(reportCard.overallAverage)}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-700">
                      {reportCard.classPosition
                        ? `${reportCard.classPosition.rank}/${reportCard.classPosition.outOf}`
                        : '-'}
                    </td>
                    <td className="px-4 py-3 text-sm">
                      <Link
                        href={`/dashboard/admin/report-cards/${reportCard.student.id}?termId=${selectedTermId}`}
                        className="font-medium text-blue-600 hover:text-blue-700"
                      >
                        View Report Card
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

import Link from 'next/link';
import { getServerSession } from 'next-auth';
import { redirect } from 'next/navigation';
import { authOptions } from '@/lib/auth';
import { PrintButton } from '@/components/print-button';
import { prisma } from '@/lib/prisma';
import { ReportCardService } from '@/lib/services/report-card.service';

type PageParams = {
  studentId: string;
};

type SearchParams = {
  termId?: string;
};

const generatedDateFormatter = new Intl.DateTimeFormat('en-US', {
  year: 'numeric',
  month: 'long',
  day: 'numeric',
});

function formatNumber(value: number | null | undefined): string {
  if (value === null || value === undefined) {
    return '-';
  }

  if (Number.isInteger(value)) {
    return String(value);
  }

  return value.toFixed(2).replace(/\.?0+$/, '');
}

function formatPercentage(value: number): string {
  return `${formatNumber(value)}%`;
}

export default async function AdminStudentReportCardPage({
  params,
  searchParams,
}: {
  params: PageParams;
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
  const studentId = params.studentId?.trim();
  const termId = searchParams?.termId?.trim() ?? '';

  if (!studentId) {
    redirect('/dashboard/admin/report-cards');
  }

  const school = await prisma.school.findUnique({
    where: {
      id: schoolId,
    },
    select: {
      name: true,
    },
  });

  if (!termId) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-semibold text-gray-900">Student Report Card</h1>
        <div className="rounded-lg border border-dashed border-gray-300 bg-white p-6 text-sm text-gray-600">
          No term selected. Go back and select a term before viewing a report card.
        </div>
        <Link
          href="/dashboard/admin/report-cards"
          className="inline-flex items-center rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
        >
          Back to Report Cards
        </Link>
      </div>
    );
  }

  const reportCardService = new ReportCardService({
    id: session.user.id,
    email: session.user.email ?? '',
    name: session.user.name,
    role: session.user.role,
    schoolId,
  });

  const reportCard = await reportCardService.getStudentReportCard(studentId, termId);
  const generatedDate = generatedDateFormatter.format(new Date());

  return (
    <div className="report-card-page space-y-6 print:space-y-0">
      <div className="report-card-toolbar flex flex-wrap items-center justify-between gap-3 print:hidden">
        <Link
          href={`/dashboard/admin/report-cards?termId=${termId}`}
          className="inline-flex items-center rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
        >
          Back to Report Cards
        </Link>
        <PrintButton />
      </div>

      <div
        id="report-card-print"
        className="report-card-content mx-auto w-full max-w-5xl rounded-xl border border-gray-200 bg-white p-8 shadow-sm print:max-w-none print:rounded-none print:border-gray-300 print:p-6 print:shadow-none"
      >
        <article className="print:text-[11pt] print:leading-[1.4]">
          <header className="border-b border-gray-200 pb-6">
            <p className="text-xs font-medium uppercase tracking-[0.2em] text-gray-500">
              Student Report Card
            </p>
            <h1 className="mt-2 text-3xl font-semibold text-gray-900">
              {school?.name ?? 'School'}
            </h1>
          </header>

          <section className="mt-6 grid gap-4 md:grid-cols-2">
            <div className="rounded-lg border border-gray-200 p-4">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-600">
                Student Details
              </h2>
              <dl className="mt-3 space-y-2 text-sm">
                <div className="flex justify-between gap-4">
                  <dt className="text-gray-500">Name</dt>
                  <dd className="font-medium text-gray-900">{reportCard.student.name}</dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt className="text-gray-500">Admission Number</dt>
                  <dd className="font-medium text-gray-900">{reportCard.student.admissionNumber}</dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt className="text-gray-500">Class</dt>
                  <dd className="font-medium text-gray-900">
                    {reportCard.student.class
                      ? `${reportCard.student.class.name} (Grade ${reportCard.student.class.grade})`
                      : 'Unassigned'}
                  </dd>
                </div>
              </dl>
            </div>

            <div className="rounded-lg border border-gray-200 p-4">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-600">
                Academic Period
              </h2>
              <dl className="mt-3 space-y-2 text-sm">
                <div className="flex justify-between gap-4">
                  <dt className="text-gray-500">Term</dt>
                  <dd className="font-medium text-gray-900">{reportCard.term.name}</dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt className="text-gray-500">Session</dt>
                  <dd className="font-medium text-gray-900">{reportCard.term.session.name}</dd>
                </div>
              </dl>
            </div>
          </section>

          <section className="mt-6">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-600">Grades</h2>
            <div className="mt-3 overflow-hidden rounded-lg border border-gray-200">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-600">
                      Subject
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
                  {reportCard.grades.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-4 py-6 text-center text-sm text-gray-500">
                        No grades recorded for this term.
                      </td>
                    </tr>
                  ) : (
                    reportCard.grades.map((grade) => (
                      <tr key={`${reportCard.student.id}-${grade.subjectId}`}>
                        <td className="px-4 py-3 text-sm text-gray-900">{grade.subjectName}</td>
                        <td className="px-4 py-3 text-sm text-gray-700">{formatNumber(grade.caScore)}</td>
                        <td className="px-4 py-3 text-sm text-gray-700">{formatNumber(grade.examScore)}</td>
                        <td className="px-4 py-3 text-sm font-medium text-gray-900">
                          {formatNumber(grade.total)}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-700">{grade.letterGrade ?? '-'}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </section>

          <section className="mt-6 grid gap-4 md:grid-cols-2">
            <div className="rounded-lg border border-gray-200 p-4">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-600">
                Attendance Summary
              </h2>
              <div className="mt-3 grid grid-cols-2 gap-3 text-sm">
                <div className="rounded-md border border-gray-100 bg-gray-50 px-3 py-2">
                  <p className="text-xs uppercase tracking-wide text-gray-500">Present</p>
                  <p className="mt-1 text-base font-semibold text-gray-900">
                    {reportCard.attendance.presentCount}
                  </p>
                </div>
                <div className="rounded-md border border-gray-100 bg-gray-50 px-3 py-2">
                  <p className="text-xs uppercase tracking-wide text-gray-500">Absent</p>
                  <p className="mt-1 text-base font-semibold text-gray-900">
                    {reportCard.attendance.absentCount}
                  </p>
                </div>
                <div className="rounded-md border border-gray-100 bg-gray-50 px-3 py-2">
                  <p className="text-xs uppercase tracking-wide text-gray-500">Late</p>
                  <p className="mt-1 text-base font-semibold text-gray-900">
                    {reportCard.attendance.lateCount}
                  </p>
                </div>
                <div className="rounded-md border border-gray-100 bg-gray-50 px-3 py-2">
                  <p className="text-xs uppercase tracking-wide text-gray-500">Percentage</p>
                  <p className="mt-1 text-base font-semibold text-gray-900">
                    {formatPercentage(reportCard.attendance.attendancePercentage)}
                  </p>
                </div>
              </div>
            </div>

            <div className="rounded-lg border border-gray-200 p-4">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-600">
                Performance Summary
              </h2>
              <dl className="mt-3 space-y-2 text-sm">
                <div className="flex items-center justify-between gap-4">
                  <dt className="text-gray-500">Overall Average</dt>
                  <dd className="text-lg font-semibold text-gray-900">
                    {formatNumber(reportCard.overallAverage)}
                  </dd>
                </div>
                <div className="flex items-center justify-between gap-4">
                  <dt className="text-gray-500">Class Position</dt>
                  <dd className="text-lg font-semibold text-gray-900">
                    {reportCard.classPosition
                      ? `${reportCard.classPosition.rank} / ${reportCard.classPosition.outOf}`
                      : '-'}
                  </dd>
                </div>
              </dl>
            </div>
          </section>

          <footer className="mt-8 border-t border-gray-200 pt-4 text-xs text-gray-500">
            Generated on {generatedDate}
          </footer>
        </article>
      </div>
    </div>
  );
}

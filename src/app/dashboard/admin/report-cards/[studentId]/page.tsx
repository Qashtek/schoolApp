import Link from 'next/link';
import Image from 'next/image';
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
      address: true,
      logoUrl: true,
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
        className="report-card-content mx-auto w-full max-w-5xl rounded-xl border border-gray-200 bg-white p-8 shadow-sm print:max-w-none print:rounded-none print:border-gray-300 print:p-4 print:shadow-none"
      >
        <article className="print:text-[21pt] print:leading-[1.4]" style={{ fontFamily: "'Poppins', sans-serif" }}>
          <header className="border-b border-gray-200 pb-3 print:pb-2">
            <div className="flex items-start gap-4 mb-3 print:mb-2">
              {/* Logo */}
              {school?.logoUrl ? (
                <Image
                  src={school.logoUrl}
                  alt={`${school.name} logo`}
                  width={60}
                  height={60}
                  className="h-16 w-auto object-contain print:h-14"
                />
              ) : (
                <div className="w-16 h-16 bg-gray-100 rounded flex items-center justify-center print:w-14 print:h-14"></div>
              )}
              
              {/* School Info */}
              <div className="flex-1">
                <h1 className="text-2xl font-semibold text-gray-900 print:text-4xl print:font-bold">
                  {school?.name ?? 'School'}
                </h1>
                {school?.address && (
                  <p className="text-xs text-gray-600 mt-0.5 print:text-lg">
                    {school.address}
                  </p>
                )}
              </div>
            </div>
            
            <p className="text-xs font-medium uppercase tracking-[0.1em] text-gray-500 print:text-base">
              Student Report Card
            </p>
          </header>

          <section className="mt-4 grid gap-2 md:grid-cols-2 print:mt-3 print:gap-2 print:grid-cols-2">
            <div className="rounded border border-gray-200 p-2 print:border-gray-300 print:p-2">
              <h2 className="text-xs font-semibold uppercase tracking-wide text-gray-600 print:text-lg print:font-bold">
                Student Details
              </h2>
              <dl className="mt-1 space-y-0.5 text-xs print:mt-2 print:space-y-1 print:text-base">
                <div className="flex justify-between gap-2">
                  <dt className="text-gray-500">Name</dt>
                  <dd className="font-medium text-gray-900 print:text-[41pt] print:font-bold">{reportCard.student.name}</dd>
                </div>
                <div className="flex justify-between gap-2">
                  <dt className="text-gray-500">Admission</dt>
                  <dd className="font-medium text-gray-900">{reportCard.student.admissionNumber}</dd>
                </div>
                <div className="flex justify-between gap-2">
                  <dt className="text-gray-500">Class</dt>
                  <dd className="font-medium text-gray-900">
                    {reportCard.student.class
                      ? `${reportCard.student.class.name} (${reportCard.student.class.grade})`
                      : 'Unassigned'}
                  </dd>
                </div>
              </dl>
            </div>

            <div className="rounded border border-gray-200 p-2 print:border-gray-300 print:p-2">
              <h2 className="text-xs font-semibold uppercase tracking-wide text-gray-600 print:text-lg print:font-bold">
                Period
              </h2>
              <dl className="mt-1 space-y-0.5 text-xs print:mt-2 print:space-y-1 print:text-base">
                <div className="flex justify-between gap-2">
                  <dt className="text-gray-500">Term</dt>
                  <dd className="font-medium text-gray-900">{reportCard.term.name}</dd>
                </div>
                <div className="flex justify-between gap-2">
                  <dt className="text-gray-500">Session</dt>
                  <dd className="font-medium text-gray-900">{reportCard.term.session.name}</dd>
                </div>
              </dl>
            </div>
          </section>

          <section className="mt-3 print:mt-3">
            <h2 className="text-xs font-semibold uppercase tracking-wide text-gray-600 print:text-lg print:font-bold">Grades</h2>
            <div className="mt-1 overflow-hidden rounded border border-gray-200 print:mt-2 print:border-gray-300">
              <table className="min-w-full divide-y divide-gray-200 text-xs print:text-base">
                <thead className="bg-gray-50 print:bg-gray-100">
                  <tr>
                    <th className="px-2 py-1 text-left text-xs font-semibold text-gray-600 print:px-2 print:py-1 print:text-base">
                      Subject
                    </th>
                    <th className="px-2 py-1 text-center text-xs font-semibold text-gray-600 print:px-2 print:py-1 print:text-base">
                      CA
                    </th>
                    <th className="px-2 py-1 text-center text-xs font-semibold text-gray-600 print:px-2 print:py-1 print:text-base">
                      Exam
                    </th>
                    <th className="px-2 py-1 text-center text-xs font-semibold text-gray-600 print:px-2 print:py-1 print:text-base">
                      Total
                    </th>
                    <th className="px-2 py-1 text-center text-xs font-semibold text-gray-600 print:px-2 print:py-1 print:text-base">
                      Grade
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 bg-white print:bg-white">
                  {reportCard.grades.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-2 py-2 text-center text-xs text-gray-500 print:py-2 print:text-base">
                        No grades recorded for this term.
                      </td>
                    </tr>
                  ) : (
                    reportCard.grades.map((grade) => (
                      <tr key={`${reportCard.student.id}-${grade.subjectId}`}>
                        <td className="px-2 py-1 text-gray-900 print:px-2 print:py-1">{grade.subjectName}</td>
                        <td className="px-2 py-1 text-center text-gray-700 print:px-2 print:py-1">{formatNumber(grade.caScore)}</td>
                        <td className="px-2 py-1 text-center text-gray-700 print:px-2 print:py-1">{formatNumber(grade.examScore)}</td>
                        <td className="px-2 py-1 text-center font-medium text-gray-900 print:px-2 print:py-1">
                          {formatNumber(grade.total)}
                        </td>
                        <td className="px-2 py-1 text-center text-gray-700 print:px-2 print:py-1">{grade.letterGrade ?? '-'}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </section>

          <section className="mt-3 grid gap-2 md:grid-cols-2 print:mt-3 print:gap-2 print:grid-cols-2">
            <div className="rounded border border-gray-200 p-2 print:border-gray-300 print:p-2">
              <h2 className="text-xs font-semibold uppercase tracking-wide text-gray-600 print:text-lg print:font-bold">
                Attendance
              </h2>
              <div className="mt-1 grid grid-cols-2 gap-2 text-xs print:mt-2 print:gap-2 print:text-base">
                <div className="rounded border border-gray-100 bg-gray-50 px-2 py-1 print:bg-gray-100 print:px-2 print:py-1">
                  <p className="text-xs font-semibold text-gray-900 print:text-lg print:font-bold">{reportCard.attendance.presentCount}</p>
                  <p className="text-xs text-gray-500 print:text-sm">Present</p>
                </div>
                <div className="rounded border border-gray-100 bg-gray-50 px-2 py-1 print:bg-gray-100 print:px-2 print:py-1">
                  <p className="text-xs font-semibold text-gray-900 print:text-lg print:font-bold">{reportCard.attendance.absentCount}</p>
                  <p className="text-xs text-gray-500 print:text-sm">Absent</p>
                </div>
                <div className="rounded border border-gray-100 bg-gray-50 px-2 py-1 print:bg-gray-100 print:px-2 print:py-1">
                  <p className="text-xs font-semibold text-gray-900 print:text-lg print:font-bold">{reportCard.attendance.lateCount}</p>
                  <p className="text-xs text-gray-500 print:text-sm">Late</p>
                </div>
                <div className="rounded border border-gray-100 bg-gray-50 px-2 py-1 print:bg-gray-100 print:px-2 print:py-1">
                  <p className="text-xs font-semibold text-gray-900 print:text-lg print:font-bold">{formatPercentage(reportCard.attendance.attendancePercentage)}</p>
                  <p className="text-xs text-gray-500 print:text-sm">%</p>
                </div>
              </div>
            </div>

            <div className="rounded border border-gray-200 p-2 print:border-gray-300 print:p-2">
              <h2 className="text-xs font-semibold uppercase tracking-wide text-gray-600 print:text-lg print:font-bold">
                Performance
              </h2>
              <dl className="mt-1 space-y-1 text-xs print:mt-2 print:space-y-2 print:text-base">
                <div className="flex items-center justify-between gap-2">
                  <dt className="text-gray-500">Average</dt>
                  <dd className="font-semibold text-gray-900 print:font-bold">
                    {formatNumber(reportCard.overallAverage)}
                  </dd>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <dt className="text-gray-500">Position</dt>
                  <dd className="font-semibold text-gray-900 print:font-bold">
                    {reportCard.classPosition
                      ? `${reportCard.classPosition.rank}/${reportCard.classPosition.outOf}`
                      : '-'}
                  </dd>
                </div>
              </dl>
            </div>
          </section>

          <footer className="mt-2 border-t border-gray-200 pt-1 text-xs text-gray-500 print:mt-3 print:pt-2 print:text-base">
            Generated on {generatedDate}
          </footer>
        </article>
      </div>
    </div>
  );
}

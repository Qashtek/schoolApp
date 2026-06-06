import Link from 'next/link';
import { getServerSession } from 'next-auth';
import { redirect } from 'next/navigation';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

function formatScore(value: number | null | undefined): string {
  if (value === null || value === undefined) {
    return '-';
  }

  if (Number.isInteger(value)) {
    return String(value);
  }

  return value.toFixed(2).replace(/\.?0+$/, '');
}

function resolveTotal(
  caScore: number | null,
  examScore: number | null,
  total: number | null
): number | null {
  if (total !== null) {
    return total;
  }

  if (caScore === null && examScore === null) {
    return null;
  }

  return (caScore ?? 0) + (examScore ?? 0);
}

function toStartOfDay(value: Date): Date {
  const date = new Date(value);
  date.setHours(0, 0, 0, 0);
  return date;
}

function toEndOfDay(value: Date): Date {
  const date = new Date(value);
  date.setHours(23, 59, 59, 999);
  return date;
}

function formatPercentage(value: number): string {
  if (Number.isInteger(value)) {
    return `${value}%`;
  }
  return `${value.toFixed(2).replace(/\.?0+$/, '')}%`;
}

export default async function StudentDashboardPage() {
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    redirect('/login');
  }

  if (session.user.role !== 'STUDENT') {
    redirect('/dashboard');
  }

  const student = await prisma.student.findFirst({
    where: {
      userId: session.user.id,
    },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      schoolId: true,
      admissionNumber: true,
      class: {
        select: {
          name: true,
          grade: true,
        },
      },
    },
  });

  if (!student) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-semibold text-gray-900">Student Dashboard</h1>
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
          Your student profile is not linked yet. Contact an administrator.
        </div>
      </div>
    );
  }

  const activeTerm = await prisma.term.findFirst({
    where: {
      isActive: true,
      session: {
        is: {
          schoolId: student.schoolId,
        },
      },
    },
    select: {
      id: true,
      name: true,
      startDate: true,
      endDate: true,
      session: {
        select: {
          id: true,
          name: true,
        },
      },
    },
    orderBy: {
      startDate: 'desc',
    },
  });

  let grades: Array<{
    id: string;
    caScore: number | null;
    examScore: number | null;
    total: number | null;
    grade: string | null;
    subject: { name: string };
  }> = [];

  let attendanceSummary = {
    present: 0,
    absent: 0,
    late: 0,
    percentage: 0,
  };

  if (activeTerm) {
    const [gradeRows, attendanceRows] = await prisma.$transaction([
      prisma.grade.findMany({
        where: {
          schoolId: student.schoolId,
          studentId: student.id,
          termId: activeTerm.id,
        },
        select: {
          id: true,
          caScore: true,
          examScore: true,
          total: true,
          grade: true,
          subject: {
            select: {
              name: true,
            },
          },
        },
        orderBy: [{ subject: { name: 'asc' } }],
      }),
      prisma.attendance.findMany({
        where: {
          schoolId: student.schoolId,
          studentId: student.id,
          date: {
            gte: toStartOfDay(activeTerm.startDate),
            lte: toEndOfDay(activeTerm.endDate),
          },
        },
        select: {
          status: true,
        },
      }),
    ]);

    grades = gradeRows;

    const statusCounts = attendanceRows.reduce(
      (accumulator, row) => {
        const normalizedStatus = String(row.status ?? '').toUpperCase();
        if (normalizedStatus === 'PRESENT') {
          accumulator.present += 1;
        } else if (normalizedStatus === 'ABSENT') {
          accumulator.absent += 1;
        } else if (normalizedStatus === 'LATE') {
          accumulator.late += 1;
        }
        return accumulator;
      },
      { present: 0, absent: 0, late: 0 }
    );

    const totalAttendanceDays =
      statusCounts.present + statusCounts.absent + statusCounts.late;
    const percentage =
      totalAttendanceDays === 0
        ? 0
        : Math.round((statusCounts.present / totalAttendanceDays) * 10000) / 100;

    attendanceSummary = {
      present: statusCounts.present,
      absent: statusCounts.absent,
      late: statusCounts.late,
      percentage,
    };
  }

  const studentName = `${student.firstName} ${student.lastName}`.trim();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-gray-900">Student Dashboard</h1>
        <p className="mt-1 text-sm text-gray-500">
          Welcome, {studentName || 'Student'}
        </p>
      </div>

      <section className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-gray-900">Current Academic Term</h2>
        {!activeTerm ? (
          <p className="mt-2 text-sm text-gray-500">
            No active term is set for your school yet.
          </p>
        ) : (
          <dl className="mt-4 grid gap-3 text-sm text-gray-700 sm:grid-cols-2">
            <div>
              <dt className="font-medium text-gray-900">Session</dt>
              <dd className="mt-1">{activeTerm.session.name}</dd>
            </div>
            <div>
              <dt className="font-medium text-gray-900">Term</dt>
              <dd className="mt-1">{activeTerm.name}</dd>
            </div>
            <div>
              <dt className="font-medium text-gray-900">Admission Number</dt>
              <dd className="mt-1">{student.admissionNumber}</dd>
            </div>
            <div>
              <dt className="font-medium text-gray-900">Class</dt>
              <dd className="mt-1">
                {student.class
                  ? `${student.class.name} (Grade ${student.class.grade})`
                  : 'Unassigned'}
              </dd>
            </div>
          </dl>
        )}
      </section>

      <section className="rounded-lg border border-gray-200 bg-white shadow-sm">
        <div className="border-b border-gray-200 px-4 py-3">
          <h2 className="text-lg font-semibold text-gray-900">Grades</h2>
        </div>

        {!activeTerm ? (
          <p className="px-4 py-8 text-sm text-gray-500">
            Grades will appear once an active term is available.
          </p>
        ) : grades.length === 0 ? (
          <p className="px-4 py-8 text-sm text-gray-500">
            No grades have been recorded for this term.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-600">
                    Subject
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-600">
                    CA
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-600">
                    Exam
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
                {grades.map((grade) => (
                  <tr key={grade.id}>
                    <td className="px-4 py-3 text-sm text-gray-900">{grade.subject.name}</td>
                    <td className="px-4 py-3 text-sm text-gray-700">
                      {formatScore(grade.caScore)}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-700">
                      {formatScore(grade.examScore)}
                    </td>
                    <td className="px-4 py-3 text-sm font-medium text-gray-900">
                      {formatScore(resolveTotal(grade.caScore, grade.examScore, grade.total))}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-700">{grade.grade ?? '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-gray-900">Attendance Summary</h2>
        {!activeTerm ? (
          <p className="mt-2 text-sm text-gray-500">
            Attendance summary will appear once an active term is available.
          </p>
        ) : (
          <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-md border border-gray-200 bg-gray-50 p-4">
              <p className="text-sm text-gray-500">Present</p>
              <p className="mt-1 text-2xl font-semibold text-gray-900">
                {attendanceSummary.present}
              </p>
            </div>
            <div className="rounded-md border border-gray-200 bg-gray-50 p-4">
              <p className="text-sm text-gray-500">Absent</p>
              <p className="mt-1 text-2xl font-semibold text-gray-900">
                {attendanceSummary.absent}
              </p>
            </div>
            <div className="rounded-md border border-gray-200 bg-gray-50 p-4">
              <p className="text-sm text-gray-500">Late</p>
              <p className="mt-1 text-2xl font-semibold text-gray-900">
                {attendanceSummary.late}
              </p>
            </div>
            <div className="rounded-md border border-gray-200 bg-gray-50 p-4">
              <p className="text-sm text-gray-500">Attendance %</p>
              <p className="mt-1 text-2xl font-semibold text-gray-900">
                {formatPercentage(attendanceSummary.percentage)}
              </p>
            </div>
          </div>
        )}
      </section>

      <section className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-gray-900">Report Card</h2>
        {!activeTerm ? (
          <p className="mt-2 text-sm text-gray-500">
            A report card can be viewed when an active term is available.
          </p>
        ) : (
          <Link
            href={`/dashboard/student/report-card?termId=${activeTerm.id}`}
            className="mt-3 inline-flex items-center rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
          >
            View Full Report Card
          </Link>
        )}
      </section>
    </div>
  );
}

import Link from 'next/link';
import { getServerSession } from 'next-auth';
import { redirect } from 'next/navigation';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

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

function formatNumber(value: number | null): string {
  if (value === null) {
    return '-';
  }

  if (Number.isInteger(value)) {
    return String(value);
  }

  return value.toFixed(2).replace(/\.?0+$/, '');
}

function formatPercentage(value: number): string {
  if (Number.isInteger(value)) {
    return `${value}%`;
  }

  return `${value.toFixed(2).replace(/\.?0+$/, '')}%`;
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

export default async function ParentDashboardPage() {
  const session = await getServerSession(authOptions);

  if (!session?.user || session.user.role !== 'PARENT') {
    redirect('/login');
  }

  const parent = await prisma.parent.findFirst({
    where: {
      userId: session.user.id,
    },
    select: {
      id: true,
      schoolId: true,
      user: {
        select: {
          name: true,
          email: true,
        },
      },
      students: {
        select: {
          student: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              class: {
                select: {
                  name: true,
                  grade: true,
                },
              },
            },
          },
        },
      },
    },
  });

  if (!parent) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-semibold text-gray-900">Parent Dashboard</h1>
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
          Your parent profile is not linked yet. Contact an administrator.
        </div>
      </div>
    );
  }

  const linkedStudents = parent.students
    .map((entry) => entry.student)
    .sort((a, b) => {
      const firstNameCompare = a.firstName.localeCompare(b.firstName);
      if (firstNameCompare !== 0) {
        return firstNameCompare;
      }
      return a.lastName.localeCompare(b.lastName);
    });

  const studentIds = linkedStudents.map((student) => student.id);

  const activeTerm = await prisma.term.findFirst({
    where: {
      isActive: true,
      session: {
        is: {
          schoolId: parent.schoolId,
        },
      },
    },
    select: {
      id: true,
      name: true,
      session: {
        select: {
          name: true,
        },
      },
      startDate: true,
      endDate: true,
    },
    orderBy: {
      startDate: 'desc',
    },
  });

  const gradeAverageByStudentId = new Map<string, number | null>();
  const attendanceByStudentId = new Map<
    string,
    { present: number; absent: number; late: number; percentage: number }
  >();

  for (const studentId of studentIds) {
    gradeAverageByStudentId.set(studentId, null);
    attendanceByStudentId.set(studentId, {
      present: 0,
      absent: 0,
      late: 0,
      percentage: 0,
    });
  }

  if (activeTerm && studentIds.length > 0) {
    const [gradeRows, attendanceRows] = await prisma.$transaction([
      prisma.grade.findMany({
        where: {
          schoolId: parent.schoolId,
          termId: activeTerm.id,
          studentId: {
            in: studentIds,
          },
        },
        select: {
          studentId: true,
          caScore: true,
          examScore: true,
          total: true,
        },
      }),
      prisma.attendance.findMany({
        where: {
          schoolId: parent.schoolId,
          studentId: {
            in: studentIds,
          },
          date: {
            gte: toStartOfDay(activeTerm.startDate),
            lte: toEndOfDay(activeTerm.endDate),
          },
        },
        select: {
          studentId: true,
          status: true,
        },
      }),
    ]);

    const gradeAccumulator = new Map<string, { sum: number; count: number }>();

    for (const studentId of studentIds) {
      gradeAccumulator.set(studentId, { sum: 0, count: 0 });
    }

    for (const row of gradeRows) {
      const total = resolveTotal(row.caScore, row.examScore, row.total);
      if (total === null) {
        continue;
      }

      const current = gradeAccumulator.get(row.studentId) ?? { sum: 0, count: 0 };
      current.sum += total;
      current.count += 1;
      gradeAccumulator.set(row.studentId, current);
    }

    for (const studentId of studentIds) {
      const current = gradeAccumulator.get(studentId) ?? { sum: 0, count: 0 };
      const average =
        current.count === 0 ? null : Math.round((current.sum / current.count) * 100) / 100;
      gradeAverageByStudentId.set(studentId, average);
    }

    for (const row of attendanceRows) {
      const current = attendanceByStudentId.get(row.studentId) ?? {
        present: 0,
        absent: 0,
        late: 0,
        percentage: 0,
      };

      const status = String(row.status ?? '').toUpperCase();
      if (status === 'PRESENT') {
        current.present += 1;
      } else if (status === 'ABSENT') {
        current.absent += 1;
      } else if (status === 'LATE') {
        current.late += 1;
      }

      attendanceByStudentId.set(row.studentId, current);
    }

    for (const studentId of studentIds) {
      const current = attendanceByStudentId.get(studentId) ?? {
        present: 0,
        absent: 0,
        late: 0,
        percentage: 0,
      };

      const total = current.present + current.absent + current.late;
      current.percentage = total === 0 ? 0 : Math.round((current.present / total) * 10000) / 100;
      attendanceByStudentId.set(studentId, current);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-gray-900">Parent Dashboard</h1>
        <p className="mt-1 text-sm text-gray-500">
          Welcome, {parent.user.name || parent.user.email}
        </p>
      </div>

      <section className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-gray-900">Current Term</h2>
        {activeTerm ? (
          <p className="mt-2 text-sm text-gray-700">
            {activeTerm.session.name} - {activeTerm.name}
          </p>
        ) : (
          <p className="mt-2 text-sm text-gray-500">
            No active term is available right now.
          </p>
        )}
      </section>

      {linkedStudents.length === 0 ? (
        <section className="rounded-lg border border-gray-200 bg-white p-8 text-center shadow-sm">
          <h2 className="text-lg font-medium text-gray-900">No linked children</h2>
          <p className="mt-2 text-sm text-gray-500">
            No students are linked to your account yet.
          </p>
        </section>
      ) : (
        <section className="grid gap-4 md:grid-cols-2">
          {linkedStudents.map((student) => {
            const attendance = attendanceByStudentId.get(student.id) ?? {
              present: 0,
              absent: 0,
              late: 0,
              percentage: 0,
            };

            const overallAverage = gradeAverageByStudentId.get(student.id) ?? null;

            return (
              <article
                key={student.id}
                className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm"
              >
                <h3 className="text-lg font-semibold text-gray-900">
                  {student.firstName} {student.lastName}
                </h3>
                <p className="mt-1 text-sm text-gray-600">
                  {student.class
                    ? `${student.class.name} (Grade ${student.class.grade})`
                    : 'Class: Unassigned'}
                </p>

                <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
                  <div className="rounded-md border border-gray-100 bg-gray-50 px-3 py-2">
                    <dt className="text-gray-500">Attendance</dt>
                    <dd className="mt-1 text-base font-semibold text-gray-900">
                      {formatPercentage(attendance.percentage)}
                    </dd>
                  </div>
                  <div className="rounded-md border border-gray-100 bg-gray-50 px-3 py-2">
                    <dt className="text-gray-500">Overall Average</dt>
                    <dd className="mt-1 text-base font-semibold text-gray-900">
                      {formatNumber(overallAverage)}
                    </dd>
                  </div>
                </dl>

                {activeTerm ? (
                  <Link
                    href={`/dashboard/parent/report-card/${student.id}?termId=${activeTerm.id}`}
                    className="mt-5 inline-flex items-center rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
                  >
                    View Full Report Card
                  </Link>
                ) : (
                  <p className="mt-5 text-sm text-gray-500">
                    Full report card will be available when an active term is set.
                  </p>
                )}
              </article>
            );
          })}
        </section>
      )}
    </div>
  );
}

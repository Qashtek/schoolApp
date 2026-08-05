import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

type PageProps = {
  searchParams?: {
    success?: string;
    error?: string;
  };
};

export default async function TeacherStudentsPage({ searchParams }: PageProps) {
  const session = await getServerSession(authOptions);

  if (!session?.user || session.user.role !== 'TEACHER') {
    return (
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <h1 className="text-2xl font-bold">Students</h1>
        </div>
        <div className="bg-white shadow rounded-lg">
          <div className="px-4 py-5 sm:p-6">
            <p className="text-red-600">Access denied</p>
          </div>
        </div>
      </div>
    );
  }

  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);
  const endOfDay = new Date(startOfDay);
  endOfDay.setDate(endOfDay.getDate() + 1);

  const teacher = await prisma.teacher.findFirst({
    where: {
      userId: session.user.id,
      deletedAt: null,
    },
    select: {
      id: true,
    },
  });

  if (!teacher) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold">Students</h1>
        <div className="bg-white shadow rounded-lg">
          <div className="px-4 py-5 sm:p-6">
            <p className="text-red-600">Teacher profile not found.</p>
          </div>
        </div>
      </div>
    );
  }

  // Class IDs where this teacher is the assigned class teacher — attendance
  // marking is only allowed for these classes, not subject-teacher-only classes.
  const assignedClassRecords = await prisma.teacherClassSubject.findMany({
    where: {
      teacherId: teacher.id,
    },
    include: {
      class: {
        include: {
          students: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
            },
            orderBy: [
              { lastName: 'asc' },
              { firstName: 'asc' },
            ],
          },
          attendances: {
            where: {
              date: {
                gte: startOfDay,
                lt: endOfDay,
              },
            },
            select: {
              studentId: true,
              status: true,
            },
          },
        },
      },
    },
    orderBy: {
      classId: 'asc',
    },
  });

  const classTeacherClassIds = new Set(
    assignedClassRecords
      .filter((record) => record.assignmentType === 'CLASS_TEACHER')
      .map((record) => record.classId)
  );
  const canTakeAttendance = classTeacherClassIds.size > 0;

  // Deduplicate by classId — a teacher may have both CLASS_TEACHER and SUBJECT_TEACHER for the same class
  const seenClassIds = new Set<string>();
  const assignedClasses = assignedClassRecords.filter((record) => {
    if (seenClassIds.has(record.classId)) {
      return false;
    }
    seenClassIds.add(record.classId);
    return true;
  });

  const successMessage = searchParams?.success;
  const errorMessage = searchParams?.error;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold">Students</h1>
      </div>

      {!canTakeAttendance ? (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <p className="text-sm text-blue-700">
            You are a subject teacher. You can view students in your assigned classes and enter grades, but attendance is handled by class teachers.
          </p>
        </div>
      ) : null}

      {successMessage && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-4">
          <p className="text-sm text-green-700">{successMessage}</p>
        </div>
      )}

      {errorMessage && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-sm text-red-700">{errorMessage}</p>
        </div>
      )}

      <div className="bg-white shadow rounded-lg">
        <div className="px-4 py-5 sm:p-6">
          {assignedClasses.length === 0 ? (
            <p className="text-gray-500">No classes assigned yet.</p>
          ) : (
            <div className="space-y-8">
              {assignedClasses.map(({ class: classItem }) => {
                const attendanceByStudentId = new Map(
                  classItem.attendances.map((attendance) => [attendance.studentId, attendance.status])
                );
                const alreadyMarkedToday = classItem.attendances.length > 0;
                // Only the assigned class teacher of THIS class can mark attendance.
                const isClassTeacherForThisClass = classTeacherClassIds.has(classItem.id);

                return (
                  <section key={classItem.id} className="border border-gray-200 rounded-lg">
                    <div className="px-4 py-3 border-b border-gray-200 bg-gray-50">
                      <div className="flex items-center gap-2">
                        <h2 className="text-lg font-semibold text-gray-900">{classItem.name}</h2>
                        {isClassTeacherForThisClass ? (
                          <span className="inline-flex items-center rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-medium text-emerald-700 ring-1 ring-inset ring-emerald-200">
                            Class Teacher
                          </span>
                        ) : (
                          <span className="inline-flex items-center rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-600 ring-1 ring-inset ring-gray-200">
                            Subject Teacher
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-gray-600">
                        Grade {classItem.grade} • {classItem.students.length} student{classItem.students.length === 1 ? '' : 's'}
                      </p>
                      {alreadyMarkedToday && (
                        <p className="text-sm text-amber-700 mt-1">Attendance already marked for today.</p>
                      )}
                    </div>

                    {classItem.students.length === 0 ? (
                      <div className="px-4 py-4">
                        <p className="text-sm text-gray-500">No students in this class.</p>
                      </div>
                    ) : !isClassTeacherForThisClass ? (
                      <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-gray-200">
                          <thead className="bg-white">
                            <tr>
                              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Student Name</th>
                              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Attendance Today</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-100">
                            {classItem.students.map((student) => {
                              const attendanceToday = attendanceByStudentId.get(student.id);
                              return (
                                <tr key={student.id}>
                                  <td className="px-4 py-3 text-sm text-gray-900">
                                    {student.firstName} {student.lastName}
                                  </td>
                                  <td className="px-4 py-3 text-sm text-gray-700">
                                    {attendanceToday ?? 'Not marked'}
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    ) : (
                      <form method="post" action="/api/attendance?returnTo=/dashboard/teacher/students">
                        <input type="hidden" name="classId" value={classItem.id} />
                        <div className="overflow-x-auto">
                          <table className="min-w-full divide-y divide-gray-200">
                            <thead className="bg-white">
                              <tr>
                                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Student Name</th>
                                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Attendance Today</th>
                                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Mark</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                              {classItem.students.map((student) => {
                                const attendanceToday = attendanceByStudentId.get(student.id);
                                return (
                                  <tr key={student.id}>
                                    <td className="px-4 py-3 text-sm text-gray-900">
                                      {student.firstName} {student.lastName}
                                    </td>
                                    <td className="px-4 py-3 text-sm text-gray-700">
                                      {attendanceToday ?? 'Not marked'}
                                    </td>
                                    <td className="px-4 py-3 text-sm text-gray-700">
                                      <select
                                        name={`status_${student.id}`}
                                        defaultValue={(attendanceToday ?? 'PRESENT') as 'PRESENT' | 'ABSENT' | 'LATE'}
                                        className="border border-gray-300 rounded px-2 py-1"
                                        disabled={alreadyMarkedToday}
                                      >
                                        <option value="PRESENT">PRESENT</option>
                                        <option value="ABSENT">ABSENT</option>
                                        <option value="LATE">LATE</option>
                                      </select>
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                        <div className="px-4 py-3 border-t border-gray-200 bg-gray-50 flex justify-end">
                          <button
                            type="submit"
                            disabled={alreadyMarkedToday}
                            className="px-4 py-2 rounded bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            {alreadyMarkedToday ? 'Already Marked' : 'Submit Attendance'}
                          </button>
                        </div>
                      </form>
                    )}
                  </section>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

import { getServerSession } from 'next-auth';
import { redirect } from 'next/navigation';
import { authOptions } from '@/lib/auth';
import { isAdmin } from '@/lib/permissions';
import { prisma } from '@/lib/prisma';

interface SearchParams {
  classId?: string;
  date?: string;
}

function parseDateParam(dateParam?: string): Date | null {
  if (!dateParam) {
    return null;
  }

  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateParam);
  if (!match) {
    return null;
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const parsed = new Date(year, month - 1, day);

  if (
    parsed.getFullYear() !== year ||
    parsed.getMonth() !== month - 1 ||
    parsed.getDate() !== day
  ) {
    return null;
  }

  return parsed;
}

function formatDateForInput(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export default async function AdminAttendancePage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const session = await getServerSession(authOptions);

  if (!session?.user?.role || !isAdmin(session.user.role)) {
    redirect('/login');
  }

  const schoolId = session.user.schoolId;
  if (!schoolId) {
    throw new Error('Admin not assigned to school');
  }

  // Fetch all classes for the admin's school
  const classes = await prisma.class.findMany({
    where: { schoolId },
    orderBy: { name: 'asc' },
  });

  // Handle filters
  const selectedClassId = searchParams.classId || classes[0]?.id;
  // Determine start of day for the provided date (or today), parsing in local time.
  const selectedDate = parseDateParam(searchParams.date) ?? new Date();
  const startOfDay = new Date(
    selectedDate.getFullYear(),
    selectedDate.getMonth(),
    selectedDate.getDate()
  );
  const nextDay = new Date(startOfDay);
  nextDay.setDate(nextDay.getDate() + 1);
  const dateInputValue = formatDateForInput(startOfDay);

  // Fetch attendance records only if classId exists, using gte/lt range
  const attendanceRecords = selectedClassId
    ? await prisma.attendance.findMany({
        where: {
          classId: selectedClassId,
          schoolId,
          date: {
            gte: startOfDay,
            lt: nextDay,
          },
        },
        select: {
          id: true,
          status: true,
          student: {
            select: {
              firstName: true,
              lastName: true,
            },
          },
        },
        orderBy: [{ student: { lastName: 'asc' } }, { student: { firstName: 'asc' } }],
      })
    : [];

  const totalStudents = attendanceRecords.length;
  const present = attendanceRecords.filter((record) => record.status === 'PRESENT').length;
  const absent = attendanceRecords.filter((record) => record.status === 'ABSENT').length;
  const late = attendanceRecords.filter((record) => record.status === 'LATE').length;
  const attendancePercentage = (
    totalStudents > 0 ? (present / totalStudents) * 100 : 0
  ).toFixed(1);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-gray-900">Attendance Dashboard</h1>
        <p className="mt-1 text-sm text-gray-500">View and manage attendance records</p>
      </div>

      {/* Filters */}
      <form method="GET" className="bg-white p-6 rounded-lg shadow-sm border border-gray-100">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label htmlFor="classId" className="block text-sm font-medium text-gray-700">
              Select Class
            </label>
            <select
              id="classId"
              name="classId"
              defaultValue={selectedClassId || ''}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
            >
              {classes.map((cls) => (
                <option key={cls.id} value={cls.id}>
                  {cls.name}
                </option>
              ))}
              {classes.length === 0 && <option value="">No classes available</option>}
            </select>
          </div>
          <div>
            <label htmlFor="date" className="block text-sm font-medium text-gray-700">
              Select Date
            </label>
            <input
              type="date"
              id="date"
              name="date"
              defaultValue={dateInputValue}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
            />
          </div>
        </div>
        <div className="mt-4">
          <button
            type="submit"
            className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
          >
            View Attendance
          </button>
        </div>
      </form>

      {/* Summary Cards */}
      {selectedClassId && (
        <div className="grid grid-cols-1 md:grid-cols-5 gap-6">
          <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-100">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <div className="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center">
                  <span className="text-white text-sm font-medium">T</span>
                </div>
              </div>
              <div className="ml-4">
                <dt className="text-sm font-medium text-gray-500 truncate">Total Students</dt>
                <dd className="text-lg font-semibold text-gray-900">{totalStudents}</dd>
              </div>
            </div>
          </div>
          <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-100">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <div className="w-8 h-8 bg-green-500 rounded-full flex items-center justify-center">
                  <span className="text-white text-sm font-medium">P</span>
                </div>
              </div>
              <div className="ml-4">
                <dt className="text-sm font-medium text-gray-500 truncate">Present</dt>
                <dd className="text-lg font-semibold text-gray-900">{present}</dd>
              </div>
            </div>
          </div>
          <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-100">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <div className="w-8 h-8 bg-red-500 rounded-full flex items-center justify-center">
                  <span className="text-white text-sm font-medium">A</span>
                </div>
              </div>
              <div className="ml-4">
                <dt className="text-sm font-medium text-gray-500 truncate">Absent</dt>
                <dd className="text-lg font-semibold text-gray-900">{absent}</dd>
              </div>
            </div>
          </div>
          <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-100">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <div className="w-8 h-8 bg-yellow-500 rounded-full flex items-center justify-center">
                  <span className="text-white text-sm font-medium">L</span>
                </div>
              </div>
              <div className="ml-4">
                <dt className="text-sm font-medium text-gray-500 truncate">Late</dt>
                <dd className="text-lg font-semibold text-gray-900">{late}</dd>
              </div>
            </div>
          </div>
          <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-100">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <div className="w-8 h-8 bg-indigo-500 rounded-full flex items-center justify-center">
                  <span className="text-white text-sm font-medium">%</span>
                </div>
              </div>
              <div className="ml-4">
                <dt className="text-sm font-medium text-gray-500 truncate">Attendance %</dt>
                <dd className="text-lg font-semibold text-gray-900">{attendancePercentage}%</dd>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Attendance Table */}
      {selectedClassId && (
        <div className="bg-white shadow-sm border border-gray-100 rounded-lg overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200">
            <h3 className="text-lg font-medium text-gray-900">Attendance Records</h3>
          </div>
          {attendanceRecords.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Student Name
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Status
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {attendanceRecords.map((record) => (
                    <tr key={record.id}>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        {record.student.firstName} {record.student.lastName}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span
                          className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                            record.status === 'PRESENT'
                              ? 'bg-green-100 text-green-800'
                              : record.status === 'ABSENT'
                              ? 'bg-red-100 text-red-800'
                              : record.status === 'LATE'
                              ? 'bg-yellow-100 text-yellow-800'
                              : 'bg-gray-100 text-gray-800'
                          }`}
                        >
                          {record.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="px-6 py-4 text-center text-gray-500">
              No attendance records found for the selected class and date.
            </div>
          )}
        </div>
      )}
    </div>
  );
}

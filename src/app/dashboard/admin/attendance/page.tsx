import { getServerSession } from 'next-auth';
import { redirect } from 'next/navigation';
import { authOptions } from '@/lib/auth';
import { ClassService } from '@/lib/services/class.service';
import { prisma } from '@/lib/prisma';

interface SearchParams {
  classId?: string;
  date?: string;
}

export default async function AdminAttendancePage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const session = await getServerSession(authOptions);

  if (!session || session.user.role !== 'ADMIN') {
    redirect('/login');
  }

  const schoolId = session.user.schoolId;
  if (!schoolId) {
    throw new Error('Admin not assigned to school');
  }

  console.log("SCHOOL ID:", session.user.schoolId);

  // Fetch all classes for the admin's school
  const classes = await prisma.class.findMany({
    where: { schoolId },
    orderBy: { name: 'asc' },
  });

  console.log("CLASSES:", classes);
  console.log("SEARCH PARAMS:", searchParams);

  // Handle filters
  const selectedClassId = searchParams.classId || (classes.length > 0 ? classes[0].id : undefined);
  // Determine start of day for the provided date (or today)
  const dateParam = searchParams.date || null;
  const parsedDate = dateParam ? new Date(dateParam) : new Date();
  const startOfDay = new Date(parsedDate);
  startOfDay.setHours(0, 0, 0, 0);
  const nextDay = new Date(startOfDay);
  nextDay.setDate(nextDay.getDate() + 1);

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
        include: {
          student: {
            include: {
              user: {
                select: {
                  name: true,
                },
              },
            },
          },
        },
        orderBy: {
          student: {
            user: {
              name: 'asc',
            },
          },
        },
      })
    : [];

  let totalStudents = 0;
  let present = 0;
  let absent = 0;
  let late = 0;
  let attendancePercentage = '0.0';

  if (selectedClassId) {
    // Get total students in class
    const classWithCount = await prisma.class.findUnique({
      where: { id: selectedClassId },
      select: {
        _count: {
          select: {
            students: true,
          },
        },
      },
    });
    totalStudents = classWithCount?._count.students || 0;

    // Calculate summary
    const total = attendanceRecords.length;
    present = attendanceRecords.filter((a) => a.status === 'PRESENT').length;
    absent = attendanceRecords.filter((a) => a.status === 'ABSENT').length;
    late = attendanceRecords.filter((a) => a.status === 'LATE').length;

    // Prefer percentage over total students when possible
    const pct =
      totalStudents > 0
        ? (present / totalStudents) * 100
        : total > 0
        ? (present / total) * 100
        : 0;
    attendancePercentage = pct.toFixed(1);
  }

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
              <option value="">Select a class</option>
              {classes.map((cls) => (
                <option key={cls.id} value={cls.id}>
                  {cls.name} ({cls.grade})
                </option>
              ))}
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
              defaultValue={dateParam ? new Date(dateParam).toISOString().slice(0, 10) : startOfDay.toISOString().slice(0, 10)}
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
                        {record.student.user.name}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span
                          className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                            record.status === 'PRESENT'
                              ? 'bg-green-100 text-green-800'
                              : record.status === 'ABSENT'
                              ? 'bg-red-100 text-red-800'
                              : 'bg-yellow-100 text-yellow-800'
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
              No attendance recorded for this date.
            </div>
          )}
        </div>
      )}
    </div>
  );
}

import { getServerSession } from 'next-auth';
import { redirect } from 'next/navigation';
import { BookOpen, Users, User, Lock, Award, Calendar } from 'lucide-react';
import { authOptions } from '@/lib/auth';
import { TeacherService } from '@/lib/services/teacher.service';
import { Role } from '@/lib/permissions';
import Link from 'next/link';

export default async function TeacherDashboardPage({
  searchParams,
}: {
  searchParams?: { error?: string; success?: string };
}) {
  const session = await getServerSession(authOptions);

  // Check authentication and teacher role
  if (!session?.user) {
    redirect('/login');
  }

  const userRole = session.user.role as Role;
  if (userRole !== 'TEACHER') {
    redirect('/dashboard');
  }

  // Fetch teacher data using service
  const user = {
    id: session.user.id,
    role: userRole,
    email: session.user.email,
  };

  const teacherService = new TeacherService(user);
  let teacher;
  try {
    teacher = await teacherService.getTeacherByUserId(session.user.id);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to load teacher profile';
    return (
      <div className="p-8">
        <div className="max-w-2xl rounded-lg border border-amber-200 bg-amber-50 p-6">
          <h1 className="text-xl font-semibold text-amber-900">Teacher Profile Missing</h1>
          <p className="mt-2 text-sm text-amber-800">
            Your account is authenticated but no teacher profile is linked yet. Contact an admin to complete setup.
          </p>
          <p className="mt-3 text-xs text-amber-700">{message}</p>
        </div>
      </div>
    );
  }

  // Group assignments by classId to determine per-class role
  const classHasClassTeacher: Record<string, boolean> = {};

  for (const cs of teacher.classSubjects) {
    if (cs.assignmentType === 'CLASS_TEACHER') {
      classHasClassTeacher[cs.classId] = true;
    }
  }

  // My Class: classes where teacher is CLASS_TEACHER (deduplicated)
  const classTeacherClasses: Array<{ classId: string; classData: { name: string; grade: string; _count: { students: number }; school: { name: string } | null } }> = [];
  for (const cs of teacher.classSubjects) {
    if (cs.assignmentType === 'CLASS_TEACHER' && !classTeacherClasses.some((c) => c.classId === cs.classId)) {
      classTeacherClasses.push({ classId: cs.classId, classData: cs.class });
    }
  }

  // My Subject Classes: SUBJECT_TEACHER only, excluding classes already shown as CLASS_TEACHER
  const subjectTeacherDisplay: typeof teacher.classSubjects = [];
  for (const cs of teacher.classSubjects) {
    if (cs.assignmentType === 'SUBJECT_TEACHER' && !classHasClassTeacher[cs.classId]) {
      subjectTeacherDisplay.push(cs);
    }
  }

  const canTakeAttendance = classTeacherClasses.length > 0;
  const hasSubjectAssignments = subjectTeacherDisplay.length > 0;
  const teacherTypeLabel = [
    canTakeAttendance ? 'Class Teacher' : null,
    hasSubjectAssignments ? 'Subject Teacher' : null,
  ].filter(Boolean).join(' & ') || 'Teacher';

  // Unique classIds across all assignments
  const uniqueClassIds: string[] = [];
  for (const cs of teacher.classSubjects) {
    if (!uniqueClassIds.includes(cs.classId)) {
      uniqueClassIds.push(cs.classId);
    }
  }

  // Total students across all assigned classes (deduplicated by classId)
  let totalStudents = 0;
  for (const cid of uniqueClassIds) {
    const csForClass = teacher.classSubjects.find((cs) => cs.classId === cid);
    totalStudents += csForClass?.class?._count?.students ?? 0;
  }

  // Format active since date
  const activeSince = teacher.createdAt
    ? new Date(teacher.createdAt).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      })
    : 'Unknown';

  return (
    <div className="p-8">
      {searchParams?.error && (
        <div className="mb-6 rounded-lg border border-red-200 bg-red-50 px-4 py-3">
          <p className="text-sm text-red-700">{searchParams.error}</p>
        </div>
      )}
      {searchParams?.success && (
        <div className="mb-6 rounded-lg border border-green-200 bg-green-50 px-4 py-3">
          <p className="text-sm text-green-700">{searchParams.success}</p>
        </div>
      )}

      {/* Page header */}
      <div className="mb-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold text-gray-900">
              Teacher Dashboard
            </h1>
            <p className="mt-1 text-sm text-gray-500">
              Welcome back, {teacher.user.name}
            </p>
          </div>
          <Link
            href="/dashboard/change-password"
            className="inline-flex items-center gap-2 rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            <Lock className="h-4 w-4" />
            Change Password
          </Link>
        </div>
      </div>

      <div className="mb-8 rounded-lg border border-amber-200 bg-amber-50 p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-amber-800">
            For security, change your admin-provided default password as soon as you sign in.
          </p>
          <Link
            href="/dashboard/change-password"
            className="inline-flex items-center gap-2 rounded-md bg-amber-600 px-3 py-2 text-xs font-semibold text-white hover:bg-amber-700"
          >
            <Lock className="h-3.5 w-3.5" />
            Update Password
          </Link>
        </div>
      </div>

      {/* Teacher Info Card */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-100 p-6 mb-8">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center">
            <User className="w-8 h-8 text-blue-600" />
          </div>
          <div>
            <h2 className="text-xl font-semibold text-gray-900">
              {teacher.user.name}
            </h2>
            <p className="text-sm text-gray-500">{teacher.user.email}</p>
            <p className="text-sm text-gray-600 mt-1">
              Type: {teacherTypeLabel}
            </p>
            {teacher.subject && (
              <p className="text-sm text-gray-600 mt-1">
                Subject: {teacher.subject}
              </p>
            )}
            {teacher.school && (
              <p className="text-sm text-gray-600">
                School: {teacher.school.name}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        <div className="bg-white rounded-lg shadow-sm border border-gray-100 p-6">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-blue-50 rounded-lg">
              <BookOpen className="w-6 h-6 text-blue-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Assigned Classes</p>
              <p className="text-2xl font-semibold text-gray-900">
                {uniqueClassIds.length}
              </p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-lg shadow-sm border border-gray-100 p-6">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-green-50 rounded-lg">
              <Users className="w-6 h-6 text-green-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Total Students</p>
              <p className="text-2xl font-semibold text-gray-900">
                {totalStudents}
              </p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-lg shadow-sm border border-gray-100 p-6">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-indigo-50 rounded-lg">
              <Award className="w-6 h-6 text-indigo-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Teacher Type</p>
              <p className="text-lg font-semibold text-gray-900">
                {teacherTypeLabel}
              </p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-lg shadow-sm border border-gray-100 p-6">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-purple-50 rounded-lg">
              <Calendar className="w-6 h-6 text-purple-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Active Since</p>
              <p className="text-sm font-semibold text-gray-900">
                {activeSince}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* My Class Section — CLASS_TEACHER */}
      {classTeacherClasses.length > 0 && (
        <div className="bg-white rounded-lg shadow-sm border border-gray-100 mb-8">
          <div className="px-6 py-4 border-b border-gray-100">
            <h3 className="text-lg font-medium text-gray-900">My Class</h3>
            <p className="text-sm text-gray-500">
              Class you manage for attendance and grading
            </p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Class Name
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Grade
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Students
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    School
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {classTeacherClasses.map(({ classId, classData }) => (
                  <tr key={classId} className="hover:bg-gray-50">
                    <td className="px-6 py-4">
                      <span className="text-sm font-medium text-gray-900">
                        {classData.name}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-sm text-gray-900">
                        Grade {classData.grade}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-sm text-gray-900">
                        {classData._count.students} students
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-sm text-gray-500">
                        {classData.school?.name || 'Not assigned'}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-wrap gap-3">
                        <Link
                          href={`/dashboard/teacher/attendance/${classId}`}
                          className="inline-flex items-center rounded-md bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700 transition-colors"
                        >
                          Take Attendance
                        </Link>
                        <Link
                          href={`/dashboard/teacher/grades/${classId}`}
                          className="inline-flex items-center rounded-md bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-700 transition-colors"
                        >
                          Grade Students
                        </Link>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* My Subject Classes Section — SUBJECT_TEACHER */}
      {subjectTeacherDisplay.length > 0 && (
        <div className="bg-white rounded-lg shadow-sm border border-gray-100">
          <div className="px-6 py-4 border-b border-gray-100">
            <h3 className="text-lg font-medium text-gray-900">My Subject Classes</h3>
            <p className="text-sm text-gray-500">
              Classes you teach by assigned subject
            </p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Class Name
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Subject
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Grade
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Students
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {subjectTeacherDisplay.map((cs) => (
                  <tr key={cs.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4">
                      <span className="text-sm font-medium text-gray-900">
                        {cs.class.name}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span className="inline-flex items-center rounded-full bg-blue-50 px-2.5 py-0.5 text-xs font-medium text-blue-700 ring-1 ring-inset ring-blue-200">
                        {cs.subject?.name ?? 'Unknown'}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-sm text-gray-900">
                        Grade {cs.class.grade}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-sm text-gray-900">
                        {cs.class._count.students} students
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <Link
                        href={`/dashboard/teacher/grades/${cs.class.id}`}
                        className="inline-flex items-center rounded-md bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-700 transition-colors"
                      >
                        Grade Students
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Empty State */}
      {uniqueClassIds.length === 0 && (
        <div className="bg-white rounded-lg shadow-sm border border-gray-100">
          <div className="p-12 text-center">
            <BookOpen className="w-12 h-12 text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              No classes assigned
            </h3>
            <p className="text-sm text-gray-500">
              You haven&apos;t been assigned to any classes yet.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

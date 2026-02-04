
import { redirect } from 'next/navigation';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { Role } from '@/lib/permissions';
import { AttendanceService } from '@/lib/services/attendance.service';
import { TeacherService } from '@/lib/services/teacher.service';
import { prisma } from '@/lib/prisma';
import AttendanceForm from './attendance-form';

interface PageProps {
  params: {
    classId: string;
  };
}

export default async function AttendancePage({ params }: PageProps) {
  const session = await getServerSession(authOptions);

  // Redirect to login if not authenticated
  if (!session?.user) {
    redirect('/login');
  }

  // Check for teacher role
  if (!session.user.role || session.user.role !== 'TEACHER') {
    redirect('/dashboard');
  }

  const classId = params.classId;

  // Verify class exists and teacher is assigned to it
  const user = {
    id: session.user.id,
    role: session.user.role as Role,
    email: session.user.email,
  };

  const teacherService = new TeacherService(user);
  const attendanceService = new AttendanceService(user);

  try {
    // Check if teacher is assigned to this class
    const teacherClasses = await teacherService.getTeacherClasses(session.user.id);
    const isAssigned = teacherClasses.some(cls => cls.id === classId);

    if (!isAssigned) {
      redirect('/dashboard/teacher');
    }

    // Get class details with students
    const classWithStudents = await prisma.class.findUnique({
      where: { id: classId },
      include: {
        students: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                email: true,
              },
            },
          },
        },
        school: true,
      },
    });

    if (!classWithStudents) {
      redirect('/dashboard/teacher');
    }

    // Check if attendance is already marked today
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const existingAttendance = await attendanceService.getAttendanceForClass(classId, today);
    const isAlreadyMarked = existingAttendance.length > 0;

    // Create attendance map for pre-populating form
    const attendanceMap: Record<string, 'PRESENT' | 'ABSENT' | 'LATE'> = {};
    existingAttendance.forEach(record => {
      attendanceMap[record.studentId] = record.status as 'PRESENT' | 'ABSENT' | 'LATE';
    });

    return (
      <div className="p-8">
        {/* Page header */}
        <div className="mb-8">
          <h1 className="text-2xl font-semibold text-gray-900">
            Mark Attendance
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            {classWithStudents.name} - Grade {classWithStudents.grade}
            {classWithStudents.school && (
              <span className="ml-2">({classWithStudents.school.name})</span>
            )}
          </p>
        </div>

        {/* Attendance Form */}
        <AttendanceForm
          classId={classId}
          students={classWithStudents.students}
          isAlreadyMarked={isAlreadyMarked}
          existingAttendance={attendanceMap}
        />
      </div>
    );
  } catch (error) {
    console.error('Error loading attendance page:', error);
    redirect('/dashboard/teacher');
  }
}

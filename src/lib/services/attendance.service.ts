import { prisma } from '@/lib/prisma';
import { AuthenticatedUser } from '@/lib/permissions';
import { TeacherService } from '@/lib/services/teacher.service';

export interface AttendanceRecord {
  studentId: string;
  status: 'PRESENT' | 'ABSENT' | 'LATE';
}

export interface MarkAttendanceInput {
  classId: string;
  date: Date;
  records: AttendanceRecord[];
}

export interface MarkSingleAttendanceInput {
  classId: string;
  studentId: string;
  status: 'PRESENT' | 'ABSENT' | 'LATE';
}

const studentAttendanceSelect = {
  id: true,
  firstName: true,
  lastName: true,
  user: {
    select: {
      id: true,
      name: true,
      email: true,
    },
  },
} as const;

const teacherAttendanceSelect = {
  id: true,
  user: {
    select: {
      id: true,
      name: true,
      email: true,
    },
  },
} as const;

const classAttendanceSelect = {
  id: true,
  name: true,
  grade: true,
} as const;

export class AttendanceService {
  private user: AuthenticatedUser;

  constructor(user: AuthenticatedUser) {
    this.user = user;
  }

  /**
   * Check if the current user is a teacher
   * Only TEACHER role can mark attendance
   */
  private requireTeacher(): void {
    if (this.user.role !== 'TEACHER') {
      throw new Error('Unauthorized: Only teachers can mark attendance');
    }
  }

  /**
   * Check if the teacher has any assignment to the specified class
   */
  private async requireClassAssignment(teacherId: string, classId: string): Promise<void> {
    const assignment = await prisma.teacherClassSubject.findFirst({
      where: {
        teacherId,
        classId,
      },
      select: { id: true },
    });

    if (!assignment) {
      throw new Error('Unauthorized: Teacher is not assigned to this class');
    }
  }

  private async requireClassTeacherAssignment(teacherId: string, classId: string): Promise<void> {
    const teacherService = new TeacherService(this.user);
    const isAssignedToClass = await teacherService.isAssignedToClass(teacherId, classId);

    if (!isAssignedToClass) {
      throw new Error('You are not assigned to this class');
    }

    const isClassTeacher = await teacherService.isClassTeacherOf(teacherId, classId);

    if (!isClassTeacher) {
      throw new Error('Only the class teacher can mark attendance for this class');
    }
  }

  /**
   * Mark attendance for a class
   * Only assigned teachers can mark attendance for their classes
   * Prevents duplicate attendance marking for the same day
   */
  async markAttendance(data: MarkAttendanceInput) {
    this.requireTeacher();

    if (!this.user.schoolId) {
      throw new Error('Teacher is not assigned to a school');
    }

    // Get teacher record
    const teacher = await prisma.teacher.findUnique({
      where: { userId: this.user.id },
    });

    if (!teacher) {
      throw new Error('Teacher record not found');
    }

    // Verify teacher is the class teacher for the class
    await this.requireClassTeacherAssignment(teacher.id, data.classId);

    // Verify class exists
    const classRecord = await prisma.class.findUnique({
      where: { id: data.classId },
    });

    if (!classRecord) {
      throw new Error('Class not found');
    }

    // Validate attendance records
    if (!data.records || data.records.length === 0) {
      throw new Error('Attendance records cannot be empty');
    }

    // Get student IDs from records
    const studentIds = data.records.map(record => record.studentId);

    // Verify all students exist and are in the class
    const students = await prisma.student.findMany({
      where: {
        id: { in: studentIds },
        classId: data.classId,
        deletedAt: null,
      },
      select: {
        id: true,
      },
    });

    if (students.length !== studentIds.length) {
      const foundIds = students.map(s => s.id);
      const invalidIds = studentIds.filter(id => !foundIds.includes(id));
      throw new Error(`Invalid students for this class: ${invalidIds.join(', ')}`);
    }

    // Normalize date to start of day
    const attendanceDate = new Date(data.date);
    attendanceDate.setHours(0, 0, 0, 0);

    // Check for existing attendance records for this date/class
    const existingRecords = await prisma.attendance.findMany({
      where: {
        classId: data.classId,
        date: attendanceDate,
        studentId: { in: studentIds },
        deletedAt: null,
      },
    });

    if (existingRecords.length > 0) {
      const existingStudentIds = existingRecords.map(r => r.studentId);
      throw new Error(`Attendance already marked for students: ${existingStudentIds.join(', ')}`);
    }

    // Use transaction to create attendance records
    const result = await prisma.$transaction(async (tx) => {
      const attendanceRecords = data.records.map(record => ({
        studentId: record.studentId,
        classId: data.classId,
        teacherId: teacher.id,
        schoolId: this.user.schoolId,
        date: attendanceDate,
        status: record.status,
      }));

      const createdRecords = await tx.attendance.createMany({
        data: attendanceRecords,
      });

      // Return the created records with relations
      return tx.attendance.findMany({
        where: {
          classId: data.classId,
          date: attendanceDate,
          deletedAt: null,
        },
        select: {
          id: true,
          studentId: true,
          classId: true,
          teacherId: true,
          schoolId: true,
          date: true,
          status: true,
          createdAt: true,
          updatedAt: true,
          student: {
            select: studentAttendanceSelect,
          },
          teacher: {
            select: teacherAttendanceSelect,
          },
          class: {
            select: classAttendanceSelect,
          },
        },
      });
    });

    return result;
  }

  /**
   * Get attendance records for a class on a specific date
   */
  async getAttendanceForClassAndDate(classId: string, date: Date) {
    this.requireTeacher();

    // Get teacher record
    const teacher = await prisma.teacher.findFirst({
      where: { userId: this.user.id, deletedAt: null },
    });

    if (!teacher) {
      throw new Error('Teacher record not found');
    }

    // Verify teacher is assigned to the class
    await this.requireClassAssignment(teacher.id, classId);

    // Calculate startOfDay (00:00:00) and endOfDay (next day 00:00:00)
    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);

    const endOfDay = new Date(startOfDay);
    endOfDay.setDate(endOfDay.getDate() + 1);

    const records = await prisma.attendance.findMany({
      where: {
        classId,
        date: {
          gte: startOfDay,
          lt: endOfDay,
        },
        deletedAt: null,
      },
      select: {
        id: true,
        studentId: true,
        classId: true,
        teacherId: true,
        schoolId: true,
        date: true,
        status: true,
        createdAt: true,
        updatedAt: true,
        student: {
          select: studentAttendanceSelect,
        },
        teacher: {
          select: teacherAttendanceSelect,
        },
        class: {
          select: classAttendanceSelect,
        },
      },
      orderBy: {
        student: {
          user: {
            name: 'asc',
          },
        },
      },
    });

    return records;
  }

  /**
   * Mark attendance for a single student
   */
  async markSingleAttendance(data: MarkSingleAttendanceInput) {
    this.requireTeacher();

    // Get teacher record
    const teacher = await prisma.teacher.findFirst({
      where: { userId: this.user.id, deletedAt: null },
    });

    if (!teacher) {
      throw new Error('Teacher record not found');
    }

    if (!teacher.schoolId) {
      throw new Error('Teacher is not assigned to a school');
    }

    // Verify teacher is the class teacher for this class
    await this.requireClassTeacherAssignment(teacher.id, data.classId);

    // Verify class exists
    const classRecord = await prisma.class.findUnique({
      where: { id: data.classId },
    });

    if (!classRecord) {
      throw new Error('Class not found');
    }

    // Verify student exists and is in the class
    const student = await prisma.student.findFirst({
      where: {
        id: data.studentId,
        classId: data.classId,
        deletedAt: null,
      },
      select: {
        id: true,
      },
    });

    if (!student) {
      throw new Error('Student not found in this class');
    }

    // Normalize date to start of day
    const attendanceDate = new Date();
    attendanceDate.setHours(0, 0, 0, 0);

    // Check for existing attendance record for this date/student/class
    const existingRecord = await prisma.attendance.findFirst({
      where: {
        studentId: data.studentId,
        classId: data.classId,
        date: attendanceDate,
        deletedAt: null,
      },
    });

    if (existingRecord) {
      throw new Error('Attendance already marked for this student today');
    }

    // Create attendance record
    const attendanceRecord = await prisma.attendance.create({
      data: {
        studentId: data.studentId,
        classId: data.classId,
        teacherId: teacher.id,
        schoolId: this.user.schoolId || '',
        date: attendanceDate,
        status: data.status,
      },
      select: {
        id: true,
        studentId: true,
        classId: true,
        teacherId: true,
        schoolId: true,
        date: true,
        status: true,
        createdAt: true,
        updatedAt: true,
        student: {
          select: studentAttendanceSelect,
        },
        teacher: {
          select: teacherAttendanceSelect,
        },
        class: {
          select: classAttendanceSelect,
        },
      },
    });

    return attendanceRecord;
  }

  /**
   * Update attendance record (only by the teacher who marked it)
   */
  async updateAttendance(attendanceId: string, status: 'PRESENT' | 'ABSENT' | 'LATE') {
    this.requireTeacher();

    // Get teacher record
    const teacher = await prisma.teacher.findFirst({
      where: { userId: this.user.id, deletedAt: null },
    });

    if (!teacher) {
      throw new Error('Teacher record not found');
    }


    const attendance = await prisma.attendance.findFirst({
      where: { id: attendanceId, deletedAt: null },
      include: {
        class: true,
      },
    });

    if (!attendance) {
      throw new Error('Attendance record not found');
    }

    if (attendance.teacherId !== teacher.id) {
      throw new Error('Unauthorized: Can only update attendance marked by yourself');
    }

    // Update the record
    const updatedRecord = await prisma.attendance.update({
      where: { id: attendanceId },
      data: { status },
      select: {
        id: true,
        studentId: true,
        classId: true,
        teacherId: true,
        schoolId: true,
        date: true,
        status: true,
        createdAt: true,
        updatedAt: true,
        student: {
          select: studentAttendanceSelect,
        },
        teacher: {
          select: teacherAttendanceSelect,
        },
        class: {
          select: classAttendanceSelect,
        },
      },
    });

    return updatedRecord;
  }
}

import { prisma } from '@/lib/prisma';
import { isAdmin } from '@/lib/permissions';
import type { AuthenticatedUser } from '@/types/authenticated-user';

export interface CreateStudentInput {
  userId?: string;
  firstName: string;
  lastName: string;
  admissionNumber: string;
  email?: string;
  schoolId: string;
  grade?: string;
  classId?: string;
}

export interface UpdateStudentInput {
  firstName?: string;
  lastName?: string;
  admissionNumber?: string;
  email?: string;
  grade?: string;
  classId?: string;
  class?: string;
}

export class StudentService {
  private user: AuthenticatedUser;

  constructor(user: AuthenticatedUser) {
    this.user = user;
  }

  /**
   * Check if the current user has permission to perform the action
   */
  private requireAdmin(): void {
    if (!isAdmin(this.user.role)) {
      throw new Error('Unauthorized: Only administrators can perform this action');
    }
  }

  /**
   * Create a new student record
   * Only ADMIN users can create students
   */
  async createStudent(data: CreateStudentInput) {
    this.requireAdmin();

    // Only enforce one-to-one user linkage when a userId is provided.
    const existingStudent = data.userId
      ? await prisma.student.findUnique({
          where: { userId: data.userId },
          select: { id: true },
        })
      : null;

    if (existingStudent) {
      throw new Error('Student record already exists for this user');
    }

    // Check for duplicate admission number within the same school
    const duplicateAdmission = await prisma.student.findFirst({
      where: {
        admissionNumber: data.admissionNumber,
        schoolId: data.schoolId,
        deletedAt: null,
      },
    });

    if (duplicateAdmission) {
      throw new Error('Admission number already exists for this school');
    }

    const student = await prisma.$transaction(async (tx) => {
      let resolvedUserId = data.userId;

      if (!resolvedUserId) {
        const emailToUse = data.email || `student-${data.admissionNumber}-${Date.now()}@local.school`;
        const createdUser = await tx.user.create({
          data: {
            name: `${data.firstName} ${data.lastName}`.trim(),
            email: emailToUse,
            role: 'STUDENT',
          },
        });
        resolvedUserId = createdUser.id;
      }

      return tx.student.create({
        data: {
          userId: resolvedUserId,
          firstName: data.firstName,
          lastName: data.lastName,
          admissionNumber: data.admissionNumber,
          schoolId: data.schoolId,
          grade: data.grade,
          classId: data.classId,
        },
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
          school: true,
          class: true,
        },
      });
    });

    return student;
  }

  /**
   * Get a student by ID
   * All authenticated users can view student details
   */
  async getStudentById(id: string) {
    const student = await prisma.student.findFirst({
      where: { id, deletedAt: null },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        class: {
          select: {
            id: true,
            name: true,
            grade: true,
          },
        },
        attendances: true,
        grades: true,
      },
    });

    if (!student) {
      throw new Error('Student not found');
    }

    return student;
  }

  /**
   * Get all students
   * All authenticated users can view students list
   */
  async getAllStudents(options?: {
    grade?: string;
    classId?: string;
    class?: string;
    skip?: number;
    take?: number;
  }) {
    const resolvedClassId = options?.classId || options?.class;
    const where = {
      deletedAt: null,
      ...(options?.grade && { grade: options.grade }),
      ...(resolvedClassId && { classId: resolvedClassId }),
    };

    const [students, count] = await prisma.$transaction([
      prisma.student.findMany({
        where,
        skip: options?.skip,
        take: options?.take,
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.student.count({ where }),
    ]);

    return { students, count };
  }

  /**
   * Get students that belong to a specific class
   */
  async getStudentsByClass(classId: string, options?: { skip?: number; take?: number }) {
    const where = { classId, deletedAt: null };

    const [students, count] = await prisma.$transaction([
      prisma.student.findMany({
        where,
        skip: options?.skip,
        take: options?.take,
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
          class: {
            select: {
              id: true,
              name: true,
              grade: true,
            },
          },
        },
        orderBy: [
          { lastName: 'asc' },
          { firstName: 'asc' },
        ],
      }),
      prisma.student.count({ where }),
    ]);

    return { students, count };
  }

  /**
   * Update a student record
   * Only ADMIN users can update students
   */
  async updateStudent(id: string, data: UpdateStudentInput) {
    this.requireAdmin();

    const student = await prisma.student.findFirst({
      where: {
        id,
        deletedAt: null,
        // School admins can only edit students within their own school
        ...(this.user.schoolId ? { schoolId: this.user.schoolId } : {}),
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });

    if (!student) {
      throw new Error('Student not found');
    }

    const emailToSet = data.email?.trim();

    // Duplicate admission number check within the same school (excluding this student)
    if (data.admissionNumber && data.admissionNumber.trim() !== student.admissionNumber) {
      const duplicateAdmission = await prisma.student.findFirst({
        where: {
          admissionNumber: data.admissionNumber.trim(),
          schoolId: student.schoolId,
          deletedAt: null,
          NOT: { id: student.id },
        },
      });

      if (duplicateAdmission) {
        throw new Error('Admission number already exists for this school');
      }
    }

    // Verify the class belongs to this school (school admins can't move
    // students into another school's class)
    if (data.classId) {
      const classRecord = await prisma.class.findFirst({
        where: { id: data.classId, deletedAt: null },
        select: { schoolId: true },
      });

      if (!classRecord || classRecord.schoolId !== student.schoolId) {
        throw new Error('Class not found in this school');
      }
    }

    // Duplicate email check (User.email is globally unique). Runs even when
    // the student has no linked user yet.
    if (emailToSet && student.user?.email !== emailToSet) {
      const existingUser = await prisma.user.findUnique({
        where: { email: emailToSet },
        select: { id: true },
      });

      if (existingUser && existingUser.id !== student.user?.id) {
        throw new Error('Email is already in use by another account');
      }
    }

    // Keep the linked user's display name in sync with the student's name
    const nameToSet = [data.firstName, data.lastName].filter(Boolean).join(' ').trim();

    const updatedStudent = await prisma.$transaction(async (tx) => {
      if (student.user) {
        await tx.user.update({
          where: { id: student.user.id },
          data: {
            ...(nameToSet && { name: nameToSet }),
            ...(emailToSet && { email: emailToSet }),
          },
        });
      } else if (emailToSet) {
        // No linked user yet — create one so the email can be stored
        const createdUser = await tx.user.create({
          data: {
            name: nameToSet || `${data.firstName ?? student.firstName} ${data.lastName ?? student.lastName}`.trim(),
            email: emailToSet,
            role: 'STUDENT',
          },
        });
        await tx.student.update({
          where: { id: student.id },
          data: { userId: createdUser.id },
        });
      }

      return tx.student.update({
        where: { id: student.id },
        data: {
          firstName: data.firstName,
          lastName: data.lastName,
          admissionNumber: data.admissionNumber?.trim(),
          grade: data.grade,
          classId: data.classId || data.class,
        },
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
          class: {
            select: {
              id: true,
              name: true,
              grade: true,
            },
          },
        },
      });
    });

    return updatedStudent;
  }

  /**
   * Delete a student record
   * Only ADMIN users can delete students
   */
  async deleteStudent(id: string) {
    this.requireAdmin();

    const student = await prisma.student.findFirst({
      where: { id, deletedAt: null },
    });

    if (!student) {
      throw new Error('Student not found');
    }

    await prisma.student.update({
      where: { id },
      data: { deletedAt: new Date() },
    });

    return { success: true, message: 'Student deleted successfully' };
  }

  /**
   * Get student by user ID
   * All authenticated users can view student details by user ID
   */
  async getStudentByUserId(userId: string) {
    const student = await prisma.student.findFirst({
      where: { userId, deletedAt: null },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        attendances: true,
        grades: true,
      },
    });

    if (!student) {
      throw new Error('Student not found');
    }

    return student;
  }

  /**
   * Get student grades
   * All authenticated users can view student grades
   */
  async getStudentGrades(studentId: string) {
    const grades = await prisma.grade.findMany({
      where: { studentId, deletedAt: null },
      include: {
        subject: {
          select: {
            id: true,
            name: true,
            code: true,
          },
        },
        class: {
          select: {
            id: true,
            name: true,
            grade: true,
          },
        },
        term: {
          select: {
            id: true,
            name: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return grades;
  }

  /**
   * Get student attendance
   * All authenticated users can view student attendance
   */
  async getStudentAttendance(studentId: string) {
    const attendances = await prisma.attendance.findMany({
      where: { studentId, deletedAt: null },
      orderBy: { date: 'desc' },
    });

    return attendances;
  }
}

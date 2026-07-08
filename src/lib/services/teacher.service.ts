import { prisma } from '@/lib/prisma';
import { hash } from 'bcryptjs';
import { isAdmin } from '@/lib/permissions';
import type { AuthenticatedUser } from '@/types/authenticated-user';

export interface CreateTeacherInput {
  userId: string;
  schoolId?: string;
  subject?: string;
  type?: 'CLASS_TEACHER' | 'SUBJECT_TEACHER';
}

export interface UpdateTeacherInput {
  schoolId?: string;
  subject?: string;
  isActive?: boolean;
}

export class TeacherService {
  private user: AuthenticatedUser;

  constructor(user: AuthenticatedUser) {
    this.user = user;
  }

  /**
   * Check if the current user has permission to perform administrative actions
   */
  private requireAdmin(): void {
    if (!isAdmin(this.user)) {
      throw new Error('Unauthorized: Only administrators can perform this action');
    }
  }

  /**
   * Create a new teacher record
   * Only ADMIN users can create teachers
   */
  async createTeacher(data: CreateTeacherInput) {
    this.requireAdmin();

    // Check if user already exists as a teacher
    const existingTeacher = await prisma.teacher.findFirst({
      where: { userId: data.userId, deletedAt: null },
    });

    if (existingTeacher) {
      throw new Error('Teacher record already exists for this user');
    }

    // Verify user exists and has TEACHER role
    const user = await prisma.user.findUnique({
      where: { id: data.userId },
    });

    if (!user) {
      throw new Error('User not found');
    }

    if (user.role !== 'TEACHER' && user.role !== 'ADMIN') {
      throw new Error('User must have TEACHER role to be created as teacher');
    }

    // If schoolId is provided, verify school exists
    if (data.schoolId) {
      const school = await prisma.school.findUnique({
        where: { id: data.schoolId },
      });

      if (!school) {
        throw new Error('School not found');
      }
    }

    const teacher = await prisma.teacher.create({
      data: {
        userId: data.userId,
        schoolId: data.schoolId,
        subject: data.subject,
        type: data.type || 'CLASS_TEACHER',
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
      },
    });

    return teacher;
  }

  /**
   * Get a teacher by ID with assigned class/subject records
   */
  async getTeacherById(id: string) {
    const teacher = await prisma.teacher.findFirst({
      where: { id, deletedAt: null },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        school: true,
        classSubjects: {
          include: {
            class: true,
            subject: true,
          },
        },
      },
    });

    if (!teacher) {
      throw new Error('Teacher not found');
    }

    return teacher;
  }

  /**
   * Get all teachers with optional filters
   * ADMIN can see all, others see only active teachers
   */
  async getAllTeachers(options?: {
    schoolId?: string;
    isActive?: boolean;
    skip?: number;
    take?: number;
  }) {
    // Non-admin users can only see active teachers
    const isActiveFilter = isAdmin(this.user)
      ? options?.isActive
      : true;

    const where = {
      deletedAt: null,
      ...(options?.schoolId && { schoolId: options.schoolId }),
      ...(isActiveFilter !== undefined && { isActive: isActiveFilter }),
    };

    const [teachers, count] = await prisma.$transaction([
      prisma.teacher.findMany({
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
          school: true,
          classSubjects: {
            include: {
              class: true,
              subject: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.teacher.count({ where }),
    ]);

    return { teachers, count };
  }

  /**
   * Update a teacher record
   * Only ADMIN can update teachers
   */
  async updateTeacher(id: string, data: UpdateTeacherInput) {
    this.requireAdmin();

    const teacher = await prisma.teacher.findFirst({
      where: { id, deletedAt: null },
    });

    if (!teacher) {
      throw new Error('Teacher not found');
    }

    // If schoolId is provided, verify school exists
    if (data.schoolId) {
      const school = await prisma.school.findUnique({
        where: { id: data.schoolId },
      });

      if (!school) {
        throw new Error('School not found');
      }
    }

    const updatedTeacher = await prisma.teacher.update({
      where: { id },
      data: {
        schoolId: data.schoolId,
        subject: data.subject,
        isActive: data.isActive,
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
        classSubjects: {
          include: {
            class: true,
            subject: true,
          },
        },
      },
    });

    return updatedTeacher;
  }

  /**
   * Deactivate a teacher (soft delete)
   * Only ADMIN can deactivate teachers
   */
  async deactivateTeacher(id: string) {
    this.requireAdmin();

    const teacher = await prisma.teacher.findFirst({
      where: { id, deletedAt: null },
    });

    if (!teacher) {
      throw new Error('Teacher not found');
    }

    const deactivatedTeacher = await prisma.teacher.update({
      where: { id },
      data: { isActive: false },
    });

    return deactivatedTeacher;
  }

  /**
   * Activate a teacher
   * Only ADMIN can activate teachers
   */
  async activateTeacher(id: string) {
    this.requireAdmin();

    const teacher = await prisma.teacher.findFirst({
      where: { id, deletedAt: null },
    });

    if (!teacher) {
      throw new Error('Teacher not found');
    }

    const activatedTeacher = await prisma.teacher.update({
      where: { id },
      data: { isActive: true },
    });

    return activatedTeacher;
  }

  /**
   * Delete a teacher record (soft delete)
   * Only ADMIN can delete teachers
   */
  async deleteTeacher(id: string) {
    this.requireAdmin();

    const teacher = await prisma.teacher.findFirst({
      where: { id, deletedAt: null },
    });

    if (!teacher) {
      throw new Error('Teacher not found');
    }

    await prisma.teacher.update({
      where: { id },
      data: { deletedAt: new Date() },
    });

    return { success: true, message: 'Teacher deleted successfully' };
  }

  /**
   * Get teacher by user ID
   */
  async getTeacherByUserId(userId: string) {
    const teacher = await prisma.teacher.findFirst({
      where: { userId, deletedAt: null },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        school: true,
        classSubjects: {
          include: {
            class: {
              include: {
                school: true,
                _count: {
                  select: {
                    students: true,
                  },
                },
              },
            },
            subject: true,
          },
        },
      },
    });

    if (!teacher) {
      throw new Error("Teacher not found");
    }

    return teacher;
  }

  /**
   * Assign a teacher as CLASS_TEACHER of a class
   * Enforces that a class can only have one CLASS_TEACHER at a time
   * Enforces that a teacher can only be CLASS_TEACHER of one class at a time
   */
  async assignClassTeacher(teacherId: string, classId: string) {
    this.requireAdmin();

    // Verify teacher exists
    const teacher = await prisma.teacher.findFirst({
      where: { id: teacherId, deletedAt: null },
    });

    if (!teacher) {
      throw new Error('Teacher not found');
    }

    // Verify class exists
    const classRecord = await prisma.class.findFirst({
      where: { id: classId, deletedAt: null },
    });

    if (!classRecord) {
      throw new Error('Class not found');
    }

    // Check that the class doesn't already have a CLASS_TEACHER
    const existingClassTeacher = await prisma.teacherClassSubject.findFirst({
      where: {
        classId,
        assignmentType: 'CLASS_TEACHER',
      },
      include: {
        teacher: {
          include: {
            user: {
              select: {
                name: true,
                email: true,
              },
            },
          },
        },
      },
    });

    if (existingClassTeacher) {
      throw new Error(
        `This class already has a class teacher (${existingClassTeacher.teacher.user.name}). Remove that assignment first.`
      );
    }

    // Check that the teacher isn't already CLASS_TEACHER of another class
    const existingTeacherAssignment = await prisma.teacherClassSubject.findFirst({
      where: {
        teacherId,
        assignmentType: 'CLASS_TEACHER',
        classId: { not: classId },
      },
      include: {
        class: true,
      },
    });

    if (existingTeacherAssignment) {
      throw new Error(
        `This teacher is already the class teacher of "${existingTeacherAssignment.class.name}". Remove that assignment first.`
      );
    }

    // Create the CLASS_TEACHER assignment
    const assignment = await prisma.teacherClassSubject.create({
      data: {
        teacherId,
        classId,
        assignmentType: 'CLASS_TEACHER',
        subjectId: null,
      },
      include: {
        class: true,
        teacher: {
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
      },
    });

    return assignment;
  }

  /**
   * Assign a teacher as SUBJECT_TEACHER for a specific subject in a class
   * Prevents duplicate teacherId + classId + subjectId combinations
   */
  async assignSubjectTeacher(teacherId: string, classId: string, subjectId: string) {
    this.requireAdmin();

    // Verify teacher exists
    const teacher = await prisma.teacher.findFirst({
      where: { id: teacherId, deletedAt: null },
    });

    if (!teacher) {
      throw new Error('Teacher not found');
    }

    // Verify class exists
    const classRecord = await prisma.class.findFirst({
      where: { id: classId, deletedAt: null },
    });

    if (!classRecord) {
      throw new Error('Class not found');
    }

    // Verify subject exists
    const subject = await prisma.subject.findFirst({
      where: { id: subjectId, deletedAt: null },
    });

    if (!subject) {
      throw new Error('Subject not found');
    }

    // Check for duplicate assignment (teacher + class + subject combination)
    const existingAssignment = await prisma.teacherClassSubject.findUnique({
      where: {
        teacherId_classId_subjectId: {
          teacherId,
          classId,
          subjectId,
        },
      },
    });

    if (existingAssignment) {
      throw new Error('This teacher is already assigned to teach this subject in this class');
    }

    // Create the SUBJECT_TEACHER assignment
    const assignment = await prisma.teacherClassSubject.create({
      data: {
        teacherId,
        classId,
        subjectId,
        assignmentType: 'SUBJECT_TEACHER',
      },
      include: {
        class: true,
        subject: true,
        teacher: {
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
      },
    });

    return assignment;
  }

  /**
   * Remove a teacher assignment by its ID
   * Hard deletes the TeacherClassSubject record
   */
  async removeAssignment(assignmentId: string) {
    this.requireAdmin();

    // Verify the assignment exists
    const assignment = await prisma.teacherClassSubject.findUnique({
      where: { id: assignmentId },
      include: {
        class: { select: { name: true } },
        subject: { select: { name: true } },
      },
    });

    if (!assignment) {
      throw new Error('Assignment not found');
    }

    await prisma.teacherClassSubject.delete({
      where: { id: assignmentId },
    });

    return {
      success: true,
      message: assignment.subject
        ? `Removed subject teacher assignment for "${assignment.subject.name}" in "${assignment.class.name}"`
        : `Removed class teacher assignment for "${assignment.class.name}"`,
    };
  }

  /**
   * Get all TeacherClassSubject assignments for a teacher
   * Includes class name, subject name, and assignmentType
   */
  async getTeacherAssignments(teacherId: string) {
    const teacher = await prisma.teacher.findFirst({
      where: { id: teacherId, deletedAt: null },
    });

    if (!teacher) {
      throw new Error('Teacher not found');
    }

    const assignments = await prisma.teacherClassSubject.findMany({
      where: { teacherId },
      include: {
        class: {
          select: {
            id: true,
            name: true,
            grade: true,
          },
        },
        subject: {
          select: {
            id: true,
            name: true,
            code: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return assignments;
  }

  /**
   * Check whether a teacher is the class teacher of a specific class
   */
  async isClassTeacherOf(teacherId: string, classId: string): Promise<boolean> {
    const assignment = await prisma.teacherClassSubject.findFirst({
      where: {
        teacherId,
        classId,
        assignmentType: 'CLASS_TEACHER',
      },
      select: { id: true },
    });

    return Boolean(assignment);
  }

  /**
   * Check whether a teacher has any assignment (CLASS_TEACHER or SUBJECT_TEACHER) for a class
   */
  async isAssignedToClass(teacherId: string, classId: string): Promise<boolean> {
    const assignment = await prisma.teacherClassSubject.findFirst({
      where: {
        teacherId,
        classId,
      },
      select: { id: true },
    });

    return Boolean(assignment);
  }

  /**
   * Get the CLASS_TEACHER assignment for a class, including teacher user details
   */
  async getClassTeacher(classId: string) {
    const classRecord = await prisma.class.findFirst({
      where: { id: classId, deletedAt: null },
    });

    if (!classRecord) {
      throw new Error('Class not found');
    }

    const assignment = await prisma.teacherClassSubject.findFirst({
      where: {
        classId,
        assignmentType: 'CLASS_TEACHER',
      },
      include: {
        teacher: {
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
      },
    });

    return assignment;
  }

  /**
   * Get all SUBJECT_TEACHER assignments for a class, including teacher and subject details
   */
  async getSubjectTeachers(classId: string) {
    const classRecord = await prisma.class.findFirst({
      where: { id: classId, deletedAt: null },
    });

    if (!classRecord) {
      throw new Error('Class not found');
    }

    const assignments = await prisma.teacherClassSubject.findMany({
      where: {
        classId,
        assignmentType: 'SUBJECT_TEACHER',
      },
      include: {
        teacher: {
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
        subject: {
          select: {
            id: true,
            name: true,
            code: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return assignments;
  }

  /**
   * Reset teacher password to default (email prefix)
   * Only ADMIN can reset teacher passwords
   */
  async resetTeacherPasswordToDefault(teacherId: string) {
    this.requireAdmin();

    const teacher = await prisma.teacher.findFirst({
      where: { id: teacherId, deletedAt: null },
      select: {
        id: true,
        schoolId: true,
        user: {
          select: {
            id: true,
            email: true,
          },
        },
      },
    });

    if (!teacher) {
      throw new Error('Teacher not found');
    }

    const normalizedEmail = teacher.user.email.trim().toLowerCase();
    const emailPrefix = normalizedEmail.split('@')[0]?.trim();

    if (!emailPrefix) {
      throw new Error('Cannot derive default password from teacher email');
    }

    const hashedPassword = await hash(emailPrefix, 12);

    await prisma.user.update({
      where: { id: teacher.user.id },
      data: { password: hashedPassword },
    });

    return { success: true };
  }
}

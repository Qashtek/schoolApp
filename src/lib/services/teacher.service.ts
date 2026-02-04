
import { prisma } from '@/lib/prisma';
import { hash } from 'bcryptjs';
import { isAdmin } from '@/lib/permissions';
import { Role } from '@/lib/auth';

export interface AuthenticatedUser {
  id: string;
  role: Role;
  email?: string;
}

export interface CreateTeacherInput {
  userId: string;
  schoolId?: string;
  subject?: string;
}

export interface AssignClassesInput {
  teacherId: string;
  classIds: string[];
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
   * Check if the current user has permission to perform the action
   * Golden rule: If role !== ADMIN → throw immediately
   */
  private requireAdmin(): void {
    if (this.user.role !== 'ADMIN' && this.user.role !== 'SUPER_ADMIN') {
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
    const existingTeacher = await prisma.teacher.findUnique({
      where: { userId: data.userId },
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
   * Get a teacher by ID with assigned classes
   */
  async getTeacherById(id: string) {
    const teacher = await prisma.teacher.findUnique({
      where: { id },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        school: true,
        classes: {
          include: {
            class: true,
          },
        },
        grades: true,
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
    const isActiveFilter = this.user.role === 'ADMIN' 
      ? options?.isActive 
      : true;

    const where = {
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
          classes: {
            include: {
              class: true,
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
   * Assign classes to a teacher
   * Replaces existing class assignments
   * Only ADMIN can assign classes
   */
  async assignClassesToTeacher(data: AssignClassesInput) {
    this.requireAdmin();

    // Verify teacher exists
    const teacher = await prisma.teacher.findUnique({
      where: { id: data.teacherId },
    });

    if (!teacher) {
      throw new Error('Teacher not found');
    }

    // Verify all classes exist
    const classes = await prisma.class.findMany({
      where: {
        id: { in: data.classIds },
      },
    });

    if (classes.length !== data.classIds.length) {
      const foundIds = classes.map(c => c.id);
      const missingIds = data.classIds.filter(id => !foundIds.includes(id));
      throw new Error(`Classes not found: ${missingIds.join(', ')}`);
    }

    // Delete existing class assignments
    await prisma.teacherClass.deleteMany({
      where: { teacherId: data.teacherId },
    });

    // Create new class assignments
    await prisma.teacherClass.createMany({
      data: data.classIds.map(classId => ({
        teacherId: data.teacherId,
        classId,
      })),
    });

    // Return updated teacher with classes
    return this.getTeacherById(data.teacherId);
  }

  /**
   * Add a single class to a teacher (doesn't remove existing)
   */
  async addClassToTeacher(teacherId: string, classId: string) {
    this.requireAdmin();

    // Verify teacher exists
    const teacher = await prisma.teacher.findUnique({
      where: { id: teacherId },
    });

    if (!teacher) {
      throw new Error('Teacher not found');
    }

    // Verify class exists
    const classRecord = await prisma.class.findUnique({
      where: { id: classId },
    });

    if (!classRecord) {
      throw new Error('Class not found');
    }

    // Check if assignment already exists
    const existing = await prisma.teacherClass.findUnique({
      where: {
        teacherId_classId: {
          teacherId,
          classId,
        },
      },
    });

    if (existing) {
      throw new Error('Teacher is already assigned to this class');
    }

    // Create assignment
    await prisma.teacherClass.create({
      data: {
        teacherId,
        classId,
      },
    });

    return this.getTeacherById(teacherId);
  }

  /**
   * Remove a class from a teacher
   */
  async removeClassFromTeacher(teacherId: string, classId: string) {
    this.requireAdmin();

    // Verify teacher exists
    const teacher = await prisma.teacher.findUnique({
      where: { id: teacherId },
    });

    if (!teacher) {
      throw new Error('Teacher not found');
    }

    // Delete the assignment
    await prisma.teacherClass.delete({
      where: {
        teacherId_classId: {
          teacherId,
          classId,
        },
      },
    });

    return this.getTeacherById(teacherId);
  }

  /**
   * Update a teacher record
   * Only ADMIN can update teachers
   */
  async updateTeacher(id: string, data: UpdateTeacherInput) {
    this.requireAdmin();

    const teacher = await prisma.teacher.findUnique({
      where: { id },
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
        classes: {
          include: {
            class: true,
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

    const teacher = await prisma.teacher.findUnique({
      where: { id },
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

    const teacher = await prisma.teacher.findUnique({
      where: { id },
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
   * Delete a teacher record (hard delete)
   * Only ADMIN can delete teachers
   */
  async deleteTeacher(id: string) {
    this.requireAdmin();

    const teacher = await prisma.teacher.findUnique({
      where: { id },
    });

    if (!teacher) {
      throw new Error('Teacher not found');
    }

    await prisma.teacher.delete({
      where: { id },
    });

    return { success: true, message: 'Teacher deleted successfully' };
  }

  /**
   * Get teacher by user ID
   */
  async getTeacherByUserId(userId: string) {
    const teacher = await prisma.teacher.findUnique({
      where: { userId },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        school: true,
        classes: {
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
   * Get classes assigned to a teacher
   */
  async getTeacherClasses(teacherId: string) {
    const assignments = await prisma.teacherClass.findMany({
      where: { teacherId },
      include: {
        class: true,
      },
    });

    return assignments.map(a => a.class);
  }
}

import { prisma } from '@/lib/prisma';
import { Role, isAdmin } from '@/lib/permissions';

export interface AuthenticatedUser {
  id: string;
  role: Role;
  email?: string;
}

export interface CreateClassInput {
  name: string;
  section?: string;
  academicYear: string;
  capacity?: number;
  teacherId?: string;
}

export interface UpdateClassInput {
  name?: string;
  section?: string;
  academicYear?: string;
  capacity?: number;
  teacherId?: string;
}

export class ClassService {
  private user: AuthenticatedUser;

  constructor(user: AuthenticatedUser) {
    this.user = user;
  }

  /**
   * Check if the current user has permission to perform administrative actions
   */
  private requireAdmin(): void {
    if (!isAdmin(this.user.role)) {
      throw new Error('Unauthorized: Only administrators can perform this action');
    }
  }

  /**
   * Check if class name already exists within the same academic year
   */
  private async checkDuplicateClassName(
    name: string,
    academicYear: string,
    section?: string,
    excludeId?: string
  ): Promise<void> {
    const existingClass = await prisma.class.findFirst({
      where: {
        name,
        academicYear,
        ...(section && { section }),
        ...(excludeId && { id: { not: excludeId } }),
      },
    });

    if (existingClass) {
      throw new Error('A class with this name already exists in the specified academic year');
    }
  }

  /**
   * Create a new class
   * Only ADMIN users can create classes
   */
  async createClass(data: CreateClassInput) {
    this.requireAdmin();

    // Check for duplicate class name
    await this.checkDuplicateClassName(data.name, data.academicYear, data.section);

    // If teacherId is provided, verify teacher exists
    if (data.teacherId) {
      const teacher = await prisma.teacher.findUnique({
        where: { id: data.teacherId },
      });

      if (!teacher) {
        throw new Error('Teacher not found');
      }
    }

    const classRecord = await prisma.class.create({
      data: {
        name: data.name,
        section: data.section,
        academicYear: data.academicYear,
        capacity: data.capacity,
        teacherId: data.teacherId,
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

    return classRecord;
  }

  /**
   * Get a class by ID
   * All authenticated users can view class details
   */
  async getClassById(id: string) {
    const classRecord = await prisma.class.findUnique({
      where: { id },
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
        _count: {
          select: {
            students: true,
          },
        },
      },
    });

    if (!classRecord) {
      throw new Error('Class not found');
    }

    return classRecord;
  }

  /**
   * Get all classes
   * All authenticated users can view classes list
   */
  async getAllClasses(options?: {
    academicYear?: string;
    teacherId?: string;
    skip?: number;
    take?: number;
  }) {
    const where = {
      ...(options?.academicYear && { academicYear: options.academicYear }),
      ...(options?.teacherId && { teacherId: options.teacherId }),
    };

    const [classes, count] = await prisma.$transaction([
      prisma.class.findMany({
        where,
        skip: options?.skip,
        take: options?.take,
        include: {
          teacher: {
            include: {
              user: {
                select: {
                  name: true,
                },
              },
            },
          },
          _count: {
            select: { students: true },
          },
        },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.class.count({ where }),
    ]);

    return { classes, count };
  }

  /**
   * Update a class
   * Only ADMIN users can update classes
   */
  async updateClass(id: string, data: UpdateClassInput) {
    this.requireAdmin();

    const existingClass = await prisma.class.findUnique({
      where: { id },
    });

    if (!existingClass) {
      throw new Error('Class not found');
    }

    // Check for duplicate name if name is being updated
    if (data.name && data.name !== existingClass.name) {
      await this.checkDuplicateClassName(
        data.name,
        data.academicYear || existingClass.academicYear,
        data.section,
        id
      );
    }

    // If teacherId is provided, verify teacher exists
    if (data.teacherId) {
      const teacher = await prisma.teacher.findUnique({
        where: { id: data.teacherId },
      });

      if (!teacher) {
        throw new Error('Teacher not found');
      }
    }

    const updatedClass = await prisma.class.update({
      where: { id },
      data: {
        name: data.name,
        section: data.section,
        academicYear: data.academicYear,
        capacity: data.capacity,
        teacherId: data.teacherId,
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

    return updatedClass;
  }

  /**
   * Delete a class
   * Only ADMIN users can delete classes
   */
  async deleteClass(id: string) {
    this.requireAdmin();

    const classRecord = await prisma.class.findUnique({
      where: { id },
      include: {
        _count: {
          select: { students: true },
        },
      },
    });

    if (!classRecord) {
      throw new Error('Class not found');
    }

    if (classRecord._count.students > 0) {
      throw new Error('Cannot delete class with enrolled students');
    }

    await prisma.class.delete({
      where: { id },
    });

    return { success: true, message: 'Class deleted successfully' };
  }

  /**
   * Get classes by academic year
   * All authenticated users can view classes
   */
  async getClassesByAcademicYear(academicYear: string) {
    const classes = await prisma.class.findMany({
      where: { academicYear },
      include: {
        teacher: {
          include: {
            user: {
              select: {
                name: true,
              },
            },
          },
        },
        _count: {
          select: { students: true },
        },
      },
      orderBy: { name: 'asc' },
    });

    return classes;
  }

  /**
   * Get classes taught by a specific teacher
   * All authenticated users can view classes
   */
  async getClassesByTeacher(teacherId: string) {
    const classes = await prisma.class.findMany({
      where: { teacherId },
      include: {
        _count: {
          select: { students: true },
        },
      },
      orderBy: { name: 'asc' },
    });

    return classes;
  }
}


import { prisma } from '@/lib/prisma';
import { AuthenticatedUser, isAdmin, isSuperAdmin } from '@/lib/permissions';

export interface CreateClassInput {
  name: string;
  description?: string;
  grade: string;
  schoolId?: string;
}

export interface AssignTeacherInput {
  classId: string;
  teacherId: string;
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
    if (!isAdmin(this.user)) {
      throw new Error('Unauthorized: Only administrators can perform this action');
    }
  }

  private resolveSchoolScope(requestedSchoolId?: string): string | undefined {
    if (isSuperAdmin(this.user)) {
      return requestedSchoolId;
    }

    if (!this.user.schoolId) {
      throw new Error('Unauthorized: Admin is not assigned to a school');
    }

    if (requestedSchoolId && requestedSchoolId !== this.user.schoolId) {
      throw new Error('Unauthorized: Cannot access classes from another school');
    }

    return this.user.schoolId;
  }

  /**
   * Create a new class
   * Only ADMIN users can create classes
   */
  async createClass(data: CreateClassInput) {
    this.requireAdmin();

    const schoolId = this.resolveSchoolScope(data.schoolId);

    if (!schoolId) {
      throw new Error('School is required to create a class');
    }

    const school = await prisma.school.findUnique({
      where: { id: schoolId },
    });

    if (!school) {
      throw new Error('School not found');
    }

    // Prevent duplicate class names within the same school
    const existingClass = await prisma.class.findFirst({
      where: {
        name: data.name,
        schoolId,
        deletedAt: null,
      },
    });

    if (existingClass) {
      throw new Error('A class with this name already exists in the specified school');
    }

    const classRecord = await prisma.class.create({
      data: {
        name: data.name,
        description: data.description,
        grade: data.grade,
        schoolId,
      },
      include: {
        school: true,
        teachers: {
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
        },
        _count: {
          select: {
            students: true,
          },
        },
      },
    });

    return classRecord;
  }

  /**
   * Assign a teacher to a class
   * Only ADMIN users can assign teachers to classes
   */
  async assignTeacher(data: AssignTeacherInput) {
    this.requireAdmin();

    // Verify class exists
    const classExists = await prisma.class.findFirst({
      where: { id: data.classId, deletedAt: null },
    });

    if (!classExists) {
      throw new Error('Class not found');
    }

    if (!isSuperAdmin(this.user)) {
      const schoolId = this.resolveSchoolScope(classExists.schoolId ?? undefined);
      if (!schoolId || classExists.schoolId !== schoolId) {
        throw new Error('Unauthorized: Cannot assign teachers for another school');
      }
    }

    // Verify teacher exists
    const teacherExists = await prisma.teacher.findFirst({
      where: { id: data.teacherId, deletedAt: null },
    });

    if (!teacherExists) {
      throw new Error('Teacher not found');
    }

    if (!isSuperAdmin(this.user) && teacherExists.schoolId !== this.user.schoolId) {
      throw new Error('Unauthorized: Cannot assign teachers from another school');
    }

    if (
      classExists.schoolId &&
      teacherExists.schoolId &&
      classExists.schoolId !== teacherExists.schoolId
    ) {
      throw new Error('Teacher and class must belong to the same school');
    }

    // Check if teacher is already assigned to this class
    const existingAssignment = await prisma.teacherClass.findUnique({
      where: {
        teacherId_classId: {
          teacherId: data.teacherId,
          classId: data.classId,
        },
      },
    });

    if (existingAssignment) {
      throw new Error('Teacher is already assigned to this class');
    }

    const assignment = await prisma.teacherClass.create({
      data: {
        teacherId: data.teacherId,
        classId: data.classId,
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
        class: true,
      },
    });

    return assignment;
  }

  /**
   * Get all classes with assigned teachers and student counts
   * All authenticated users can view classes
   */
  async getAllClasses(options?: {
    schoolId?: string;
    skip?: number;
    take?: number;
  }) {
    const schoolId = this.resolveSchoolScope(options?.schoolId);

    const where = {
      deletedAt: null,
      ...(schoolId && { schoolId }),
    };

    const [classes, count] = await prisma.$transaction([
      prisma.class.findMany({
        where,
        skip: options?.skip,
        take: options?.take,
        select: {
          id: true,
          name: true,
          description: true,
          grade: true,
          createdAt: true,
          school: true,
          teachers: {
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
          },
          _count: {
            select: {
              students: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.class.count({ where }),
    ]);

    return { classes, count };
  }

  /**
   * Get a class by ID with assigned teachers and student count
   * All authenticated users can view class details
   */
  async getClassById(id: string) {
    const classRecord = await prisma.class.findFirst({
      where: { id, deletedAt: null },
      include: {
        school: true,
        teachers: {
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

    if (!isSuperAdmin(this.user)) {
      const schoolId = this.resolveSchoolScope(classRecord.schoolId ?? undefined);
      if (!schoolId || classRecord.schoolId !== schoolId) {
        throw new Error('Unauthorized: Cannot access classes from another school');
      }
    }

    return classRecord;
  }
}

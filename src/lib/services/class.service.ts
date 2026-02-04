import { prisma } from '@/lib/prisma';
import { AuthenticatedUser, isAdmin } from '@/lib/permissions';

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

  /**
   * Create a new class
   * Only ADMIN users can create classes
   */
  async createClass(data: CreateClassInput) {
    this.requireAdmin();

    // If schoolId is provided, verify school exists
    if (data.schoolId) {
      const school = await prisma.school.findUnique({
        where: { id: data.schoolId },
      });

      if (!school) {
        throw new Error('School not found');
      }
    }

    // Prevent duplicate class names within the same school
    const existingClass = await prisma.class.findFirst({
      where: {
        name: data.name,
        schoolId: data.schoolId,
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
        schoolId: data.schoolId,
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
    const classExists = await prisma.class.findUnique({
      where: { id: data.classId },
    });

    if (!classExists) {
      throw new Error('Class not found');
    }

    // Verify teacher exists
    const teacherExists = await prisma.teacher.findUnique({
      where: { id: data.teacherId },
    });

    if (!teacherExists) {
      throw new Error('Teacher not found');
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
    const where = {
      ...(options?.schoolId && { schoolId: options.schoolId }),
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
    const classRecord = await prisma.class.findUnique({
      where: { id },
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

    return classRecord;
  }
}


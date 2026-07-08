import { prisma } from '@/lib/prisma';
import { AuthenticatedUser, isAdmin, isSuperAdmin } from '@/lib/permissions';

export interface CreateClassInput {
  name: string;
  description?: string;
  grade: string;
  schoolId?: string;
}

const classTeacherInclude = {
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
} as const;

const subjectTeacherInclude = {
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
} as const;

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
   * Get all classes with assigned teachers, subject teachers, and student counts
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

    const classIds = classes.map((classRecord) => classRecord.id);
    const [classTeacherAssignments, subjectTeacherAssignments] = classIds.length
      ? await prisma.$transaction([
          prisma.teacherClassSubject.findMany({
            where: {
              classId: { in: classIds },
              assignmentType: 'CLASS_TEACHER',
            },
            include: classTeacherInclude,
          }),
          prisma.teacherClassSubject.findMany({
            where: {
              classId: { in: classIds },
              assignmentType: 'SUBJECT_TEACHER',
            },
            include: subjectTeacherInclude,
            orderBy: { createdAt: 'desc' },
          }),
        ])
      : [[], []];

    const classesWithAssignments = classes.map((classRecord) => {
      const classTeacher = classTeacherAssignments.find(
        (assignment) => assignment.classId === classRecord.id
      ) ?? null;
      const subjectTeachers = subjectTeacherAssignments.filter(
        (assignment) => assignment.classId === classRecord.id
      );

      return {
        ...classRecord,
        classTeacher,
        subjectTeachers,
        teachers: [
          ...(classTeacher ? [classTeacher] : []),
          ...subjectTeachers,
        ],
      };
    });

    return { classes: classesWithAssignments, count };
  }

  /**
   * Get a class by ID with assigned teachers, subject teachers, and student count
   * All authenticated users can view class details
   */
  async getClassById(id: string) {
    const classRecord = await prisma.class.findFirst({
      where: { id, deletedAt: null },
      include: {
        school: true,
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

    const [classTeacher, subjectTeachers] = await prisma.$transaction([
      prisma.teacherClassSubject.findFirst({
        where: {
          classId: id,
          assignmentType: 'CLASS_TEACHER',
        },
        include: classTeacherInclude,
      }),
      prisma.teacherClassSubject.findMany({
        where: {
          classId: id,
          assignmentType: 'SUBJECT_TEACHER',
        },
        include: subjectTeacherInclude,
        orderBy: { createdAt: 'desc' },
      }),
    ]);

    return {
      ...classRecord,
      classTeacher,
      subjectTeachers,
      teachers: [
        ...(classTeacher ? [classTeacher] : []),
        ...subjectTeachers,
      ],
    };
  }
}

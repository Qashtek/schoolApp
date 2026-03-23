import { Role } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export interface AuthenticatedUser {
  id: string;
  role: Role;
  email?: string;
  schoolId?: string;
}

export interface CreateSubjectInput {
  name: string;
  code: string;
  description?: string;
}

export interface UpdateSubjectInput {
  name?: string;
  code?: string;
  description?: string | null;
}

export interface AssignSubjectToClassInput {
  subjectId: string;
  classId: string;
}

export interface AssignSubjectToTeacherInput {
  subjectId: string;
  teacherId: string;
}

export class SubjectService {
  private user: AuthenticatedUser;

  constructor(user: AuthenticatedUser) {
    this.user = user;
  }

  private requireAdmin(): void {
    if (this.user.role !== 'ADMIN') {
      throw new Error('Unauthorized: Only ADMIN users can perform this action');
    }
  }

  private requireSchoolId(): string {
    if (!this.user.schoolId) {
      throw new Error('Unauthorized: Admin is not assigned to a school');
    }

    return this.user.schoolId;
  }

  async createSubject(data: CreateSubjectInput) {
    this.requireAdmin();
    const schoolId = this.requireSchoolId();

    const name = data.name.trim();
    const code = data.code.trim();

    if (!name) {
      throw new Error('Subject name is required');
    }

    if (!code) {
      throw new Error('Subject code is required');
    }

    const existingSubject = await prisma.subject.findUnique({
      where: {
        schoolId_code: {
          schoolId,
          code,
        },
      },
    });

    if (existingSubject) {
      throw new Error('A subject with this code already exists in your school');
    }

    return prisma.subject.create({
      data: {
        name,
        code,
        description: data.description?.trim() || null,
        schoolId,
      },
    });
  }

  async updateSubject(subjectId: string, data: UpdateSubjectInput) {
    this.requireAdmin();
    const schoolId = this.requireSchoolId();

    const subject = await prisma.subject.findFirst({
      where: {
        id: subjectId,
        schoolId,
      },
    });

    if (!subject) {
      throw new Error('Subject not found in your school');
    }

    const nextName = data.name?.trim();
    const nextCode = data.code?.trim();

    if (data.name !== undefined && !nextName) {
      throw new Error('Subject name cannot be empty');
    }

    if (data.code !== undefined && !nextCode) {
      throw new Error('Subject code cannot be empty');
    }

    if (nextCode && nextCode !== subject.code) {
      const duplicate = await prisma.subject.findUnique({
        where: {
          schoolId_code: {
            schoolId,
            code: nextCode,
          },
        },
      });

      if (duplicate) {
        throw new Error('A subject with this code already exists in your school');
      }
    }

    return prisma.subject.update({
      where: { id: subjectId },
      data: {
        ...(nextName !== undefined && { name: nextName }),
        ...(nextCode !== undefined && { code: nextCode }),
        ...(data.description !== undefined && {
          description: data.description?.trim() || null,
        }),
      },
    });
  }

  async deleteSubject(subjectId: string) {
    this.requireAdmin();
    const schoolId = this.requireSchoolId();

    const subject = await prisma.subject.findFirst({
      where: {
        id: subjectId,
        schoolId,
      },
    });

    if (!subject) {
      throw new Error('Subject not found in your school');
    }

    return prisma.subject.delete({
      where: { id: subjectId },
    });
  }

  async getAllSubjects() {
    this.requireAdmin();
    const schoolId = this.requireSchoolId();

    return prisma.subject.findMany({
      where: { schoolId },
      include: {
        _count: {
          select: {
            classes: true,
            teachers: true,
          },
        },
      },
      orderBy: [
        { name: 'asc' },
        { createdAt: 'desc' },
      ],
    });
  }

  async getSubjectWithAssignedClasses(subjectId: string) {
    this.requireAdmin();
    const schoolId = this.requireSchoolId();

    const subject = await prisma.subject.findFirst({
      where: {
        id: subjectId,
        schoolId,
      },
      include: {
        classes: {
          include: {
            class: true,
          },
          orderBy: {
            createdAt: 'desc',
          },
        },
      },
    });

    if (!subject) {
      throw new Error('Subject not found in your school');
    }

    return subject;
  }

  async getSubjectWithAssignedTeachers(subjectId: string) {
    this.requireAdmin();
    const schoolId = this.requireSchoolId();

    const subject = await prisma.subject.findFirst({
      where: {
        id: subjectId,
        schoolId,
      },
      include: {
        teachers: {
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
          orderBy: {
            createdAt: 'desc',
          },
        },
      },
    });

    if (!subject) {
      throw new Error('Subject not found in your school');
    }

    return subject;
  }

  async assignSubjectToClass(data: AssignSubjectToClassInput) {
    this.requireAdmin();
    const schoolId = this.requireSchoolId();

    const [subject, classRecord] = await prisma.$transaction([
      prisma.subject.findFirst({
        where: {
          id: data.subjectId,
          schoolId,
        },
      }),
      prisma.class.findFirst({
        where: {
          id: data.classId,
          schoolId,
        },
      }),
    ]);

    if (!subject) {
      throw new Error('Subject not found in your school');
    }

    if (!classRecord) {
      throw new Error('Class not found in your school');
    }

    const existingAssignment = await prisma.classSubject.findUnique({
      where: {
        classId_subjectId: {
          classId: data.classId,
          subjectId: data.subjectId,
        },
      },
    });

    if (existingAssignment) {
      throw new Error('Subject is already assigned to this class');
    }

    return prisma.classSubject.create({
      data: {
        classId: data.classId,
        subjectId: data.subjectId,
      },
      include: {
        class: true,
        subject: true,
      },
    });
  }

  async assignSubjectToTeacher(data: AssignSubjectToTeacherInput) {
    this.requireAdmin();
    const schoolId = this.requireSchoolId();

    const [subject, teacher] = await prisma.$transaction([
      prisma.subject.findFirst({
        where: {
          id: data.subjectId,
          schoolId,
        },
      }),
      prisma.teacher.findFirst({
        where: {
          id: data.teacherId,
          schoolId,
        },
      }),
    ]);

    if (!subject) {
      throw new Error('Subject not found in your school');
    }

    if (!teacher) {
      throw new Error('Teacher not found in your school');
    }

    const existingAssignment = await prisma.teacherSubject.findUnique({
      where: {
        teacherId_subjectId: {
          teacherId: data.teacherId,
          subjectId: data.subjectId,
        },
      },
    });

    if (existingAssignment) {
      throw new Error('Subject is already assigned to this teacher');
    }

    return prisma.teacherSubject.create({
      data: {
        teacherId: data.teacherId,
        subjectId: data.subjectId,
      },
      include: {
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
  }
}

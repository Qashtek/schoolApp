import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { isAdmin } from '@/lib/permissions';
import type { AuthenticatedUser } from '@/types/authenticated-user';

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


export class SubjectService {
  private user: AuthenticatedUser;

  constructor(user: AuthenticatedUser) {
    this.user = user;
  }

  private requireAdmin(): void {
    if (!isAdmin(this.user)) {
      throw new Error('Unauthorized: Only administrators can perform this action');
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
    const description = data.description?.trim() || null;

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

    if (existingSubject && existingSubject.deletedAt === null) {
      throw new Error('A subject with this code already exists in your school');
    }

    if (existingSubject && existingSubject.deletedAt !== null) {
      return prisma.subject.update({
        where: { id: existingSubject.id },
        data: {
          name,
          description,
          deletedAt: null,
        },
      });
    }

    try {
      return await prisma.subject.create({
        data: {
          name,
          code,
          description,
          schoolId,
        },
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new Error('A subject with this code already exists in your school');
      }
      throw error;
    }
  }

  async updateSubject(subjectId: string, data: UpdateSubjectInput) {
    this.requireAdmin();
    const schoolId = this.requireSchoolId();

    const subject = await prisma.subject.findFirst({
      where: {
        id: subjectId,
        schoolId,
        deletedAt: null,
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
      const duplicate = await prisma.subject.findFirst({
        where: {
          schoolId,
          code: nextCode,
          NOT: {
            id: subjectId,
          },
        },
      });

      if (duplicate) {
        throw new Error('A subject with this code already exists in your school');
      }
    }

    try {
      return await prisma.subject.update({
        where: { id: subjectId },
        data: {
          ...(nextName !== undefined && { name: nextName }),
          ...(nextCode !== undefined && { code: nextCode }),
          ...(data.description !== undefined && {
            description: data.description?.trim() || null,
          }),
        },
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new Error('A subject with this code already exists in your school');
      }
      throw error;
    }
  }

  async deleteSubject(subjectId: string) {
    this.requireAdmin();
    const schoolId = this.requireSchoolId();

    const subject = await prisma.subject.findFirst({
      where: {
        id: subjectId,
        schoolId,
        deletedAt: null,
      },
    });

    if (!subject) {
      throw new Error('Subject not found in your school');
    }

    return prisma.subject.update({
      where: { id: subjectId },
      data: { deletedAt: new Date() },
    });
  }

  async getAllSubjects(options?: { skip?: number; take?: number }) {
    this.requireAdmin();
    const schoolId = this.requireSchoolId();

    const where = { schoolId, deletedAt: null };

    const [subjects, count] = await prisma.$transaction([
      prisma.subject.findMany({
        where,
        skip: options?.skip,
        take: options?.take,
        include: {
          _count: {
            select: {
              classes: true,
              classSubjects: true,
            },
          },
        },
        orderBy: [
          { name: 'asc' },
          { createdAt: 'desc' },
        ],
      }),
      prisma.subject.count({ where }),
    ]);

    return { subjects, count };
  }

  async getSubjectWithAssignedClasses(subjectId: string) {
    this.requireAdmin();
    const schoolId = this.requireSchoolId();

    const subject = await prisma.subject.findFirst({
      where: {
        id: subjectId,
        schoolId,
        deletedAt: null,
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
        deletedAt: null,
      },
      include: {
        classSubjects: {
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
          deletedAt: null,
        },
      }),
      prisma.class.findFirst({
        where: {
          id: data.classId,
          schoolId,
          deletedAt: null,
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
}

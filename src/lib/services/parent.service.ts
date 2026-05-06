import { hash } from 'bcryptjs';
import { Role } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export interface AuthenticatedUser {
  id: string;
  role: Role;
  email?: string;
  schoolId?: string;
}

export interface CreateParentInput {
  name: string;
  email: string;
}

export interface ParentStudentLinkInput {
  parentId: string;
  studentId: string;
}

export class ParentService {
  private user: AuthenticatedUser;

  constructor(user: AuthenticatedUser) {
    this.user = user;
  }

  private requireAdmin(action: string): void {
    if (this.user.role !== 'ADMIN') {
      throw new Error(`Unauthorized: Only ADMIN users can ${action}`);
    }
  }

  private async resolveSchoolId(): Promise<string> {
    if (this.user.schoolId) {
      return this.user.schoolId;
    }

    const currentUser = await prisma.user.findUnique({
      where: { id: this.user.id },
      select: { schoolId: true },
    });

    if (!currentUser?.schoolId) {
      throw new Error('Authenticated user is not assigned to a school');
    }

    return currentUser.schoolId;
  }

  async createParent(data: CreateParentInput) {
    this.requireAdmin('create parents');

    const schoolId = await this.resolveSchoolId();
    const name = data.name.trim();
    const email = data.email.trim().toLowerCase();

    if (!name) {
      throw new Error('Parent name is required');
    }

    if (!email.includes('@')) {
      throw new Error('A valid parent email is required');
    }

    const emailPrefix = email.split('@')[0]?.trim();
    if (!emailPrefix) {
      throw new Error('Cannot derive default password from email');
    }

    const existingUser = await prisma.user.findUnique({
      where: { email },
      select: { id: true },
    });

    if (existingUser) {
      throw new Error('A user with this email already exists');
    }

    return prisma.$transaction(async (tx) => {
      const hashedPassword = await hash(emailPrefix, 12);

      const createdUser = await tx.user.create({
        data: {
          name,
          email,
          password: hashedPassword,
          role: 'PARENT',
          schoolId,
        },
      });

      return tx.parent.create({
        data: {
          userId: createdUser.id,
          schoolId,
        },
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
              role: true,
              schoolId: true,
            },
          },
          students: {
            include: {
              student: {
                select: {
                  id: true,
                  firstName: true,
                  lastName: true,
                  admissionNumber: true,
                  grade: true,
                },
              },
            },
          },
        },
      });
    });
  }

  async linkParentToStudent(data: ParentStudentLinkInput) {
    this.requireAdmin('link parents to students');

    const schoolId = await this.resolveSchoolId();

    return prisma.$transaction(async (tx) => {
      const parent = await tx.parent.findUnique({
        where: { id: data.parentId },
        select: { id: true, schoolId: true },
      });

      if (!parent || parent.schoolId !== schoolId) {
        throw new Error('Parent not found in your school');
      }

      const student = await tx.student.findUnique({
        where: { id: data.studentId },
        select: { id: true, schoolId: true },
      });

      if (!student || student.schoolId !== schoolId) {
        throw new Error('Student not found in your school');
      }

      const existingLink = await tx.parentStudent.findUnique({
        where: {
          parentId_studentId: {
            parentId: data.parentId,
            studentId: data.studentId,
          },
        },
      });

      if (existingLink) {
        throw new Error('Parent is already linked to this student');
      }

      await tx.parentStudent.create({
        data: {
          parentId: data.parentId,
          studentId: data.studentId,
        },
      });

      return tx.parent.findUnique({
        where: { id: data.parentId },
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
              role: true,
              schoolId: true,
            },
          },
          students: {
            include: {
              student: {
                select: {
                  id: true,
                  firstName: true,
                  lastName: true,
                  admissionNumber: true,
                  grade: true,
                },
              },
            },
          },
        },
      });
    });
  }

  async getParentWithChildren(parentId: string) {
    this.requireAdmin('view parent details');

    const schoolId = await this.resolveSchoolId();

    const parent = await prisma.parent.findUnique({
      where: { id: parentId },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
            schoolId: true,
          },
        },
        students: {
          include: {
            student: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                admissionNumber: true,
                grade: true,
              },
            },
          },
        },
      },
    });

    if (!parent || parent.schoolId !== schoolId) {
      throw new Error('Parent not found in your school');
    }

    return {
      id: parent.id,
      schoolId: parent.schoolId,
      createdAt: parent.createdAt,
      updatedAt: parent.updatedAt,
      user: parent.user,
      students: parent.students.map((link) => link.student),
    };
  }

  async unlinkParentFromStudent(data: ParentStudentLinkInput) {
    this.requireAdmin('unlink parents from students');

    const schoolId = await this.resolveSchoolId();

    return prisma.$transaction(async (tx) => {
      const parent = await tx.parent.findUnique({
        where: { id: data.parentId },
        select: { id: true, schoolId: true },
      });

      if (!parent || parent.schoolId !== schoolId) {
        throw new Error('Parent not found in your school');
      }

      const student = await tx.student.findUnique({
        where: { id: data.studentId },
        select: { id: true, schoolId: true },
      });

      if (!student || student.schoolId !== schoolId) {
        throw new Error('Student not found in your school');
      }

      const existingLink = await tx.parentStudent.findUnique({
        where: {
          parentId_studentId: {
            parentId: data.parentId,
            studentId: data.studentId,
          },
        },
      });

      if (!existingLink) {
        throw new Error('Parent is not linked to this student');
      }

      await tx.parentStudent.delete({
        where: {
          parentId_studentId: {
            parentId: data.parentId,
            studentId: data.studentId,
          },
        },
      });

      return { success: true, message: 'Parent unlinked from student successfully' };
    });
  }

  async resetParentPasswordToDefault(parentId: string) {
    this.requireAdmin('reset parent passwords');

    const schoolId = await this.resolveSchoolId();

    const parent = await prisma.parent.findUnique({
      where: { id: parentId },
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

    if (!parent || parent.schoolId !== schoolId) {
      throw new Error('Parent not found in your school');
    }

    const normalizedEmail = parent.user.email.trim().toLowerCase();
    const emailPrefix = normalizedEmail.split('@')[0]?.trim();

    if (!emailPrefix) {
      throw new Error('Cannot derive default password from parent email');
    }

    const hashedPassword = await hash(emailPrefix, 12);

    await prisma.user.update({
      where: { id: parent.user.id },
      data: { password: hashedPassword },
    });

    return { success: true };
  }
}

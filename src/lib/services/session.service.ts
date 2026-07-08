import { prisma } from '@/lib/prisma';
import { isAdmin } from '@/lib/permissions';
import type { AuthenticatedUser } from '@/types/authenticated-user';

export interface CreateSessionInput {
  name: string;
}

export interface CreateTermInput {
  name: string;
  sessionId: string;
  startDate: Date | string;
  endDate: Date | string;
}

export class SessionService {
  private user: AuthenticatedUser;

  constructor(user: AuthenticatedUser) {
    this.user = user;
  }

  private requireAdmin(): void {
    if (!isAdmin(this.user)) {
      throw new Error('Unauthorized: Only administrators can create or modify sessions and terms');
    }
  }

  private requireSchoolId(): string {
    if (!this.user.schoolId) {
      throw new Error('Unauthorized: User is not assigned to a school');
    }

    return this.user.schoolId;
  }

  private parseDate(value: Date | string, fieldName: 'startDate' | 'endDate'): Date {
    const dateValue = value instanceof Date ? value : new Date(value);

    if (Number.isNaN(dateValue.getTime())) {
      throw new Error(`Invalid ${fieldName}`);
    }

    return dateValue;
  }

  async createSession(data: CreateSessionInput) {
    this.requireAdmin();
    const schoolId = this.requireSchoolId();

    const name = data.name?.trim();

    if (!name) {
      throw new Error('Session name is required');
    }

    const duplicate = await prisma.academicSession.findFirst({
      where: {
        schoolId,
        name,
        deletedAt: null,
      },
    });

    if (duplicate) {
      throw new Error('An academic session with this name already exists in your school');
    }

    return prisma.academicSession.create({
      data: {
        name,
        schoolId,
      },
    });
  }

  async setActiveSession(sessionId: string) {
    this.requireAdmin();
    const schoolId = this.requireSchoolId();

    if (!sessionId?.trim()) {
      throw new Error('Session ID is required');
    }

    const session = await prisma.academicSession.findFirst({
      where: {
        id: sessionId,
        schoolId,
      },
    });

    if (!session) {
      throw new Error('Academic session not found in your school');
    }

    const [, activatedSession] = await prisma.$transaction([
      prisma.academicSession.updateMany({
        where: { schoolId, deletedAt: null },
        data: { isActive: false },
      }),
      prisma.academicSession.update({
        where: { id: session.id },
        data: { isActive: true },
        include: {
          terms: {
            orderBy: { startDate: 'asc' },
          },
        },
      }),
    ]);

    return activatedSession;
  }

  async createTerm(data: CreateTermInput) {
    this.requireAdmin();
    const schoolId = this.requireSchoolId();

    const name = data.name?.trim();
    const sessionId = data.sessionId?.trim();

    if (!name) {
      throw new Error('Term name is required');
    }

    if (!sessionId) {
      throw new Error('Session ID is required');
    }

    const startDate = this.parseDate(data.startDate, 'startDate');
    const endDate = this.parseDate(data.endDate, 'endDate');

    if (endDate < startDate) {
      throw new Error('Term endDate must be on or after startDate');
    }

    const session = await prisma.academicSession.findFirst({
      where: {
        id: sessionId,
        schoolId,
        deletedAt: null,
      },
    });

    if (!session) {
      throw new Error('Academic session not found in your school');
    }

    const duplicate = await prisma.term.findFirst({
      where: {
        sessionId,
        name,
        deletedAt: null,
      },
    });

    if (duplicate) {
      throw new Error('A term with this name already exists in this academic session');
    }

    return prisma.term.create({
      data: {
        name,
        sessionId,
        startDate,
        endDate,
      },
    });
  }

  async setActiveTerm(termId: string) {
    this.requireAdmin();
    const schoolId = this.requireSchoolId();

    if (!termId?.trim()) {
      throw new Error('Term ID is required');
    }

    const term = await prisma.term.findFirst({
      where: {
        id: termId,
        session: {
          is: {
            schoolId,
          },
        },
        deletedAt: null,
      },
    });

    if (!term) {
      throw new Error('Term not found in your school');
    }

    const [, activatedTerm] = await prisma.$transaction([
      prisma.term.updateMany({
        where: {
          sessionId: term.sessionId,
          deletedAt: null,
        },
        data: {
          isActive: false,
        },
      }),
      prisma.term.update({
        where: {
          id: term.id,
        },
        data: {
          isActive: true,
        },
      }),
    ]);

    return activatedTerm;
  }

  async getActiveSession() {
    const schoolId = this.requireSchoolId();

    return prisma.academicSession.findFirst({
      where: {
        schoolId,
        isActive: true,
        deletedAt: null,
      },
      include: {
        terms: {
          orderBy: { startDate: 'asc' },
        },
      },
      orderBy: {
        updatedAt: 'desc',
      },
    });
  }

  async getAllSessions() {
    const schoolId = this.requireSchoolId();

    return prisma.academicSession.findMany({
      where: { schoolId, deletedAt: null },
      include: {
        terms: {
          orderBy: [{ isActive: 'desc' }, { startDate: 'asc' }],
        },
      },
      orderBy: [{ isActive: 'desc' }, { createdAt: 'desc' }],
    });
  }

  async getTermsForSession(sessionId: string) {
    this.requireAdmin();
    const schoolId = this.requireSchoolId();

    if (!sessionId?.trim()) {
      throw new Error('Session ID is required');
    }

    const session = await prisma.academicSession.findFirst({
      where: {
        id: sessionId,
        schoolId,
        deletedAt: null,
      },
      select: { id: true },
    });

    if (!session) {
      throw new Error('Academic session not found in your school');
    }

    return prisma.term.findMany({
      where: {
        sessionId: session.id,
        deletedAt: null,
      },
      orderBy: [{ isActive: 'desc' }, { startDate: 'asc' }],
    });
  }

  async deleteSession(sessionId: string) {
    this.requireAdmin();
    const schoolId = this.requireSchoolId();

    if (!sessionId?.trim()) {
      throw new Error('Session ID is required');
    }

    const session = await prisma.academicSession.findFirst({
      where: {
        id: sessionId,
        schoolId,
        deletedAt: null,
      },
      select: {
        id: true,
      },
    });

    if (!session) {
      throw new Error('Academic session not found in your school');
    }

    return prisma.$transaction(async (tx) => {
      await tx.term.updateMany({
        where: {
          sessionId: session.id,
        },
        data: { deletedAt: new Date() },
      });

      return tx.academicSession.update({
        where: {
          id: session.id,
        },
        data: { deletedAt: new Date() },
      });
    });
  }

  async deleteTerm(sessionId: string, termId: string) {
    this.requireAdmin();
    const schoolId = this.requireSchoolId();

    if (!sessionId?.trim()) {
      throw new Error('Session ID is required');
    }

    if (!termId?.trim()) {
      throw new Error('Term ID is required');
    }

    const term = await prisma.term.findFirst({
      where: {
        id: termId,
        sessionId,
        session: {
          is: {
            schoolId,
          },
        },
        deletedAt: null,
      },
      select: {
        id: true,
      },
    });

    if (!term) {
      throw new Error('Term not found in your school');
    }

    return prisma.term.update({
      where: {
        id: term.id,
      },
      data: { deletedAt: new Date() },
    });
  }
}

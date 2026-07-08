import { hash } from 'bcryptjs';
import { prisma } from '@/lib/prisma';
import { isSuperAdmin } from '@/lib/permissions';
import type { AuthenticatedUser } from '@/types/authenticated-user';

export interface CreateSchoolInput {
  name: string;
  address?: string;
}

export interface CreateAdminInput {
  name: string;
  email: string;
  password: string;
  schoolId: string;
}

export class SuperAdminService {
  private user: AuthenticatedUser;

  constructor(user: AuthenticatedUser) {
    this.user = user;
  }

  private requireSuperAdmin(): void {
    if (!isSuperAdmin(this.user)) {
      throw new Error('Unauthorized: Only SUPER_ADMIN users can perform this action');
    }
  }

  async getAllSchools() {
    this.requireSuperAdmin();

    return prisma.school.findMany({
      include: {
        _count: {
          select: {
            users: true,
            teachers: true,
            students: true,
            classes: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });
  }

  async createSchool(data: CreateSchoolInput) {
    this.requireSuperAdmin();

    const name = data.name.trim();
    const address = data.address?.trim();

    if (!name) {
      throw new Error('School name is required');
    }

    const existingSchool = await prisma.school.findFirst({
      where: {
        name,
      },
      select: { id: true },
    });

    if (existingSchool) {
      throw new Error('A school with this name already exists');
    }

    return prisma.school.create({
      data: {
        name,
        address: address || null,
      },
    });
  }

  async getAllAdmins() {
    this.requireSuperAdmin();

    return prisma.user.findMany({
      where: {
        role: 'ADMIN',
      },
      select: {
        id: true,
        name: true,
        email: true,
        schoolId: true,
        createdAt: true,
        school: {
          select: {
            id: true,
            name: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });
  }

  async createAdmin(data: CreateAdminInput) {
    this.requireSuperAdmin();

    const name = data.name.trim();
    const email = data.email.trim().toLowerCase();
    const password = data.password;
    const schoolId = data.schoolId.trim();

    if (!name) {
      throw new Error('Admin name is required');
    }

    if (!email) {
      throw new Error('Admin email is required');
    }

    if (!password || password.length < 6) {
      throw new Error('Password must be at least 6 characters');
    }

    if (!schoolId) {
      throw new Error('School is required');
    }

    const school = await prisma.school.findUnique({
      where: { id: schoolId },
      select: { id: true },
    });

    if (!school) {
      throw new Error('Selected school was not found');
    }

    const existingUser = await prisma.user.findUnique({
      where: { email },
      select: { id: true },
    });

    if (existingUser) {
      throw new Error('A user with this email already exists');
    }

    const hashedPassword = await hash(password, 12);

    return prisma.user.create({
      data: {
        name,
        email,
        password: hashedPassword,
        role: 'ADMIN',
        schoolId,
      },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        schoolId: true,
        createdAt: true,
      },
    });
  }
}

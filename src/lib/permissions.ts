import { User } from '@prisma/client';
import { Role } from '@/lib/auth';

export type AuthenticatedUser = {
  id: string;
  email: string;
  name?: string | null;
  role: Role;
};

export function hasPermission(user: AuthenticatedUser, permission: string): boolean {
  const rolePermissions: Record<string, string[]> = {
    ADMIN: ['*'],
    TEACHER: ['attendance:mark', 'attendance:view', 'grades:create', 'grades:view'],
    STUDENT: ['attendance:view', 'grades:view'],
    PARENT: ['attendance:view', 'grades:view'],
  };

  const permissions = rolePermissions[user.role] || [];
  return permissions.includes('*') || permissions.includes(permission);
}

export function isTeacher(user: AuthenticatedUser): boolean {
  return user.role === 'TEACHER';
}

export function isAdmin(user: AuthenticatedUser): boolean {
  return user.role === 'ADMIN';
}

export function isStudent(user: AuthenticatedUser): boolean {
  return user.role === 'STUDENT';
}

export function isParent(user: AuthenticatedUser): boolean {
  return user.role === 'PARENT';
}

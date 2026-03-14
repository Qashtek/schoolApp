import type { Role } from '@/lib/auth';
export type { Role } from '@/lib/auth';

export type AuthenticatedUser = {
  id: string;
  email: string;
  name?: string | null;
  role: Role;
  schoolId?: string;
};

type UserOrRole = AuthenticatedUser | Role;

function resolveRole(userOrRole: UserOrRole): Role {
  return typeof userOrRole === 'string' ? userOrRole : userOrRole.role;
}

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

export function isTeacher(userOrRole: UserOrRole): boolean {
  return resolveRole(userOrRole) === 'TEACHER';
}

export function isAdmin(userOrRole: UserOrRole): boolean {
  return resolveRole(userOrRole) === 'ADMIN';
}

export function isStudent(userOrRole: UserOrRole): boolean {
  return resolveRole(userOrRole) === 'STUDENT';
}

export function isParent(userOrRole: UserOrRole): boolean {
  return resolveRole(userOrRole) === 'PARENT';
}

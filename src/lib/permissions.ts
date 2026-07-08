export type { AuthenticatedUser, Role } from '@/types/authenticated-user';
import type { AuthenticatedUser, Role } from '@/types/authenticated-user';

type UserOrRole = AuthenticatedUser | Role;

function resolveRole(userOrRole: UserOrRole): Role {
  return typeof userOrRole === 'string' ? userOrRole : userOrRole.role;
}

export function hasPermission(user: AuthenticatedUser, permission: string): boolean {
  const rolePermissions: Record<string, string[]> = {
    SUPER_ADMIN: ['*'],
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

export function isSuperAdmin(userOrRole: UserOrRole): boolean {
  return resolveRole(userOrRole) === 'SUPER_ADMIN';
}

export function isAdmin(userOrRole: UserOrRole): boolean {
  const role = resolveRole(userOrRole);
  return role === 'ADMIN' || role === 'SUPER_ADMIN';
}

export function isStudent(userOrRole: UserOrRole): boolean {
  return resolveRole(userOrRole) === 'STUDENT';
}

export function isParent(userOrRole: UserOrRole): boolean {
  return resolveRole(userOrRole) === 'PARENT';
}

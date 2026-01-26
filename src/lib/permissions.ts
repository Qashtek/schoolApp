export type Role = 'ADMIN' | 'TEACHER' | 'STUDENT' | 'PARENT';

export function isAdmin(role: Role): boolean {
  return role === 'ADMIN';
}

export function isTeacher(role: Role): boolean {
  return role === 'TEACHER';
}

export function isStudent(role: Role): boolean {
  return role === 'STUDENT';
}

export function isParent(role: Role): boolean {
  return role === 'PARENT';
}

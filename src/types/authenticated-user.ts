export type Role = 'SUPER_ADMIN' | 'ADMIN' | 'TEACHER' | 'STUDENT' | 'PARENT';

export interface AuthenticatedUser {
  id: string;
  email?: string;
  role: Role;
  schoolId?: string;
}

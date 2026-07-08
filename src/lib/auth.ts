import { NextAuthOptions } from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';
import { compare } from 'bcryptjs';
import { prisma } from '@/lib/prisma';

export type Role = 'ADMIN' | 'SUPER_ADMIN' | 'TEACHER' | 'STUDENT' | 'PARENT';
const VALID_ROLES: Role[] = ['ADMIN', 'SUPER_ADMIN', 'TEACHER', 'STUDENT', 'PARENT'];

function normalizeRole(value: unknown): Role | null {
  const normalized = String(value ?? '').trim().toUpperCase();
  if (VALID_ROLES.includes(normalized as Role)) {
    return normalized as Role;
  }
  return null;
}

// Extend the default session user type
declare module 'next-auth' {
  interface Session {
    token: {
      sub: string;
      role: Role;
      email?: string;
      schoolId?: string;
    };
    user: {
      id: string;
      email: string;
      name: string;
      role: Role;
      schoolId?: string;
    };
  }

  interface User {
    role: Role;
    schoolId?: string;
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    id: string;
    role: Role;
    schoolId?: string;
  }
}

export const authOptions: NextAuthOptions = {
  session: {
    strategy: 'jwt',
  },
  pages: {
    signIn: '/login',
  },
  providers: [
    CredentialsProvider({
      name: 'Credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          return null;
        }

        // For all users, verify against database
        const user = await prisma.user.findUnique({
          where: { email: credentials.email },
          include: {
            teacher: { select: { schoolId: true } },
            student: { select: { schoolId: true } },
            parent: {
              select: {
                students: {
                  select: {
                    student: {
                      select: {
                        schoolId: true,
                      },
                    },
                  },
                  take: 1,
                },
              },
            },
          },
        });

        if (!user) {
          return null;
        }

        if (!user.password) {
          return null;
        }

        let isValidPassword = false;

        try {
          isValidPassword = await compare(credentials.password, user.password);
        } catch {
          isValidPassword = false;
        }

        if (!isValidPassword) {
          return null;
        }

        const normalizedRole = normalizeRole(user.role);
        if (!normalizedRole) {
          return null;
        }

        let teacherSchoolId = user.teacher?.schoolId ?? undefined;
        if (normalizedRole === 'TEACHER' && !user.teacher) {
          const teacher = await prisma.teacher.create({
            data: {
              userId: user.id,
              schoolId: user.schoolId ?? undefined,
            },
            select: { schoolId: true },
          });
          teacherSchoolId = teacher.schoolId ?? undefined;
        }

        const schoolId =
          user.schoolId ??
          teacherSchoolId ??
          user.student?.schoolId ??
          user.parent?.students[0]?.student?.schoolId;

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          role: normalizedRole,
          schoolId,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.role = normalizeRole(user.role) ?? token.role;
        token.schoolId = user.schoolId;
      }
      return token;
    },
    async session({ session, token }) {
      const normalizedRole = normalizeRole(token.role);
      if (!normalizedRole) return session;

      if (session.user) {
        session.user.id = token.id as string;
        session.user.role = normalizedRole;
        session.user.schoolId = token.schoolId;
      }
      session.token = {
        sub: token.sub as string,
        role: normalizedRole,
        email: token.email,
        schoolId: token.schoolId,
      };
      return session;
    },
  },
};

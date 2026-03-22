import { NextAuthOptions } from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';
import { compare } from 'bcryptjs';
import { prisma } from '@/lib/prisma';

export type Role = 'ADMIN' | 'SUPER_ADMIN' | 'TEACHER' | 'STUDENT' | 'PARENT';
const DEMO_ADMIN_EMAIL = 'admin@school.edu';
const DEMO_ADMIN_PASSWORD = 'admin123';
const DEMO_SCHOOL_NAME = 'Demo School';

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

        // Demo hardcoded admin user for testing
        if (
          credentials.email === DEMO_ADMIN_EMAIL &&
          credentials.password === DEMO_ADMIN_PASSWORD
        ) {
          const existingSchool = await prisma.school.findFirst({
            where: { name: DEMO_SCHOOL_NAME },
          });
          const school =
            existingSchool ??
            (await prisma.school.create({
              data: { name: DEMO_SCHOOL_NAME },
            }));

          const demoAdmin = await prisma.user.upsert({
            where: { email: DEMO_ADMIN_EMAIL },
            update: {
              name: 'Admin User',
              role: 'ADMIN',
              schoolId: school.id,
            },
            create: {
              email: DEMO_ADMIN_EMAIL,
              name: 'Admin User',
              role: 'ADMIN',
              schoolId: school.id,
            },
          });

          return {
            id: demoAdmin.id,
            email: demoAdmin.email,
            name: demoAdmin.name,
            role: demoAdmin.role as Role,
            schoolId: demoAdmin.schoolId ?? school.id,
          };
        }

        // For real implementation, verify against database
        const user = await prisma.user.findUnique({
          where: { email: credentials.email },
          include: {
            teacher: { select: { schoolId: true } },
            student: { select: { schoolId: true } },
            parent: {
              select: {
                students: {
                  select: { schoolId: true },
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

        const isValidPassword = await compare(credentials.password, user.password);

        if (!isValidPassword) {
          return null;
        }

        const schoolId =
          user.schoolId ??
          user.teacher?.schoolId ??
          user.student?.schoolId ??
          user.parent?.students[0]?.schoolId;

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role as Role,
          schoolId,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.role = user.role;
        token.schoolId = user.schoolId;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string;
        session.user.role = token.role as Role;
        session.user.schoolId = token.schoolId;
      }
      session.token = {
        sub: token.sub as string,
        role: token.role as Role,
        email: token.email,
        schoolId: token.schoolId,
      };
      return session;
    },
  },
};

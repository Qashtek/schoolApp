import { NextAuthOptions } from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';
import { PrismaAdapter } from '@next-auth/prisma-adapter';
import { prisma } from '@/lib/prisma';

export type Role = 'ADMIN' | 'SUPER_ADMIN' | 'TEACHER' | 'STUDENT' | 'PARENT';

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
    role: Role;
    schoolId?: string;
  }
}

export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(prisma),
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
          credentials.email === 'admin@school.edu' &&
          credentials.password === 'admin123'
        ) {
          return {
            id: 'demo-admin-id',
            email: 'admin@school.edu',
            name: 'Admin User',
            role: 'ADMIN' as Role,
          };
        }

        // For real implementation, verify against database
        const user = await prisma.user.findUnique({
          where: { email: credentials.email },
        });

        if (!user) {
          return null;
        }

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role as Role,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.role = user.role;
        token.schoolId = user.schoolId;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.sub as string;
        session.user.role = token.role;
        session.user.schoolId = token.schoolId;
      }
      return session;
    },
  },
};


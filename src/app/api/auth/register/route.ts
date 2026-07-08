import { getServerSession } from 'next-auth';
import { NextResponse } from 'next/server';
import { hash } from 'bcryptjs';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { authOptions, Role } from '@/lib/auth';
import { isAdmin } from '@/lib/permissions';

// Input validation schema — accepts all roles including SUPER_ADMIN so the request passes validation
const registerSchema = z.object({
  name: z.string().trim().min(1, 'Name is required'),
  email: z.string().trim().min(1, 'Email is required').email('Invalid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
  role: z.enum(['ADMIN', 'SUPER_ADMIN', 'TEACHER', 'STUDENT', 'PARENT']).default('STUDENT'),
});

/**
 * POST /api/auth/register
 * Create a new user account
 * Only ADMIN and SUPER_ADMIN can create accounts.
 * SUPER_ADMIN can create any role.
 * ADMIN can only create TEACHER, STUDENT, PARENT.
 */
export async function POST(request: Request) {
  try {
    // Require authenticated session
    const session = await getServerSession(authOptions);

    if (!session?.user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const callerRole = session.user.role as Role;

    // Only ADMIN and SUPER_ADMIN can create accounts
    if (!isAdmin(callerRole)) {
      return NextResponse.json(
        { error: 'Forbidden: Only administrators can create accounts' },
        { status: 403 }
      );
    }

    const body = await request.json();

    // Validate input
    const validatedData = registerSchema.parse(body);

    // Authorization check: ADMIN cannot create SUPER_ADMIN or ADMIN accounts
    if (callerRole === 'ADMIN') {
      if (validatedData.role === 'SUPER_ADMIN') {
        return NextResponse.json(
          { error: 'Admins cannot create Super Admin accounts' },
          { status: 403 }
        );
      }
      if (validatedData.role === 'ADMIN') {
        return NextResponse.json(
          { error: 'Admins cannot create other Admin accounts' },
          { status: 403 }
        );
      }
    }

    // Check if user already exists
    const existingUser = await prisma.user.findUnique({
      where: { email: validatedData.email },
    });

    if (existingUser) {
      return NextResponse.json(
        { error: 'User with this email already exists' },
        { status: 409 }
      );
    }

    // Hash password
    const hashedPassword = await hash(validatedData.password, 12);

    // Create user
    const user = await prisma.user.create({
      data: {
        name: validatedData.name,
        email: validatedData.email,
        password: hashedPassword,
        role: validatedData.role,
      },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        createdAt: true,
      },
    });

    return NextResponse.json(user, { status: 201 });
  } catch (error) {
    console.error('Registration error:', error);

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation error', details: error.flatten() },
        { status: 400 }
      );
    }

    const message = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json(
      { error: message },
      { status: 500 }
    );
  }
}

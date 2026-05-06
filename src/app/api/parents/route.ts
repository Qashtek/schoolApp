import { getServerSession } from 'next-auth';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { ParentService } from '@/lib/services/parent.service';
import { authOptions, Role } from '@/lib/auth';
import { isAdmin } from '@/lib/permissions';

// Zod schema for creating parent
const createParentSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  email: z.string().email('Valid email is required'),
});

/**
 * GET /api/parents
 * Return all parents with their linked students for the admin's school
 */
export async function GET(request: Request) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const normalizedRole = String(session.user.role ?? '').toUpperCase() as Role;
    const user = {
      id: session.user.id as string,
      role: normalizedRole,
      email: session.user.email as string | undefined,
      schoolId: session.user.schoolId as string | undefined,
    };

    // ADMIN only
    if (!isAdmin(normalizedRole)) {
      return NextResponse.json(
        { error: 'Forbidden: Only administrators can access this resource' },
        { status: 403 }
      );
    }

    if (!user.schoolId) {
      return NextResponse.json(
        { error: 'Admin is not assigned to a school' },
        { status: 400 }
      );
    }

    const parents = await prisma.parent.findMany({
      where: {
        schoolId: user.schoolId,
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
            schoolId: true,
          },
        },
        students: {
          include: {
            student: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                admissionNumber: true,
                grade: true,
              },
            },
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    return NextResponse.json({
      data: parents,
    });
  } catch (error) {
    console.error('Error fetching parents:', error);
    const message = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json(
      { error: message },
      { status: 500 }
    );
  }
}

/**
 * POST /api/parents
 * Create a new parent with linked user account
 */
export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    if (!session.user.schoolId) {
      return NextResponse.json(
        { error: 'Admin is not assigned to a school' },
        { status: 400 }
      );
    }

    const body = await request.json();
    const validatedData = createParentSchema.parse(body);

    const normalizedRole = String(session.user.role ?? '').toUpperCase() as Role;

    const user = {
      id: session.user.id as string,
      role: normalizedRole,
      email: session.user.email as string | undefined,
      schoolId: session.user.schoolId as string | undefined,
    };

    // ADMIN only
    if (!isAdmin(normalizedRole)) {
      return NextResponse.json(
        { error: 'Forbidden: Only administrators can create parents' },
        { status: 403 }
      );
    }

    const parentService = new ParentService(user);
    const parent = await parentService.createParent(validatedData);

    return NextResponse.json(parent, { status: 201 });
  } catch (error) {
    console.error('Error creating parent:', error);

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation error', details: error.flatten() },
        { status: 400 }
      );
    }

    const message = error instanceof Error ? error.message : 'Internal server error';

    // Service throws specific errors
    if (message.includes('Unauthorized') || message.includes('Only ADMIN')) {
      return NextResponse.json({ error: message }, { status: 403 });
    }

    if (message.includes('already exists')) {
      return NextResponse.json({ error: message }, { status: 409 });
    }

    return NextResponse.json({ error: message }, { status: 500 });
  }
}

import { getServerSession } from 'next-auth';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { TeacherService } from '@/lib/services/teacher.service';
import { authOptions, Role } from '@/lib/auth';
import { isAdmin } from '@/lib/permissions';

// Input validation schema for creating a teacher
const createTeacherSchema = z.object({
  userId: z.string().min(1, 'User ID is required'),
  schoolId: z.string().optional(),
  subject: z.string().optional(),
});

// Query validation schema for listing teachers
const getTeachersSchema = z.object({
  schoolId: z.string().optional(),
  isActive: z.coerce.boolean().optional(),
  skip: z.coerce.number().int().min(0).optional().default(0),
  take: z.coerce.number().int().min(1).max(100).optional().default(10),
});

/**
 * GET /api/teachers
 * List all teachers with optional filtering and pagination
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

    const userRole = session.user.role as Role;

    // Only ADMIN or SUPER_ADMIN can list teachers
    if (!isAdmin(userRole)) {
      return NextResponse.json(
        { error: 'Forbidden: Only administrators can list teachers' },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(request.url);
    const params = {
      schoolId: searchParams.get('schoolId') ?? undefined,
      isActive: searchParams.get('isActive') ?? undefined,
      skip: searchParams.get('skip') ?? undefined,
      take: searchParams.get('take') ?? undefined,
    };

    // Validate query parameters
    const validatedParams = getTeachersSchema.parse(params);

    const user = {
      id: session.user.id,
      role: userRole,
      email: session.user.email,
    };

    const teacherService = new TeacherService(user);
    const { teachers, count } = await teacherService.getAllTeachers({
      schoolId: validatedParams.schoolId,
      isActive: validatedParams.isActive,
      skip: validatedParams.skip,
      take: validatedParams.take,
    });

    return NextResponse.json({
      data: teachers,
      meta: {
        total: count,
        skip: validatedParams.skip,
        take: validatedParams.take,
      },
    });
  } catch (error) {
    console.error('Error fetching teachers:', error);

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid request parameters', details: error.flatten() },
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

/**
 * POST /api/teachers
 * Create a new teacher
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

    const userRole = session.user.role as Role;

    // Only ADMIN can create teachers
    if (!isAdmin(userRole)) {
      return NextResponse.json(
        { error: 'Forbidden: Only administrators can create teachers' },
        { status: 403 }
      );
    }

    const body = await request.json();

    // Validate input
    const validatedData = createTeacherSchema.parse(body);

    const user = {
      id: session.user.id,
      role: userRole,
      email: session.user.email,
    };

    const teacherService = new TeacherService(user);
    const teacher = await teacherService.createTeacher(validatedData);

    return NextResponse.json(teacher, { status: 201 });
  } catch (error) {
    console.error('Error creating teacher:', error);

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation error', details: error.flatten() },
        { status: 400 }
      );
    }

    const message = error instanceof Error ? error.message : 'Internal server error';

    // Handle specific errors with appropriate status codes
    if (message.includes('Unauthorized')) {
      return NextResponse.json(
        { error: message },
        { status: 403 }
      );
    }

    if (message.includes('already exists') || message.includes('not found')) {
      return NextResponse.json(
        { error: message },
        { status: 409 }
      );
    }

    return NextResponse.json(
      { error: message },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/teachers?userId=xxx
 * Delete a user by userId (for cleanup when teacher creation fails)
 * This is an internal/admin endpoint for cleanup purposes
 */
export async function DELETE(request: Request) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const userRole = session.user.role as Role;

    // Only ADMIN can delete users
    if (!isAdmin(userRole)) {
      return NextResponse.json(
        { error: 'Forbidden: Only administrators can delete users' },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');

    if (!userId) {
      return NextResponse.json(
        { error: 'User ID is required' },
        { status: 400 }
      );
    }

    // Delete the user (this will cascade delete teacher/student/parent records)
    await prisma.user.delete({
      where: { id: userId },
    });

    return NextResponse.json({ success: true, message: 'User deleted successfully' });
  } catch (error) {
    console.error('Error deleting user:', error);

    const message = error instanceof Error ? error.message : 'Internal server error';

    if (message.includes('not found')) {
      return NextResponse.json(
        { error: message },
        { status: 404 }
      );
    }

    return NextResponse.json(
      { error: message },
      { status: 500 }
    );
  }
}

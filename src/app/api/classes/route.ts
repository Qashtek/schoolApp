import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { z } from 'zod';
import { authOptions } from '@/lib/auth';
import { isAdmin } from '@/lib/permissions';
import { ClassService } from '@/lib/services/class.service';
import { createClassSchema } from '@/lib/validators/class';

const getClassesSchema = z.object({
  page: z.coerce.number().int().min(1, 'Page must be at least 1').default(1),
  limit: z.coerce.number().int().min(1, 'Limit must be at least 1').max(100, 'Limit must be at most 100').default(20),
});

/**
 * GET /api/classes
 * List all classes with teachers and student counts
 * ADMIN-only
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.role || !isAdmin(session.user.role)) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    if (!session.user?.schoolId) {
      return NextResponse.json(
        { error: 'Admin is not assigned to a school' },
        { status: 400 }
      );
    }

    const { searchParams } = new URL(request.url);
    const params = {
      page: searchParams.get('page') ?? undefined,
      limit: searchParams.get('limit') ?? undefined,
    };
    const validatedParams = getClassesSchema.parse(params);
    const skip = (validatedParams.page - 1) * validatedParams.limit;

    const classService = new ClassService({
      id: session.user.id,
      email: session.user.email,
      name: session.user.name,
      role: session.user.role,
      schoolId: session.user.schoolId,
    });

    const { classes, count } = await classService.getAllClasses({
      schoolId: session.user.schoolId,
      skip,
      take: validatedParams.limit,
    });

    const totalPages = Math.ceil(count / validatedParams.limit);

    return NextResponse.json({
      data: classes,
      total: count,
      page: validatedParams.page,
      limit: validatedParams.limit,
      totalPages,
    });
  } catch (error) {
    console.error('Error fetching classes:', error);
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid request parameters', details: error.flatten() },
        { status: 400 }
      );
    }
    if (error instanceof Error) {
      return NextResponse.json(
        { error: error.message },
        { status: error.message.startsWith('Unauthorized') ? 403 : 400 }
      );
    }
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/classes
 * Create a new class
 * ADMIN-only
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.role || !isAdmin(session.user.role)) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    if (!session.user?.schoolId) {
      return NextResponse.json(
        { error: 'Admin is not assigned to a school' },
        { status: 400 }
      );
    }

    const body = await request.json();

    // Validate input
    const validationResult = createClassSchema.safeParse(body);
    if (!validationResult.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: validationResult.error.flatten() },
        { status: 400 }
      );
    }

    const classService = new ClassService({
      id: session.user.id,
      email: session.user.email,
      name: session.user.name,
      role: session.user.role,
      schoolId: session.user.schoolId,
    });

    const newClass = await classService.createClass({
      ...validationResult.data,
      schoolId: session.user.schoolId,
    });

    return NextResponse.json(newClass, { status: 201 });
  } catch (error) {
    console.error('Error creating class:', error);
    if (error instanceof Error) {
      return NextResponse.json(
        { error: error.message },
        { status: 400 }
      );
    }
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

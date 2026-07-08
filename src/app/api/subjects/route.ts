import { getServerSession } from 'next-auth';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { authOptions, Role } from '@/lib/auth';
import { isAdmin } from '@/lib/permissions';
import { SubjectService } from '@/lib/services/subject.service';

const createSubjectSchema = z.object({
  name: z.string().trim().min(1, 'Name is required'),
  code: z.string().trim().min(1, 'Code is required'),
  description: z.string().trim().min(1, 'Description cannot be empty').optional(),
}).strict();

const getSubjectsSchema = z.object({
  page: z.coerce.number().int().min(1, 'Page must be at least 1').default(1),
  limit: z.coerce.number().int().min(1, 'Limit must be at least 1').max(100, 'Limit must be at most 100').default(20),
});

function mapServiceErrorToStatus(message: string): number {
  if (message.startsWith('Unauthorized')) {
    return 403;
  }

  if (message.includes('already exists')) {
    return 409;
  }

  if (
    message.includes('required') ||
    message.includes('cannot be empty') ||
    message.includes('not assigned to a school')
  ) {
    return 400;
  }

  return 500;
}

/**
 * GET /api/subjects
 * Return all subjects for the admin's school
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

    const normalizedRole = String(session.user.role ?? '').toUpperCase();
    if (!isAdmin(normalizedRole as Role)) {
      return NextResponse.json(
        { error: 'Forbidden: Only administrators can access subjects' },
        { status: 403 }
      );
    }

    if (!session.user.schoolId) {
      return NextResponse.json(
        { error: 'Admin is not assigned to a school' },
        { status: 400 }
      );
    }

    const { searchParams } = new URL(request.url);
    const query = {
      page: searchParams.get('page') ?? undefined,
      limit: searchParams.get('limit') ?? undefined,
    };
    const validatedQuery = getSubjectsSchema.parse(query);
    const skip = (validatedQuery.page - 1) * validatedQuery.limit;

    const user = {
      id: session.user.id as string,
      role: normalizedRole as Role,
      email: session.user.email as string | undefined,
      schoolId: session.user.schoolId,
    };

    const subjectService = new SubjectService(user);
    const { subjects, count } = await subjectService.getAllSubjects({
      skip,
      take: validatedQuery.limit,
    });

    const totalPages = Math.ceil(count / validatedQuery.limit);

    return NextResponse.json({
      data: subjects,
      total: count,
      page: validatedQuery.page,
      limit: validatedQuery.limit,
      totalPages,
    });
  } catch (error) {
    console.error('Error fetching subjects:', error);

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid request parameters', details: error.flatten() },
        { status: 400 }
      );
    }

    const message = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json(
      { error: message },
      { status: mapServiceErrorToStatus(message) }
    );
  }
}

/**
 * POST /api/subjects
 * Create a new subject
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

    const normalizedRole = String(session.user.role ?? '').toUpperCase();
    if (!isAdmin(normalizedRole as Role)) {
      return NextResponse.json(
        { error: 'Forbidden: Only administrators can create subjects' },
        { status: 403 }
      );
    }

    if (!session.user.schoolId) {
      return NextResponse.json(
        { error: 'Admin is not assigned to a school' },
        { status: 400 }
      );
    }

    const body = await request.json();
    const validatedData = createSubjectSchema.parse(body);

    const user = {
      id: session.user.id as string,
      role: normalizedRole as Role,
      email: session.user.email as string | undefined,
      schoolId: session.user.schoolId,
    };

    const subjectService = new SubjectService(user);
    const subject = await subjectService.createSubject(validatedData);

    return NextResponse.json(subject, { status: 201 });
  } catch (error) {
    console.error('Error creating subject:', error);

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation error', details: error.flatten() },
        { status: 400 }
      );
    }

    const message = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json(
      { error: message },
      { status: mapServiceErrorToStatus(message) }
    );
  }
}

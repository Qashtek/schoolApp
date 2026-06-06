import { getServerSession } from 'next-auth';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { authOptions, type Role } from '@/lib/auth';
import { GradeService } from '@/lib/services/grade.service';

const upsertGradeSchema = z.object({
  studentId: z.string().trim().min(1, 'studentId is required'),
  subjectId: z.string().trim().min(1, 'subjectId is required'),
  classId: z.string().trim().min(1, 'classId is required'),
  termId: z.string().trim().min(1, 'termId is required'),
  caScore: z.number().min(0, 'caScore must be at least 0').max(100, 'caScore must be at most 100').optional(),
  examScore: z.number().min(0, 'examScore must be at least 0').max(100, 'examScore must be at most 100').optional(),
}).strict();

const getGradesByClassSchema = z.object({
  classId: z.string().trim().min(1, 'classId is required'),
  termId: z.string().trim().min(1, 'termId is required'),
  page: z.coerce.number().int().min(1, 'Page must be at least 1').default(1),
  limit: z.coerce.number().int().min(1, 'Limit must be at least 1').max(100, 'Limit must be at most 100').default(20),
});

function mapServiceErrorToStatus(message: string): number {
  if (
    message.startsWith('Unauthorized') ||
    message.includes('not assigned')
  ) {
    return 403;
  }

  if (message.includes('not found')) {
    return 404;
  }

  if (
    message.includes('required') ||
    message.includes('must be') ||
    message.includes('cannot')
  ) {
    return 400;
  }

  return 500;
}

/**
 * GET /api/grades?classId=<classId>&termId=<termId>
 * Return grades filtered by class and term
 * ADMIN and TEACHER only
 */
export async function GET(request: Request) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const normalizedRole = String(session.user.role ?? '').toUpperCase();
    const canViewGrades =
      normalizedRole === 'ADMIN' ||
      normalizedRole === 'SUPER_ADMIN' ||
      normalizedRole === 'TEACHER';

    if (!canViewGrades) {
      return NextResponse.json(
        { error: 'Forbidden: Only ADMIN and TEACHER users can view grades' },
        { status: 403 }
      );
    }

    if (!session.user.schoolId) {
      return NextResponse.json(
        { error: 'Unauthorized: User is not assigned to a school' },
        { status: 400 }
      );
    }

    const { searchParams } = new URL(request.url);
    const query = {
      classId: searchParams.get('classId') ?? undefined,
      termId: searchParams.get('termId') ?? undefined,
      page: searchParams.get('page') ?? undefined,
      limit: searchParams.get('limit') ?? undefined,
    };

    const validatedQuery = getGradesByClassSchema.parse(query);

    const gradeService = new GradeService({
      id: session.user.id as string,
      role: normalizedRole as Role,
      email: session.user.email ?? '',
      schoolId: session.user.schoolId,
    });

    const skip = (validatedQuery.page - 1) * validatedQuery.limit;
    const { grades, count } = await gradeService.getGradesByClass(
      validatedQuery.classId,
      validatedQuery.termId,
      {
        skip,
        take: validatedQuery.limit,
      }
    );

    const totalPages = Math.ceil(count / validatedQuery.limit);

    return NextResponse.json(
      {
        data: grades,
        total: count,
        page: validatedQuery.page,
        limit: validatedQuery.limit,
        totalPages,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('Error fetching grades:', error);

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

/**
 * POST /api/grades
 * Create or update a grade (upsert)
 * TEACHER only
 */
export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const normalizedRole = String(session.user.role ?? '').toUpperCase();

    if (normalizedRole !== 'TEACHER') {
      return NextResponse.json(
        { error: 'Forbidden: Only TEACHER users can enter or update grades' },
        { status: 403 }
      );
    }

    if (!session.user.schoolId) {
      return NextResponse.json(
        { error: 'Unauthorized: User is not assigned to a school' },
        { status: 400 }
      );
    }

    const body = await request.json();
    const validatedData = upsertGradeSchema.parse(body);

    const gradeService = new GradeService({
      id: session.user.id as string,
      role: normalizedRole as Role,
      email: session.user.email ?? '',
      schoolId: session.user.schoolId,
    });

    const grade = await gradeService.upsertGrade(validatedData);

    return NextResponse.json(
      { message: 'Grade saved successfully', data: grade },
      { status: 200 }
    );
  } catch (error) {
    console.error('Error upserting grade:', error);

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

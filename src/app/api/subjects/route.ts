import { getServerSession } from 'next-auth';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { authOptions, Role } from '@/lib/auth';
import { SubjectService } from '@/lib/services/subject.service';

const createSubjectSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  code: z.string().min(1, 'Code is required'),
  description: z.string().optional(),
}).strict();

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
export async function GET() {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const normalizedRole = String(session.user.role ?? '').toUpperCase();
    if (normalizedRole !== 'ADMIN') {
      return NextResponse.json(
        { error: 'Forbidden: Only ADMIN users can access subjects' },
        { status: 403 }
      );
    }

    if (!session.user.schoolId) {
      return NextResponse.json(
        { error: 'Admin is not assigned to a school' },
        { status: 400 }
      );
    }

    const user = {
      id: session.user.id as string,
      role: normalizedRole as Role,
      email: session.user.email as string | undefined,
      schoolId: session.user.schoolId,
    };

    const subjectService = new SubjectService(user);
    const subjects = await subjectService.getAllSubjects();

    return NextResponse.json(subjects);
  } catch (error) {
    console.error('Error fetching subjects:', error);

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
    if (normalizedRole !== 'ADMIN') {
      return NextResponse.json(
        { error: 'Forbidden: Only ADMIN users can create subjects' },
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
        { error: 'Validation error', details: error.issues },
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

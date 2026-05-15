import { getServerSession } from 'next-auth';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { authOptions, Role } from '@/lib/auth';
import { SubjectService } from '@/lib/services/subject.service';

const assignSubjectToClassSchema = z.object({
  classId: z.string().trim().min(1, 'Class ID is required'),
}).strict();

function mapServiceErrorToStatus(message: string): number {
  if (message.startsWith('Unauthorized')) {
    return 403;
  }

  if (message.includes('already assigned')) {
    return 409;
  }

  if (message.includes('not found')) {
    return 404;
  }

  if (message.includes('required') || message.includes('not assigned to a school')) {
    return 400;
  }

  return 500;
}

/**
 * POST /api/subjects/[subjectId]/classes
 * Assign a subject to a class
 */
export async function POST(
  request: Request,
  { params }: { params: { subjectId: string } }
) {
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
        { error: 'Forbidden: Only ADMIN users can assign subjects to classes' },
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
    const validatedData = assignSubjectToClassSchema.parse(body);

    const user = {
      id: session.user.id as string,
      role: normalizedRole as Role,
      email: session.user.email as string | undefined,
      schoolId: session.user.schoolId,
    };

    const subjectService = new SubjectService(user);

    await subjectService.assignSubjectToClass({
      subjectId: params.subjectId,
      classId: validatedData.classId,
    });

    const updatedSubject = await subjectService.getSubjectWithAssignedClasses(params.subjectId);

    return NextResponse.json(updatedSubject);
  } catch (error) {
    console.error('Error assigning subject to class:', error);

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

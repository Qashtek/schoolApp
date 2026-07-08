import { getServerSession } from 'next-auth';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { authOptions, Role } from '@/lib/auth';
import { isAdmin } from '@/lib/permissions';
import { SubjectService } from '@/lib/services/subject.service';

const assignSubjectToTeacherSchema = z.object({
  teacherId: z.string().trim().min(1, 'Teacher ID is required'),
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
 * POST /api/subjects/[subjectId]/teachers
 * Assign a subject to a teacher
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
    if (!isAdmin(normalizedRole as Role)) {
      return NextResponse.json(
        { error: 'Forbidden: Only administrators can assign subjects to teachers' },
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
    const validatedData = assignSubjectToTeacherSchema.parse(body);

    const user = {
      id: session.user.id as string,
      role: normalizedRole as Role,
      email: session.user.email as string | undefined,
      schoolId: session.user.schoolId,
    };

    const subjectService = new SubjectService(user);

    await subjectService.assignSubjectToTeacher({
      subjectId: params.subjectId,
      teacherId: validatedData.teacherId,
    });

    const updatedSubject = await subjectService.getSubjectWithAssignedTeachers(params.subjectId);

    return NextResponse.json(updatedSubject);
  } catch (error) {
    console.error('Error assigning subject to teacher:', error);

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

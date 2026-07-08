import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { z } from 'zod';
import { authOptions, Role } from '@/lib/auth';
import { isAdmin } from '@/lib/permissions';
import { TeacherService } from '@/lib/services/teacher.service';

const assignTeacherSchema = z.object({
  teacherId: z.string().trim().min(1, 'Teacher ID is required'),
  assignmentType: z.enum(['CLASS_TEACHER', 'SUBJECT_TEACHER']),
});

/**
 * POST /api/classes/[classId]/teachers
 * Assign a teacher to a class with an assignment type
 * 
 * Note: For SUBJECT_TEACHER assignments, use POST /api/teachers/[id]/assignments instead
 * with the subjectId field. This legacy route only supports CLASS_TEACHER assignments.
 */
export async function POST(
  request: Request,
  { params }: { params: { classId: string } }
) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.role || !isAdmin(session.user.role)) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const validatedData = assignTeacherSchema.parse(body);

    if (validatedData.assignmentType === 'SUBJECT_TEACHER') {
      return NextResponse.json(
        { error: 'SUBJECT_TEACHER assignments require a subjectId. Use POST /api/teachers/[id]/assignments instead.' },
        { status: 400 }
      );
    }

    const user = {
      id: session.user.id,
      role: session.user.role as Role,
      email: session.user.email,
      schoolId: session.user.schoolId,
    };

    const teacherService = new TeacherService(user);

    const assignment = await teacherService.assignClassTeacher(
      validatedData.teacherId,
      params.classId
    );

    return NextResponse.json({
      message: 'Teacher assigned successfully',
      assignment,
    });
  } catch (error) {
    console.error('Error assigning teacher to class:', error);

    if (error instanceof z.ZodError) {
      const hasAssignmentTypeError = error.issues.some(
        (e) => e.path.includes('assignmentType')
      );

      if (hasAssignmentTypeError) {
        return NextResponse.json(
          { error: 'assignmentType is required and must be CLASS_TEACHER or SUBJECT_TEACHER' },
          { status: 400 }
        );
      }

      return NextResponse.json(
        { error: 'Validation error', details: error.flatten() },
        { status: 400 }
      );
    }

    const message = error instanceof Error ? error.message : 'Internal server error';

    if (
      message === 'This class already has a class teacher assigned' ||
      message === 'This teacher is already assigned as class teacher of another class' ||
      message.includes('already has a class teacher') ||
      message.includes('already the class teacher')
    ) {
      return NextResponse.json(
        { error: message },
        { status: 400 }
      );
    }

    const status = message.startsWith('Unauthorized') ? 403 : 400;

    return NextResponse.json(
      { error: message },
      { status }
    );
  }
}

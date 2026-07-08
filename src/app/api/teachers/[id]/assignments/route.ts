import { getServerSession } from 'next-auth';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { TeacherService } from '@/lib/services/teacher.service';
import { authOptions, Role } from '@/lib/auth';
import { isAdmin } from '@/lib/permissions';

// Validation schema for creating an assignment
const classTeacherAssignmentSchema = z.object({
  classId: z.string().trim().min(1, 'Class ID is required'),
  assignmentType: z.literal('CLASS_TEACHER'),
});

const subjectTeacherAssignmentSchema = z.object({
  classId: z.string().trim().min(1, 'Class ID is required'),
  assignmentType: z.literal('SUBJECT_TEACHER'),
  subjectId: z.string().trim().min(1, 'Subject ID is required'),
});

const createAssignmentSchema = z.discriminatedUnion('assignmentType', [
  classTeacherAssignmentSchema,
  subjectTeacherAssignmentSchema,
]);

/**
 * GET /api/teachers/[id]/assignments
 * Return all assignments for a teacher including class and subject details
 */
export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userRole = session.user.role as Role;

    if (!isAdmin(userRole)) {
      return NextResponse.json(
        { error: 'Forbidden: Only administrators can view teacher assignments' },
        { status: 403 }
      );
    }

    if (!session.user?.schoolId) {
      return NextResponse.json(
        { error: 'Admin is not assigned to a school' },
        { status: 400 }
      );
    }

    const user = {
      id: session.user.id,
      role: userRole,
      email: session.user.email,
      schoolId: session.user.schoolId,
    };

    const teacherService = new TeacherService(user);
    const assignments = await teacherService.getTeacherAssignments(params.id);

    return NextResponse.json({ data: assignments });
  } catch (error) {
    console.error('Error fetching teacher assignments:', error);

    const message = error instanceof Error ? error.message : 'Internal server error';

    if (message.includes('not found')) {
      return NextResponse.json({ error: message }, { status: 404 });
    }

    if (message.includes('Unauthorized')) {
      return NextResponse.json({ error: message }, { status: 403 });
    }

    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/**
 * POST /api/teachers/[id]/assignments
 * Add a new assignment for a teacher
 */
export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userRole = session.user.role as Role;

    if (!isAdmin(userRole)) {
      return NextResponse.json(
        { error: 'Forbidden: Only administrators can manage teacher assignments' },
        { status: 403 }
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
    const validatedData = createAssignmentSchema.parse(body);

    const user = {
      id: session.user.id,
      role: userRole,
      email: session.user.email,
      schoolId: session.user.schoolId,
    };

    const teacherService = new TeacherService(user);

    if (validatedData.assignmentType === 'CLASS_TEACHER') {
      const assignment = await teacherService.assignClassTeacher(
        params.id,
        validatedData.classId
      );

      return NextResponse.json(assignment, { status: 201 });
    }

    // validatedData.assignmentType === 'SUBJECT_TEACHER'
    // TypeScript correctly narrows subjectId as required here
    const assignment = await teacherService.assignSubjectTeacher(
      params.id,
      validatedData.classId,
      validatedData.subjectId
    );

    return NextResponse.json(assignment, { status: 201 });
  } catch (error) {
    console.error('Error creating teacher assignment:', error);

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation error', details: error.flatten() },
        { status: 400 }
      );
    }

    const message = error instanceof Error ? error.message : 'Internal server error';

    if (message.includes('Unauthorized')) {
      return NextResponse.json({ error: message }, { status: 403 });
    }

    if (
      message.includes('not found') ||
      message.includes('already') ||
      message.includes('already has a class teacher') ||
      message.includes('already the class teacher')
    ) {
      return NextResponse.json({ error: message }, { status: 409 });
    }

    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/**
 * DELETE /api/teachers/[id]/assignments?assignmentId=xxx
 * Remove an assignment by its ID
 */
export async function DELETE(
  request: Request,
  _context: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userRole = session.user.role as Role;

    if (!isAdmin(userRole)) {
      return NextResponse.json(
        { error: 'Forbidden: Only administrators can manage teacher assignments' },
        { status: 403 }
      );
    }

    if (!session.user?.schoolId) {
      return NextResponse.json(
        { error: 'Admin is not assigned to a school' },
        { status: 400 }
      );
    }

    const { searchParams } = new URL(request.url);
    const assignmentId = searchParams.get('assignmentId');

    if (!assignmentId) {
      return NextResponse.json(
        { error: 'assignmentId query parameter is required' },
        { status: 400 }
      );
    }

    const user = {
      id: session.user.id,
      role: userRole,
      email: session.user.email,
      schoolId: session.user.schoolId,
    };

    const teacherService = new TeacherService(user);
    const result = await teacherService.removeAssignment(assignmentId);

    return NextResponse.json(result);
  } catch (error) {
    console.error('Error removing teacher assignment:', error);

    const message = error instanceof Error ? error.message : 'Internal server error';

    if (message.includes('not found')) {
      return NextResponse.json({ error: message }, { status: 404 });
    }

    if (message.includes('Unauthorized')) {
      return NextResponse.json({ error: message }, { status: 403 });
    }

    return NextResponse.json({ error: message }, { status: 500 });
  }
}

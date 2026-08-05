import { getServerSession } from 'next-auth';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { StudentService } from '@/lib/services/student.service';
import { authOptions, Role } from '@/lib/auth';
import { isAdmin } from '@/lib/permissions';

const updateStudentSchema = z.object({
  firstName: z.string().trim().min(1, 'First name is required').optional(),
  lastName: z.string().trim().min(1, 'Last name is required').optional(),
  admissionNumber: z.string().trim().min(1, 'Admission number is required').optional(),
  email: z.string().trim().email('Invalid email address').optional(),
  grade: z.string().trim().optional(),
  classId: z.string().trim().optional(),
});

/**
 * GET /api/students/[studentId]
 * Fetch a single student by ID
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ studentId: string }> }
) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { studentId } = await params;

    const normalizedRole = String(session.user.role ?? '').toUpperCase();
    const user = {
      id: session.user.id as string,
      role: normalizedRole as Role,
      email: session.user.email as string | undefined,
    };

    if (!isAdmin(normalizedRole as Role)) {
      return NextResponse.json(
        { error: 'Forbidden: Only administrators can access this resource' },
        { status: 403 }
      );
    }

    const studentService = new StudentService(user);
    const student = await studentService.getStudentById(studentId);

    return NextResponse.json(student);
  } catch (error) {
    console.error('Error fetching student:', error);

    const message = error instanceof Error ? error.message : 'Internal server error';

    if (message === 'Student not found') {
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

/**
 * PATCH /api/students/[studentId]
 * Update a student
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ studentId: string }> }
) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { studentId } = await params;
    const body = await request.json();

    // Validate input
    const validatedData = updateStudentSchema.parse(body);

    const normalizedRole = String(session.user.role ?? '').toUpperCase();
    const user = {
      id: session.user.id as string,
      role: normalizedRole as Role,
      email: session.user.email as string | undefined,
      schoolId: session.user.schoolId as string | undefined,
    };

    if (!isAdmin(normalizedRole as Role)) {
      return NextResponse.json(
        { error: 'Forbidden: Only administrators can update students' },
        { status: 403 }
      );
    }

    const studentService = new StudentService(user);
    const updatedStudent = await studentService.updateStudent(studentId, validatedData);

    return NextResponse.json(updatedStudent);
  } catch (error) {
    console.error('Error updating student:', error);

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation error', details: error.flatten() },
        { status: 400 }
      );
    }

    const message = error instanceof Error ? error.message : 'Internal server error';

    if (message === 'Student not found') {
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

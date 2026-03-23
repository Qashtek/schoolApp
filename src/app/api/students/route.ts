import { getServerSession } from 'next-auth';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { StudentService } from '@/lib/services/student.service';
import { authOptions, Role } from '@/lib/auth';
import { isAdmin } from '@/lib/permissions';

// Input validation schema for creating student
const createStudentSchema = z.object({
  userId: z.string().min(1, 'User ID is required').optional(),
  firstName: z.string().min(1, 'First name is required'),
  lastName: z.string().min(1, 'Last name is required'),
  admissionNumber: z.string().min(1, 'Admission number is required'),
  grade: z.string().optional(),
  classId: z.string().optional(),
});

// Query validation schema for getting students by class
const getStudentsByClassSchema = z.object({
  classId: z.string().min(1, 'Class ID is required'),
});

/**
 * GET /api/students?classId=<classId>
 * Fetch students by classId
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

    const { searchParams } = new URL(request.url);
    const params = {
      classId: searchParams.get('classId') ?? undefined,
    };

    // Validate query parameters
    const validatedParams = getStudentsByClassSchema.parse(params);

    const normalizedRole = String(session.user.role ?? '').toUpperCase();

    const user = {
      id: session.user.id as string,
      role: normalizedRole as Role,
      email: session.user.email as string | undefined,
    };

    // Check if user is ADMIN
    if (!isAdmin(normalizedRole as Role)) {
      return NextResponse.json(
        { error: 'Forbidden: Only administrators can access this resource' },
        { status: 403 }
      );
    }

    const studentService = new StudentService(user);
    const students = await studentService.getStudentsByClass(validatedParams.classId);

    return NextResponse.json({
      data: students,
    });
  } catch (error) {
    console.error('Error fetching students:', error);

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid request parameters', details: error.issues },
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
 * POST /api/students
 * Create a new student
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

    if (!session.user?.schoolId) {
      return NextResponse.json(
        { error: 'Admin is not assigned to a school' },
        { status: 400 }
      );
    }

    const body = await request.json();

    // Validate input
    const validatedData = createStudentSchema.parse(body);

    const normalizedRole = String(session.user.role ?? '').toUpperCase();

    const user = {
      id: session.user.id as string,
      role: normalizedRole as Role,
      email: session.user.email as string | undefined,
    };

    // Check if user is ADMIN
    if (!isAdmin(normalizedRole as Role)) {
      return NextResponse.json(
        { error: 'Forbidden: Only administrators can create students' },
        { status: 403 }
      );
    }

    const studentService = new StudentService(user);
    const student = await studentService.createStudent({
      ...validatedData,
      schoolId: session.user.schoolId,
    });

    return NextResponse.json(student, { status: 201 });
  } catch (error) {
    console.error('Error creating student:', error);

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation error', details: error.issues },
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

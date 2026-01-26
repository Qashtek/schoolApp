import { getServerSession } from 'next-auth';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { StudentService } from '@/lib/services/student.service';
import { Role } from '@/lib/permissions';

// Input validation schema
const createStudentSchema = z.object({
  userId: z.string().min(1, 'User ID is required'),
  grade: z.string().optional(),
  class: z.string().optional(),
});

// Query validation schema
const getStudentsSchema = z.object({
  grade: z.string().optional(),
  class: z.string().optional(),
  skip: z.coerce.number().int().min(0).optional().default(0),
  take: z.coerce.number().int().min(1).max(100).optional().default(10),
});

/**
 * GET /api/students
 * List all students with optional filtering and pagination
 */
export async function GET(request: Request) {
  try {
    const session = await getServerSession();

    if (!session?.token) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const params = {
      grade: searchParams.get('grade') ?? undefined,
      class: searchParams.get('class') ?? undefined,
      skip: searchParams.get('skip') ?? undefined,
      take: searchParams.get('take') ?? undefined,
    };

    // Validate query parameters
    const validatedParams = getStudentsSchema.parse(params);

    const user = {
      id: session.token.sub as string,
      role: session.token.role as Role,
      email: session.token.email as string | undefined,
    };

    const studentService = new StudentService(user);
    const { students, count } = await studentService.getAllStudents({
      grade: validatedParams.grade,
      class: validatedParams.class,
      skip: validatedParams.skip,
      take: validatedParams.take,
    });

    return NextResponse.json({
      data: students,
      meta: {
        total: count,
        skip: validatedParams.skip,
        take: validatedParams.take,
      },
    });
  } catch (error) {
    console.error('Error fetching students:', error);

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid request parameters', details: error.errors },
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
    const session = await getServerSession();

    if (!session?.token) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const body = await request.json();

    // Validate input
    const validatedData = createStudentSchema.parse(body);

    const user = {
      id: session.token.sub as string,
      role: session.token.role as Role,
      email: session.token.email as string | undefined,
    };

    const studentService = new StudentService(user);
    const student = await studentService.createStudent(validatedData);

    return NextResponse.json(student, { status: 201 });
  } catch (error) {
    console.error('Error creating student:', error);

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation error', details: error.errors },
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


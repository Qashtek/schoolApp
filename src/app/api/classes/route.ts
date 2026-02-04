import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { ClassService } from '@/lib/services/class.service';
import { createClassSchema } from '@/lib/validators/class';

/**
 * GET /api/classes
 * List all classes with teachers and student counts
 * ADMIN-only
 */
export async function GET() {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.role || session.user.role !== 'ADMIN') {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const classService = new ClassService({
      id: session.user.id,
      email: session.user.email,
      name: session.user.name,
      role: session.user.role,
    });

    const { classes } = await classService.getAllClasses();

    return NextResponse.json(classes);
  } catch (error) {
    console.error('Error fetching classes:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/classes
 * Create a new class
 * ADMIN-only
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.role || session.user.role !== 'ADMIN') {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const body = await request.json();

    // Validate input
    const validationResult = createClassSchema.safeParse(body);
    if (!validationResult.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: validationResult.error.issues },
        { status: 400 }
      );
    }

    const classService = new ClassService({
      id: session.user.id,
      email: session.user.email,
      name: session.user.name,
      role: session.user.role,
    });

    const newClass = await classService.createClass(validationResult.data);

    return NextResponse.json(newClass, { status: 201 });
  } catch (error) {
    console.error('Error creating class:', error);
    if (error instanceof Error) {
      return NextResponse.json(
        { error: error.message },
        { status: 400 }
      );
    }
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

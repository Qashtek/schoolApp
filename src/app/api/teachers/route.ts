import { getServerSession } from 'next-auth';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { hash } from 'bcryptjs';
import { prisma } from '@/lib/prisma';
import { TeacherService } from '@/lib/services/teacher.service';
import { authOptions, Role } from '@/lib/auth';
import { isAdmin } from '@/lib/permissions';

// Input validation schema for creating a teacher
const createTeacherSchema = z.object({
  name: z.string().trim().min(1, 'Name is required'),
  email: z.string().trim().email('Invalid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
  classTeacher: z
    .object({
      classId: z.string().trim().min(1, 'Class ID is required'),
    })
    .optional(),
  subjectTeacher: z
    .array(
      z.object({
        classId: z.string().trim().min(1, 'Class ID is required'),
        subjectId: z.string().trim().min(1, 'Subject ID is required'),
      })
    )
    .optional(),
});

// Query validation schema for listing teachers
const getTeachersSchema = z.object({
  isActive: z.coerce.boolean().optional(),
  page: z.coerce.number().int().min(1, 'Page must be at least 1').default(1),
  limit: z.coerce
    .number()
    .int()
    .min(1, 'Limit must be at least 1')
    .max(100, 'Limit must be at most 100')
    .default(20),
});

/**
 * GET /api/teachers
 * List all teachers with optional filtering and pagination
 */
export async function GET(request: Request) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userRole = session.user.role as Role;

    // Only ADMIN or SUPER_ADMIN can list teachers
    if (!isAdmin(userRole)) {
      return NextResponse.json(
        { error: 'Forbidden: Only administrators can list teachers' },
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
    const params = {
      isActive: searchParams.get('isActive') ?? undefined,
      page: searchParams.get('page') ?? undefined,
      limit: searchParams.get('limit') ?? undefined,
    };

    // Validate query parameters
    const validatedParams = getTeachersSchema.parse(params);

    const user = {
      id: session.user.id,
      role: userRole,
      email: session.user.email,
      schoolId: session.user.schoolId,
    };

    const skip = (validatedParams.page - 1) * validatedParams.limit;

    const teacherService = new TeacherService(user);
    const { teachers, count } = await teacherService.getAllTeachers({
      schoolId: session.user.schoolId,
      isActive: validatedParams.isActive,
      skip,
      take: validatedParams.limit,
    });

    const totalPages = Math.ceil(count / validatedParams.limit);

    return NextResponse.json({
      data: teachers,
      total: count,
      page: validatedParams.page,
      limit: validatedParams.limit,
      totalPages,
    });
  } catch (error) {
    console.error('Error fetching teachers:', error);

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid request parameters', details: error.flatten() },
        { status: 400 }
      );
    }

    const message = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/**
 * POST /api/teachers
 * Create a new teacher with optional class/subject assignments
 * Creates a User, Teacher, and any provided assignments in a transactional flow
 */
export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userRole = session.user.role as Role;

    // Only ADMIN can create teachers
    if (!isAdmin(userRole)) {
      return NextResponse.json(
        { error: 'Forbidden: Only administrators can create teachers' },
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
    const validatedData = createTeacherSchema.parse(body);

    // Check for duplicate email
    const existingUser = await prisma.user.findUnique({
      where: { email: validatedData.email },
      select: { id: true },
    });

    if (existingUser) {
      return NextResponse.json(
        { error: 'A user with this email already exists' },
        { status: 409 }
      );
    }

    const sessionUser = {
      id: session.user.id,
      role: userRole,
      email: session.user.email,
      schoolId: session.user.schoolId,
    };

    const hashedPassword = await hash(validatedData.password, 12);

    // Create User and Teacher in a transaction
    const { userId, teacherId } = await prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          name: validatedData.name,
          email: validatedData.email,
          password: hashedPassword,
          role: 'TEACHER',
          schoolId: session.user.schoolId,
        },
      });

      const teacher = await tx.teacher.create({
        data: {
          userId: user.id,
          schoolId: session.user.schoolId,
        },
      });

      return { userId: user.id, teacherId: teacher.id };
    });

    // Perform assignments outside the transaction so TeacherService can use its own prisma client
    const teacherService = new TeacherService(sessionUser);

    try {
      if (validatedData.classTeacher) {
        await teacherService.assignClassTeacher(teacherId, validatedData.classTeacher.classId);
      }

      if (validatedData.subjectTeacher && validatedData.subjectTeacher.length > 0) {
        for (const assignment of validatedData.subjectTeacher) {
          await teacherService.assignSubjectTeacher(teacherId, assignment.classId, assignment.subjectId);
        }
      }
    } catch (assignmentError) {
      // Rollback: delete the created user (cascades to teacher)
      await prisma.user.delete({ where: { id: userId } }).catch(() => {
        console.error('Failed to rollback teacher creation after assignment failure');
      });
      throw assignmentError;
    }

    // Fetch the fully created teacher with all assignments
    const teacher = await teacherService.getTeacherById(teacherId);

    return NextResponse.json(teacher, { status: 201 });
  } catch (error) {
    console.error('Error creating teacher:', error);

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation error', details: error.flatten() },
        { status: 400 }
      );
    }

    const message = error instanceof Error ? error.message : 'Internal server error';

    // Handle specific errors with appropriate status codes
    if (message.includes('Unauthorized')) {
      return NextResponse.json({ error: message }, { status: 403 });
    }

    if (
      message.includes('already exists') ||
      message.includes('not found') ||
      message.includes('already assigned') ||
      message.includes('already has a class teacher') ||
      message.includes('already the class teacher')
    ) {
      return NextResponse.json({ error: message }, { status: 409 });
    }

    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/**
 * DELETE /api/teachers?userId=xxx
 * Delete a user by userId (for cleanup when teacher creation fails)
 * This is an internal/admin endpoint for cleanup purposes
 */
export async function DELETE(request: Request) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userRole = session.user.role as Role;

    // Only ADMIN can delete users
    if (!isAdmin(userRole)) {
      return NextResponse.json(
        { error: 'Forbidden: Only administrators can delete users' },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');

    if (!userId) {
      return NextResponse.json({ error: 'User ID is required' }, { status: 400 });
    }

    // Delete the user (this will cascade delete teacher/student/parent records)
    await prisma.user.delete({
      where: { id: userId },
    });

    return NextResponse.json({ success: true, message: 'User deleted successfully' });
  } catch (error) {
    console.error('Error deleting user:', error);

    const message = error instanceof Error ? error.message : 'Internal server error';

    if (message.includes('not found')) {
      return NextResponse.json({ error: message }, { status: 404 });
    }

    return NextResponse.json({ error: message }, { status: 500 });
  }
}

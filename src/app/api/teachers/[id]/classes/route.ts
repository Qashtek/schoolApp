import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { isAdmin } from '@/lib/permissions';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';

const assignClassesSchema = z.object({
  classIds: z
    .array(z.string().trim().min(1, 'Class ID is required'))
    .min(1, 'At least one class must be selected'),
});

const removeClassSchema = z.object({
  classId: z.string().trim().min(1, 'Class ID is required'),
});

/**
 * POST /api/teachers/[id]/classes
 * Assign classes to a teacher
 */
export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.role || !isAdmin(session.user.role)) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const teacherId = params.id;
    const body = await request.json();

    // Validate input
    const validatedData = assignClassesSchema.parse(body);

    // Verify teacher exists
    const teacher = await prisma.teacher.findUnique({
      where: { id: teacherId },
      include: { user: true },
    });

    if (!teacher) {
      return NextResponse.json(
        { error: 'Teacher not found' },
        { status: 404 }
      );
    }

    // Verify all classes exist
    const classes = await prisma.class.findMany({
      where: { id: { in: validatedData.classIds } },
      select: { id: true, name: true },
    });

    if (classes.length !== validatedData.classIds.length) {
      return NextResponse.json(
        { error: 'One or more classes not found' },
        { status: 400 }
      );
    }

    // Remove existing assignments and create new ones
    await prisma.$transaction(async (tx) => {
      // Remove existing assignments
      // Remove existing CLASS_TEACHER and SUBJECT_TEACHER assignments
      await tx.teacherClassSubject.deleteMany({
        where: { teacherId },
      });

      // Use TeacherService.assignSubjectTeacher for each class
      // Note: classes assigned via this legacy endpoint are SUBJECT_TEACHER type
      for (const classId of validatedData.classIds) {
        await tx.teacherClassSubject.create({
          data: {
            teacherId,
            classId,
            assignmentType: 'SUBJECT_TEACHER',
          },
        });
      }
    });

    return NextResponse.json({
      message: 'Classes assigned successfully',
      teacher: {
        id: teacher.id,
        name: teacher.user.name,
        email: teacher.user.email,
        assignedClasses: classes,
      },
    });
  } catch (error) {
    console.error('Error assigning classes:', error);

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation error', details: error.flatten() },
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
 * DELETE /api/teachers/[id]/classes
 * Remove a class from a teacher
 */
export async function DELETE(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.role || !isAdmin(session.user.role)) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const teacherId = params.id;
    const body = await request.json();

    // Validate input
    const validatedData = removeClassSchema.parse(body);

    // Verify teacher exists
    const teacher = await prisma.teacher.findUnique({
      where: { id: teacherId },
    });

    if (!teacher) {
      return NextResponse.json(
        { error: 'Teacher not found' },
        { status: 404 }
      );
    }

    // Verify class exists
    const classExists = await prisma.class.findUnique({
      where: { id: validatedData.classId },
      select: { id: true },
    });

    if (!classExists) {
      return NextResponse.json(
        { error: 'Class not found' },
        { status: 404 }
      );
    }

    // Remove the assignment
    await prisma.teacherClassSubject.deleteMany({
      where: {
        teacherId,
        classId: validatedData.classId,
      },
    });

    return NextResponse.json({
      message: 'Class removed from teacher successfully',
    });
  } catch (error) {
    console.error('Error removing class:', error);

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation error', details: error.flatten() },
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

import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';

const assignClassesSchema = z.object({
  classIds: z.array(z.string()).min(1, 'At least one class must be selected'),
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

    if (!session?.user?.role || session.user.role !== 'ADMIN') {
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
      await tx.teacherClass.deleteMany({
        where: { teacherId },
      });

      // Create new assignments
      await tx.teacherClass.createMany({
        data: validatedData.classIds.map(classId => ({
          teacherId,
          classId,
        })),
      });
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
        { error: 'Validation error', details: error.errors },
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

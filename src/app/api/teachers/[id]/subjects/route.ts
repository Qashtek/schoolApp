import { getServerSession } from 'next-auth';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { authOptions, Role } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

const unassignSubjectSchema = z.object({
  subjectId: z.string().trim().min(1, 'Subject ID is required'),
}).strict();

/**
 * DELETE /api/teachers/[id]/subjects
 * Unassign a subject from a teacher
 */
export async function DELETE(
  request: Request,
  { params }: { params: { id: string } }
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
    if (normalizedRole !== 'ADMIN') {
      return NextResponse.json(
        { error: 'Forbidden: Only ADMIN users can unassign subjects' },
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
    const validatedData = unassignSubjectSchema.parse(body);

    // Verify teacher exists and belongs to the school
    const teacher = await prisma.teacher.findFirst({
      where: {
        id: params.id,
        schoolId: session.user.schoolId,
      },
      select: { id: true },
    });

    if (!teacher) {
      return NextResponse.json(
        { error: 'Teacher not found' },
        { status: 404 }
      );
    }

    // Verify subject exists and belongs to the school
    const subject = await prisma.subject.findFirst({
      where: {
        id: validatedData.subjectId,
        schoolId: session.user.schoolId,
      },
      select: { id: true },
    });

    if (!subject) {
      return NextResponse.json(
        { error: 'Subject not found' },
        { status: 404 }
      );
    }

    // Delete the teacher-subject assignment
    await prisma.teacherSubject.deleteMany({
      where: {
        teacherId: params.id,
        subjectId: validatedData.subjectId,
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error unassigning subject from teacher:', error);

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

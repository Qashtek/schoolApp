import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { z } from 'zod';
import { authOptions, Role } from '@/lib/auth';
import { isAdmin } from '@/lib/permissions';
import { ParentService } from '@/lib/services/parent.service';

// Zod schema for linking/unlinking student
const linkStudentSchema = z.object({
  studentId: z.string().min(1, 'Student ID is required'),
});

/**
 * POST /api/parents/[parentId]/students
 * Link parent to student (ADMIN only)
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ parentId: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const normalizedRole = String(session.user.role ?? '').toUpperCase() as Role;
    
    // ADMIN only
    if (!isAdmin(normalizedRole)) {
      return NextResponse.json(
        { error: 'Forbidden: Only administrators can link parents to students' },
        { status: 403 }
      );
    }

    const parentId = (await params).parentId;
    if (!parentId) {
      return NextResponse.json({ error: 'Parent ID is required' }, { status: 400 });
    }

    const body = await request.json();
    const validatedData = linkStudentSchema.parse(body);

    const user = {
      id: session.user.id as string,
      role: normalizedRole,
      email: session.user.email as string | undefined,
      schoolId: session.user.schoolId as string | undefined,
    };

    const parentService = new ParentService(user);
    const parent = await parentService.linkParentToStudent({
      parentId,
      studentId: validatedData.studentId,
    });

    return NextResponse.json(parent, { status: 201 });
  } catch (error) {
    console.error('Error linking parent to student:', error);
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation error', details: error.flatten() },
        { status: 400 }
      );
    }
    const message = error instanceof Error ? error.message : 'Internal server error';
    // Service-specific errors
    if (message.includes('Unauthorized') || message.includes('Only ADMIN')) {
      return NextResponse.json({ error: message }, { status: 403 });
    }
    if (message.includes('already linked')) {
      return NextResponse.json({ error: message }, { status: 409 });
    }
    if (message.includes('not found')) {
      return NextResponse.json({ error: message }, { status: 404 });
    }
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/**
 * DELETE /api/parents/[parentId]/students
 * Unlink parent from student (ADMIN only)
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ parentId: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const normalizedRole = String(session.user.role ?? '').toUpperCase() as Role;
    
    // ADMIN only
    if (!isAdmin(normalizedRole)) {
      return NextResponse.json(
        { error: 'Forbidden: Only administrators can unlink parents from students' },
        { status: 403 }
      );
    }

    const parentId = (await params).parentId;
    if (!parentId) {
      return NextResponse.json({ error: 'Parent ID is required' }, { status: 400 });
    }

    const body = await request.json();
    const validatedData = linkStudentSchema.parse(body);

    const user = {
      id: session.user.id as string,
      role: normalizedRole,
      email: session.user.email as string | undefined,
      schoolId: session.user.schoolId as string | undefined,
    };

    const parentService = new ParentService(user);
    const result = await parentService.unlinkParentFromStudent({
      parentId,
      studentId: validatedData.studentId,
    });

    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    console.error('Error unlinking parent from student:', error);
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation error', details: error.flatten() },
        { status: 400 }
      );
    }
    const message = error instanceof Error ? error.message : 'Internal server error';
    // Service-specific errors
    if (message.includes('Unauthorized') || message.includes('Only ADMIN')) {
      return NextResponse.json({ error: message }, { status: 403 });
    }
    if (message.includes('not linked')) {
      return NextResponse.json({ error: message }, { status: 404 });
    }
    if (message.includes('not found')) {
      return NextResponse.json({ error: message }, { status: 404 });
    }
    return NextResponse.json({ error: message }, { status: 500 });
  }
}


import { getServerSession } from 'next-auth';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { authOptions, type Role } from '@/lib/auth';
import { ReportCardService } from '@/lib/services/report-card.service';

const getStudentReportCardSchema = z
  .object({
    studentId: z.string().trim().min(1, 'studentId is required'),
    termId: z.string().trim().min(1, 'termId is required'),
  })
  .strict();

function mapServiceErrorToStatus(message: string): number {
  if (message.startsWith('Unauthorized')) {
    return 403;
  }

  if (message.includes('not found')) {
    return 404;
  }

  if (
    message.includes('required') ||
    message.includes('must be') ||
    message.includes('cannot') ||
    message.includes('Invalid')
  ) {
    return 400;
  }

  return 500;
}

function normalizeRole(role: unknown): string {
  return String(role ?? '').toUpperCase();
}

/**
 * GET /api/report-cards?studentId=<studentId>&termId=<termId>
 * Returns a student report card
 * Accessible to ADMIN and STUDENT users
 */
export async function GET(request: Request) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const normalizedRole = normalizeRole(session.user.role);
    const canAccess =
      normalizedRole === 'ADMIN' ||
      normalizedRole === 'SUPER_ADMIN' ||
      normalizedRole === 'STUDENT';

    if (!canAccess) {
      return NextResponse.json(
        { error: 'Forbidden: Only ADMIN and STUDENT users can access report cards' },
        { status: 403 }
      );
    }

    if (!session.user.schoolId) {
      return NextResponse.json(
        { error: 'Unauthorized: User is not assigned to a school' },
        { status: 400 }
      );
    }

    const { searchParams } = new URL(request.url);
    const query = {
      studentId: searchParams.get('studentId') ?? undefined,
      termId: searchParams.get('termId') ?? undefined,
    };

    const validatedQuery = getStudentReportCardSchema.parse(query);

    const service = new ReportCardService({
      id: session.user.id as string,
      role: normalizedRole as Role,
      email: session.user.email ?? '',
      schoolId: session.user.schoolId,
    });

    const reportCard = await service.getStudentReportCard(
      validatedQuery.studentId,
      validatedQuery.termId
    );

    return NextResponse.json({ data: reportCard }, { status: 200 });
  } catch (error) {
    console.error('Error fetching report card:', error);

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation error', details: error.flatten() },
        { status: 400 }
      );
    }

    const message = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json(
      { error: message },
      { status: mapServiceErrorToStatus(message) }
    );
  }
}

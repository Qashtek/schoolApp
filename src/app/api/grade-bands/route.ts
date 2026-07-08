import { getServerSession } from 'next-auth';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { authOptions, type Role } from '@/lib/auth';
import { isAdmin } from '@/lib/permissions';
import { GradeBandService } from '@/lib/services/grade-band.service';

const levelSchema = z.enum(['JUNIOR', 'SENIOR']);

const updateGradeBandsSchema = z.object({
  level: levelSchema,
  bands: z.array(
    z.object({
      letter: z.string().trim().min(1, 'letter is required'),
      minScore: z.number().min(0).max(100),
      maxScore: z.number().min(0).max(100),
    })
  ).min(1, 'At least one grade band is required'),
}).strict();

function mapErrorStatus(message: string): number {
  if (message.startsWith('Unauthorized')) {
    return 403;
  }

  if (
    message.includes('required') ||
    message.includes('Invalid') ||
    message.includes('Duplicate') ||
    message.includes('Overlapping') ||
    message.includes('scores')
  ) {
    return 400;
  }

  return 500;
}

function normalizeSessionRole(role: unknown): string {
  return String(role ?? '').toUpperCase();
}

export async function GET(request: Request) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const normalizedRole = normalizeSessionRole(session.user.role);
    if (!isAdmin(normalizedRole as Role)) {
      return NextResponse.json(
        { error: 'Forbidden: Only administrators can access grade bands' },
        { status: 403 }
      );
    }

    if (!session.user.schoolId) {
      return NextResponse.json(
        { error: 'Unauthorized: Admin is not assigned to a school' },
        { status: 400 }
      );
    }

    const service = new GradeBandService({
      id: session.user.id as string,
      role: normalizedRole as Role,
      email: session.user.email ?? '',
      schoolId: session.user.schoolId,
    });

    const { searchParams } = new URL(request.url);
    const levelParam = searchParams.get('level');

    if (levelParam) {
      const level = levelSchema.parse(levelParam.toUpperCase());
      const bands = await service.getBandsByLevel(level);
      return NextResponse.json({ level, bands }, { status: 200 });
    }

    const bands = await service.getAllBands();
    return NextResponse.json({ bands }, { status: 200 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation error', details: error.flatten() },
        { status: 400 }
      );
    }

    const message = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json({ error: message }, { status: mapErrorStatus(message) });
  }
}

export async function PUT(request: Request) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const normalizedRole = normalizeSessionRole(session.user.role);
    if (!isAdmin(normalizedRole as Role)) {
      return NextResponse.json(
        { error: 'Forbidden: Only administrators can update grade bands' },
        { status: 403 }
      );
    }

    if (!session.user.schoolId) {
      return NextResponse.json(
        { error: 'Unauthorized: Admin is not assigned to a school' },
        { status: 400 }
      );
    }

    const body = await request.json();
    const validated = updateGradeBandsSchema.parse(body);

    const service = new GradeBandService({
      id: session.user.id as string,
      role: normalizedRole as Role,
      email: session.user.email ?? '',
      schoolId: session.user.schoolId,
    });

    const bands = await service.replaceBands(validated.level, validated.bands);

    return NextResponse.json(
      { message: `Grade bands updated for ${validated.level}`, data: bands },
      { status: 200 }
    );
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation error', details: error.flatten() },
        { status: 400 }
      );
    }

    const message = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json({ error: message }, { status: mapErrorStatus(message) });
  }
}

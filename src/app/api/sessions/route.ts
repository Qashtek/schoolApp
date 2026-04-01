import { getServerSession } from 'next-auth';
import type { Session } from 'next-auth';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { authOptions, Role } from '@/lib/auth';
import { SessionService } from '@/lib/services/session.service';

const createSessionSchema = z.object({
  name: z.string().trim().min(1, 'Name is required'),
}).strict();

function mapServiceErrorToStatus(message: string): number {
  if (message.startsWith('Unauthorized')) {
    return 403;
  }

  if (message.includes('already exists')) {
    return 409;
  }

  if (
    message.includes('required') ||
    message.includes('Invalid') ||
    message.includes('not assigned to a school')
  ) {
    return 400;
  }

  if (message.includes('not found')) {
    return 404;
  }

  return 500;
}

function normalizeAdminSession(session: Session | null) {
  if (!session?.user) {
    return {
      error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }),
    };
  }

  const normalizedRole = String(session.user.role ?? '').toUpperCase();
  if (normalizedRole !== 'ADMIN') {
    return {
      error: NextResponse.json(
        { error: 'Forbidden: Only ADMIN users can access sessions' },
        { status: 403 }
      ),
    };
  }

  if (!session.user.schoolId) {
    return {
      error: NextResponse.json(
        { error: 'Admin is not assigned to a school' },
        { status: 400 }
      ),
    };
  }

  return {
    user: {
      id: session.user.id as string,
      role: normalizedRole as Role,
      email: (session.user.email as string | undefined) ?? '',
      schoolId: session.user.schoolId,
    },
  };
}

/**
 * GET /api/sessions
 * Return all sessions with their terms for the admin's school
 */
export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    const auth = normalizeAdminSession(session);
    if (auth.error) {
      return auth.error;
    }

    const sessionService = new SessionService(auth.user);
    const sessions = await sessionService.getAllSessions();

    return NextResponse.json(sessions);
  } catch (error) {
    console.error('Error fetching sessions:', error);

    const message = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json(
      { error: message },
      { status: mapServiceErrorToStatus(message) }
    );
  }
}

/**
 * POST /api/sessions
 * Create a new academic session
 */
export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    const auth = normalizeAdminSession(session);
    if (auth.error) {
      return auth.error;
    }

    const body = await request.json();
    const validatedData = createSessionSchema.parse(body);

    const sessionService = new SessionService(auth.user);
    const createdSession = await sessionService.createSession(validatedData);

    return NextResponse.json(createdSession, { status: 201 });
  } catch (error) {
    console.error('Error creating session:', error);

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation error', details: error.issues },
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

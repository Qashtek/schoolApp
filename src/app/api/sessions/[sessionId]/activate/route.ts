import { getServerSession } from 'next-auth';
import type { Session } from 'next-auth';
import { NextResponse } from 'next/server';
import { authOptions, Role } from '@/lib/auth';
import { isAdmin } from '@/lib/permissions';
import { SessionService } from '@/lib/services/session.service';

function mapServiceErrorToStatus(message: string): number {
  if (message.startsWith('Unauthorized')) {
    return 403;
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
  if (!isAdmin(normalizedRole as Role)) {
    return {
      error: NextResponse.json(
        { error: 'Forbidden: Only administrators can activate sessions' },
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
 * POST /api/sessions/[sessionId]/activate
 * Set a session as active for the current admin's school
 */
export async function POST(
  _request: Request,
  { params }: { params: { sessionId: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    const auth = normalizeAdminSession(session);
    if (auth.error) {
      return auth.error;
    }

    const sessionId = params.sessionId?.trim();
    if (!sessionId) {
      return NextResponse.json(
        { error: 'Session ID is required' },
        { status: 400 }
      );
    }

    const sessionService = new SessionService(auth.user);
    const updatedSession = await sessionService.setActiveSession(sessionId);

    return NextResponse.json(updatedSession);
  } catch (error) {
    console.error('Error activating academic session:', error);

    const message = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json(
      { error: message },
      { status: mapServiceErrorToStatus(message) }
    );
  }
}

import { getServerSession } from 'next-auth';
import type { Session } from 'next-auth';
import { NextResponse } from 'next/server';
import { authOptions, Role } from '@/lib/auth';
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
  if (normalizedRole !== 'ADMIN') {
    return {
      error: NextResponse.json(
        { error: 'Forbidden: Only ADMIN users can activate terms' },
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
 * POST /api/sessions/[sessionId]/terms/[termId]/activate
 * Set a term as active for the specified session
 */
export async function POST(
  _request: Request,
  { params }: { params: { sessionId: string; termId: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    const auth = normalizeAdminSession(session);
    if (auth.error) {
      return auth.error;
    }

    const sessionId = params.sessionId?.trim();
    const termId = params.termId?.trim();

    if (!sessionId) {
      return NextResponse.json(
        { error: 'Session ID is required' },
        { status: 400 }
      );
    }

    if (!termId) {
      return NextResponse.json(
        { error: 'Term ID is required' },
        { status: 400 }
      );
    }

    const sessionService = new SessionService(auth.user);

    const terms = await sessionService.getTermsForSession(sessionId);
    const termInSession = terms.find((term) => term.id === termId);

    if (!termInSession) {
      return NextResponse.json(
        { error: 'Term not found in the specified session' },
        { status: 404 }
      );
    }

    const updatedTerm = await sessionService.setActiveTerm(termId);

    return NextResponse.json(updatedTerm);
  } catch (error) {
    console.error('Error activating term:', error);

    const message = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json(
      { error: message },
      { status: mapServiceErrorToStatus(message) }
    );
  }
}

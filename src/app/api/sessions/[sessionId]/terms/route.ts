import { getServerSession } from 'next-auth';
import type { Session } from 'next-auth';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { authOptions, Role } from '@/lib/auth';
import { isAdmin } from '@/lib/permissions';
import { SessionService } from '@/lib/services/session.service';

const createTermSchema = z.object({
  name: z.string().trim().min(1, 'Name is required'),
  startDate: z.coerce.date(),
  endDate: z.coerce.date(),
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
  if (!isAdmin(normalizedRole as Role)) {
    return {
      error: NextResponse.json(
        { error: 'Forbidden: Only administrators can manage terms' },
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
 * GET /api/sessions/[sessionId]/terms
 * Return all terms for a session
 */
export async function GET(
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
    const terms = await sessionService.getTermsForSession(sessionId);

    return NextResponse.json(terms);
  } catch (error) {
    console.error('Error fetching terms:', error);

    const message = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json(
      { error: message },
      { status: mapServiceErrorToStatus(message) }
    );
  }
}

/**
 * POST /api/sessions/[sessionId]/terms
 * Create a new term under the session
 */
export async function POST(
  request: Request,
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

    const body = await request.json();
    const validatedData = createTermSchema.parse(body);

    const sessionService = new SessionService(auth.user);
    const term = await sessionService.createTerm({
      name: validatedData.name,
      sessionId,
      startDate: validatedData.startDate,
      endDate: validatedData.endDate,
    });

    return NextResponse.json(term, { status: 201 });
  } catch (error) {
    console.error('Error creating term:', error);

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

import { getServerSession } from 'next-auth';
import type { Session } from 'next-auth';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { authOptions, Role } from '@/lib/auth';
import { SuperAdminService } from '@/lib/services/super-admin.service';

const createSchoolSchema = z.object({
  name: z.string().trim().min(1, 'School name is required'),
  address: z.string().trim().min(1, 'Address cannot be empty').optional(),
});

function mapServiceErrorToStatus(message: string): number {
  if (message.startsWith('Unauthorized')) {
    return 403;
  }

  if (message.includes('already exists')) {
    return 409;
  }

  if (message.includes('required') || message.includes('not found')) {
    return 400;
  }

  return 500;
}

function normalizeSuperAdminSession(session: Session | null) {
  if (!session?.user) {
    return {
      error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }),
    };
  }

  const normalizedRole = String(session.user.role ?? '').toUpperCase();
  if (normalizedRole !== 'SUPER_ADMIN') {
    return {
      error: NextResponse.json(
        { error: 'Forbidden: Only SUPER_ADMIN users can access this resource' },
        { status: 403 }
      ),
    };
  }

  return {
    user: {
      id: session.user.id as string,
      role: normalizedRole as Role,
      email: session.user.email as string | undefined,
    },
  };
}

/**
 * GET /api/super-admin/schools
 * List all schools
 */
export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    const auth = normalizeSuperAdminSession(session);
    if (auth.error) {
      return auth.error;
    }

    const service = new SuperAdminService(auth.user);
    const schools = await service.getAllSchools();

    return NextResponse.json({
      data: schools,
    });
  } catch (error) {
    console.error('Error fetching schools:', error);
    const message = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json(
      { error: message },
      { status: mapServiceErrorToStatus(message) }
    );
  }
}

/**
 * POST /api/super-admin/schools
 * Create a school
 */
export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    const auth = normalizeSuperAdminSession(session);
    if (auth.error) {
      return auth.error;
    }

    const body = await request.json();
    const validatedData = createSchoolSchema.parse(body);

    const service = new SuperAdminService(auth.user);
    const school = await service.createSchool(validatedData);

    return NextResponse.json(school, { status: 201 });
  } catch (error) {
    console.error('Error creating school:', error);

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

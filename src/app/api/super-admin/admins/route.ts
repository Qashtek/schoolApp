import { getServerSession } from 'next-auth';
import type { Session } from 'next-auth';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { authOptions, Role } from '@/lib/auth';
import { SuperAdminService } from '@/lib/services/super-admin.service';

const createAdminSchema = z.object({
  name: z.string().min(1, 'Admin name is required'),
  email: z.string().email('Valid email is required'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
  schoolId: z.string().min(1, 'School is required'),
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
 * GET /api/super-admin/admins
 * List all admins
 */
export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    const auth = normalizeSuperAdminSession(session);
    if (auth.error) {
      return auth.error;
    }

    const service = new SuperAdminService(auth.user);
    const admins = await service.getAllAdmins();

    return NextResponse.json({
      data: admins,
    });
  } catch (error) {
    console.error('Error fetching admins:', error);
    const message = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json(
      { error: message },
      { status: mapServiceErrorToStatus(message) }
    );
  }
}

/**
 * POST /api/super-admin/admins
 * Create an admin account scoped to a school
 */
export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    const auth = normalizeSuperAdminSession(session);
    if (auth.error) {
      return auth.error;
    }

    const body = await request.json();
    const validatedData = createAdminSchema.parse(body);

    const service = new SuperAdminService(auth.user);
    const admin = await service.createAdmin(validatedData);

    return NextResponse.json(admin, { status: 201 });
  } catch (error) {
    console.error('Error creating admin:', error);

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

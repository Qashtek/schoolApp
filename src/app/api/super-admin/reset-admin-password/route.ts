import { hash } from 'bcryptjs';
import { getServerSession } from 'next-auth/next';
import { NextResponse } from 'next/server';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);

    // Verify authentication and role
    if (!session?.user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    if (session.user.role !== 'SUPER_ADMIN') {
      return NextResponse.json(
        { error: 'Forbidden - Super admin access required' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { adminId } = body;

    if (!adminId) {
      return NextResponse.json(
        { error: 'Admin ID is required' },
        { status: 400 }
      );
    }

    // Get the admin user
    const adminUser = await prisma.user.findUnique({
      where: { id: adminId },
      select: { id: true, email: true, role: true }
    });

    if (!adminUser) {
      return NextResponse.json(
        { error: 'Admin not found' },
        { status: 404 }
      );
    }

    // Verify the user being reset is an admin
    if (adminUser.role !== 'ADMIN') {
      return NextResponse.json(
        { error: 'User is not an admin' },
        { status: 400 }
      );
    }

    // Extract email prefix as default password
    const emailPrefix = adminUser.email.split('@')[0];
    const defaultPassword = await hash(emailPrefix, 12);

    // Update the admin's password
    await prisma.user.update({
      where: { id: adminId },
      data: { password: defaultPassword }
    });

    return NextResponse.json(
      { success: true, message: 'Password has been reset successfully' },
      { status: 200 }
    );
  } catch (error) {
    console.error('Reset admin password error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

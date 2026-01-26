import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

/**
 * GET /api/classes
 * Get all classes for admin to assign to teachers
 */
export async function GET() {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.role || session.user.role !== 'ADMIN') {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const classes = await prisma.class.findMany({
      select: {
        id: true,
        name: true,
        grade: true,
        school: {
          select: {
            id: true,
            name: true,
          },
        },
        _count: {
          select: {
            teachers: true,
            students: true,
          },
        },
      },
      orderBy: [
        { grade: 'asc' },
        { name: 'asc' },
      ],
    });

    return NextResponse.json(classes);
  } catch (error) {
    console.error('Error fetching classes:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

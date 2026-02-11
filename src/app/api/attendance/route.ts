import { getServerSession } from 'next-auth';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { AttendanceService } from '@/lib/services/attendance.service';
import { authOptions, Role } from '@/lib/auth';

// Input validation schema for marking attendance
const markAttendanceSchema = z.object({
  classId: z.string().min(1, 'Class ID is required'),
  date: z.string().datetime().optional(), // ISO date string, defaults to today if not provided
  records: z.array(
    z.object({
      studentId: z.string().min(1, 'Student ID is required'),
      status: z.enum(['PRESENT', 'ABSENT', 'LATE']),
    })
  ).min(1, 'At least one attendance record is required'),
});

// Query validation schema for getting attendance
const getAttendanceSchema = z.object({
  classId: z.string().min(1, 'Class ID is required'),
  date: z.string().datetime().optional(),
});

/**
 * POST /api/attendance
 * Mark attendance for a class
 * Only teachers can mark attendance for their assigned classes
 */
export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    console.log('API SESSION USER:', session?.user);

    if (!session || session.user.role !== 'ADMIN') {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const body = await request.json();

    // Validate input
    const validatedData = markAttendanceSchema.parse(body);

    const user = {
      id: session.token.sub as string,
      role: session.token.role as Role,
      email: session.token.email as string | undefined,
    };

    const attendanceService = new AttendanceService(user);

    // Convert date string to Date object if provided, otherwise use today
    const date = validatedData.date ? new Date(validatedData.date) : new Date();

    const result = await attendanceService.markAttendance({
      classId: validatedData.classId,
      date,
      records: validatedData.records,
    });

    return NextResponse.json({
      message: 'Attendance marked successfully',
      data: result,
    }, { status: 201 });
  } catch (error) {
    console.error('Error marking attendance:', error);

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation error', details: error.issues },
        { status: 400 }
      );
    }

    const message = error instanceof Error ? error.message : 'Internal server error';
    
    // Handle specific errors with appropriate status codes
    if (message.includes('Unauthorized')) {
      return NextResponse.json(
        { error: message },
        { status: 403 }
      );
    }

    if (message.includes('already marked') || message.includes('not found') || message.includes('not assigned')) {
      return NextResponse.json(
        { error: message },
        { status: 409 }
      );
    }

    return NextResponse.json(
      { error: message },
      { status: 500 }
    );
  }
}

/**
 * GET /api/attendance
 * Get attendance records for a class
 * Only teachers can view attendance for their assigned classes
 */
export async function GET(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    console.log('API SESSION USER:', session?.user);

    if (!session || session.user.role !== 'ADMIN') {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const params = {
      classId: searchParams.get('classId') ?? undefined,
      date: searchParams.get('date') ?? undefined,
    };

    // Validate query parameters
    const validatedParams = getAttendanceSchema.parse(params);

    const user = {
      id: session.token.sub as string,
      role: session.token.role as Role,
      email: session.token.email as string | undefined,
    };

    const attendanceService = new AttendanceService(user);

    // Convert date string to Date object if provided, otherwise use today
    const date = validatedParams.date ? new Date(validatedParams.date) : new Date();

    const records = await attendanceService.getAttendanceForClass(
      validatedParams.classId,
      date
    );

    return NextResponse.json({
      data: records,
    });
  } catch (error) {
    console.error('Error fetching attendance:', error);

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid request parameters', details: error.issues },
        { status: 400 }
      );
    }

    const message = error instanceof Error ? error.message : 'Internal server error';
    
    // Handle specific errors with appropriate status codes
    if (message.includes('Unauthorized')) {
      return NextResponse.json(
        { error: message },
        { status: 403 }
      );
    }

    return NextResponse.json(
      { error: message },
      { status: 500 }
    );
  }
}

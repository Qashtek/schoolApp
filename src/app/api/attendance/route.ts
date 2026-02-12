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

// Input validation schema for marking single attendance
const markSingleAttendanceSchema = z.object({
  classId: z.string().min(1, 'Class ID is required'),
  studentId: z.string().min(1, 'Student ID is required'),
  status: z.enum(['PRESENT', 'ABSENT', 'LATE']),
});

// Query validation schema for getting attendance
const getAttendanceSchema = z.object({
  classId: z.string().min(1, 'Class ID is required'),
  date: z.string().datetime().optional(),
});

const ATTENDANCE_STATUSES = ['PRESENT', 'ABSENT', 'LATE'] as const;

function isFormRequest(request: Request): boolean {
  const contentType = request.headers.get('content-type') ?? '';
  return (
    contentType.includes('application/x-www-form-urlencoded') ||
    contentType.includes('multipart/form-data')
  );
}

function buildRedirectUrl(request: Request, key: 'success' | 'error', message: string): URL {
  const requestUrl = new URL(request.url);
  const returnToParam = requestUrl.searchParams.get('returnTo');
  const returnTo = returnToParam?.startsWith('/')
    ? returnToParam
    : '/dashboard/teacher/students';
  const redirectUrl = new URL(returnTo, requestUrl.origin);
  redirectUrl.searchParams.set(key, message);
  return redirectUrl;
}

/**
 * POST /api/attendance
 * Mark attendance for a class
 * Only teachers can mark attendance for their assigned classes
 */
export async function POST(request: Request) {
  const formRequest = isFormRequest(request);
  try {
    const session = await getServerSession(authOptions);
    console.log('API SESSION USER:', session?.user);

    if (!session?.user || session.user.role !== 'TEACHER') {
      if (formRequest) {
        return NextResponse.redirect(
          buildRedirectUrl(request, 'error', 'Unauthorized'),
          { status: 303 }
        );
      }
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const user = {
      id: session.user.id,
      role: session.user.role as Role,
      email: session.user.email ?? '',
      schoolId: session.user.schoolId,
    };

    const attendanceService = new AttendanceService(user);

    // Handle single attendance marking
    if (!formRequest && request.method === 'POST') {
      const body = await request.json();

      // Validate input for single attendance
      const validatedData = markSingleAttendanceSchema.parse(body);

      const result = await attendanceService.markSingleAttendance({
        classId: validatedData.classId,
        studentId: validatedData.studentId,
        status: validatedData.status,
      });

      return NextResponse.json({
        success: true,
        attendance: result,
      }, { status: 200 });
    }

    if (formRequest) {
      const formData = await request.formData();
      const classId = String(formData.get('classId') ?? '').trim();

      if (!classId) {
        return NextResponse.redirect(
          buildRedirectUrl(request, 'error', 'Class ID is required'),
          { status: 303 }
        );
      }

      const records = Array.from(formData.entries())
        .filter(([key]) => key.startsWith('status_'))
        .map(([key, value]) => {
          const studentId = key.replace('status_', '');
          const status = String(value);
          if (!ATTENDANCE_STATUSES.includes(status as (typeof ATTENDANCE_STATUSES)[number])) {
            throw new Error(`Invalid attendance status for student ${studentId}`);
          }
          return {
            studentId,
            status: status as 'PRESENT' | 'ABSENT' | 'LATE',
          };
        });

      if (records.length === 0) {
        return NextResponse.redirect(
          buildRedirectUrl(request, 'error', 'At least one attendance record is required'),
          { status: 303 }
        );
      }

      await attendanceService.markAttendance({
        classId,
        date: new Date(),
        records,
      });

      return NextResponse.redirect(
        buildRedirectUrl(request, 'success', 'Attendance marked successfully'),
        { status: 303 }
      );
    }

    const body = await request.json();

    // Validate input
    const validatedData = markAttendanceSchema.parse(body);

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

    if (formRequest) {
      const message = error instanceof Error ? error.message : 'Internal server error';
      return NextResponse.redirect(
        buildRedirectUrl(request, 'error', message),
        { status: 303 }
      );
    }

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

    if (!session?.user || session.user.role !== 'TEACHER') {
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
      id: session.user.id,
      role: session.user.role as Role,
      email: session.user.email ?? '',
    };

    const attendanceService = new AttendanceService(user);

    // Convert date string to Date object if provided, otherwise use today
    const date = validatedParams.date ? new Date(validatedParams.date) : new Date();

    const records = await attendanceService.getAttendanceForClassAndDate(
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

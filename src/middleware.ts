import { withAuth } from 'next-auth/middleware';
import { NextResponse } from 'next/server';

function matchesPrefix(pathname: string, prefix: string) {
  return pathname === prefix || pathname.startsWith(`${prefix}/`);
}

function getRoleDashboard(role: string) {
  if (role === 'SUPER_ADMIN') return '/dashboard/super-admin';
  if (role === 'ADMIN') return '/dashboard/admin';
  if (role === 'TEACHER') return '/dashboard/teacher';
  if (role === 'STUDENT') return '/dashboard/student';
  if (role === 'PARENT') return '/dashboard/parent';
  return '/dashboard';
}

export default withAuth(
  function middleware(req) {
    const { pathname } = req.nextUrl;
    const token = req.nextauth.token;
    const isAuthenticated = Boolean(token);

    const isLoginRoute = pathname === '/login';
    const isApiAuthRoute = matchesPrefix(pathname, '/api/auth');
    const isPublicRoute = isLoginRoute || isApiAuthRoute;

    const isAdminDashboard = matchesPrefix(pathname, '/dashboard/admin');
    const isTeacherDashboard = matchesPrefix(pathname, '/dashboard/teacher');
    const isStudentDashboard = matchesPrefix(pathname, '/dashboard/student');
    const isParentDashboard = matchesPrefix(pathname, '/dashboard/parent');
    const isSuperAdminDashboard = matchesPrefix(pathname, '/dashboard/super-admin');

    const isProtectedDashboardRoute =
      isAdminDashboard ||
      isTeacherDashboard ||
      isStudentDashboard ||
      isParentDashboard ||
      isSuperAdminDashboard;

    const isProtectedApiRoute =
      matchesPrefix(pathname, '/api/students') ||
      matchesPrefix(pathname, '/api/teachers') ||
      matchesPrefix(pathname, '/api/classes') ||
      matchesPrefix(pathname, '/api/subjects') ||
      matchesPrefix(pathname, '/api/grades') ||
      matchesPrefix(pathname, '/api/attendance') ||
      matchesPrefix(pathname, '/api/parents') ||
      matchesPrefix(pathname, '/api/sessions') ||
      matchesPrefix(pathname, '/api/grade-bands') ||
      matchesPrefix(pathname, '/api/report-cards') ||
      matchesPrefix(pathname, '/api/super-admin');

    if (isPublicRoute) {
      return NextResponse.next();
    }

    if (!isAuthenticated && isProtectedApiRoute) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    if (!isAuthenticated && isProtectedDashboardRoute) {
      return NextResponse.redirect(new URL('/login', req.url));
    }

    if (!isAuthenticated) {
      return NextResponse.next();
    }

    if (isProtectedDashboardRoute) {
      const userRole = String(token?.role ?? '');
      const roleDashboard = getRoleDashboard(userRole);

      if (isSuperAdminDashboard && userRole !== 'SUPER_ADMIN') {
        return NextResponse.redirect(new URL(roleDashboard, req.url));
      }

      if (isAdminDashboard && userRole !== 'ADMIN') {
        return NextResponse.redirect(new URL(roleDashboard, req.url));
      }

      if (isTeacherDashboard && userRole !== 'TEACHER') {
        return NextResponse.redirect(new URL(roleDashboard, req.url));
      }

      if (isStudentDashboard && userRole !== 'STUDENT') {
        return NextResponse.redirect(new URL(roleDashboard, req.url));
      }

      if (isParentDashboard && userRole !== 'PARENT') {
        return NextResponse.redirect(new URL(roleDashboard, req.url));
      }
    }

    return NextResponse.next();
  },
  {
    callbacks: {
      authorized: () => true,
    },
  }
);

export const config = {
  matcher: [
    '/dashboard/admin/:path*',
    '/dashboard/teacher/:path*',
    '/dashboard/student/:path*',
    '/dashboard/parent/:path*',
    '/dashboard/super-admin/:path*',
    '/api/students/:path*',
    '/api/teachers/:path*',
    '/api/classes/:path*',
    '/api/subjects/:path*',
    '/api/grades/:path*',
    '/api/attendance/:path*',
    '/api/parents/:path*',
    '/api/sessions/:path*',
    '/api/grade-bands/:path*',
    '/api/report-cards/:path*',
    '/api/super-admin/:path*',
    '/login',
    '/api/auth/:path*',
  ],
};

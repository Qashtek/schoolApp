import { withAuth } from 'next-auth/middleware'
import { NextResponse } from 'next/server'

export default withAuth(
  function middleware(req) {
    const token = req.nextauth.token
    const isAuth = !!token
    const isAuthPage = req.nextUrl.pathname.startsWith('/login')
    const isApiAuthRoute = req.nextUrl.pathname.startsWith('/api/auth')
    const isDashboardRoute = req.nextUrl.pathname.startsWith('/dashboard')

    // Allow API auth routes to pass through
    if (isApiAuthRoute) {
      return NextResponse.next()
    }

    // Handle login page specially
    if (isAuthPage) {
      // Allow authenticated users to access login page (for logout purposes)
      return NextResponse.next()
    }

    // Only redirect to login if trying to access protected dashboard routes
    if (!isAuth && isDashboardRoute) {
      let from = req.nextUrl.pathname
      if (req.nextUrl.search) {
        from += req.nextUrl.search
      }

      return NextResponse.redirect(
        new URL(`/login?from=${encodeURIComponent(from)}`, req.url)
      )
    }

    // Role-based protection for dashboard routes
    if (isDashboardRoute) {
      const userRole = token.role as string

      if (req.nextUrl.pathname.startsWith('/dashboard/admin')) {
        if (userRole !== 'ADMIN' && userRole !== 'SUPER_ADMIN') {
          return NextResponse.redirect(new URL('/dashboard', req.url))
        }
      }

      if (req.nextUrl.pathname.startsWith('/dashboard/teacher')) {
        if (userRole !== 'TEACHER') {
          return NextResponse.redirect(new URL('/dashboard', req.url))
        }
      }

      if (req.nextUrl.pathname.startsWith('/dashboard/student')) {
        if (userRole !== 'STUDENT') {
          return NextResponse.redirect(new URL('/dashboard', req.url))
        }
      }

      if (req.nextUrl.pathname.startsWith('/dashboard/parent')) {
        if (userRole !== 'PARENT') {
          return NextResponse.redirect(new URL('/dashboard', req.url))
        }
      }
    }

    return NextResponse.next()
  },
  {
    callbacks: {
      authorized: () => true, // Let the middleware function handle authorization
    },
  }
)

export const config = {
  matcher: ['/dashboard/:path*', '/login', '/api/auth/:path*'],
}

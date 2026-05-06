import { getServerSession } from 'next-auth';
import { redirect } from 'next/navigation';
import { authOptions } from '@/lib/auth';
import Link from 'next/link';
import { Users, GraduationCap, BookOpen, LayoutDashboard } from 'lucide-react';

export default async function DashboardPage() {
  const session = await getServerSession(authOptions);

  // If no session, redirect to login
  if (!session?.user) {
    redirect('/login');
  }

  const userRole = session.user.role;

  // Redirect to role-specific dashboard
  if (userRole === 'ADMIN') {
    redirect('/dashboard/admin');
  }

  if (userRole === 'SUPER_ADMIN') {
    redirect('/dashboard/super-admin');
  }

  if (userRole === 'TEACHER') {
    redirect('/dashboard/teacher');
  }

  if (userRole === 'STUDENT') {
    redirect('/dashboard/student');
  }

  if (userRole === 'PARENT') {
    redirect('/dashboard/parent');
  }

  // Fallback - show dashboard landing
  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <h1 className="text-2xl font-semibold text-gray-900">
            Dashboard
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            Welcome, {session.user.name || 'User'}
          </p>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {/* Admin Card */}
          <Link 
            href="/dashboard/admin"
            className="bg-white rounded-lg shadow-sm border border-gray-100 p-6 hover:shadow-md transition-shadow duration-200 block"
          >
            <div className="flex items-center gap-4">
              <div className="p-3 bg-blue-50 rounded-lg">
                <Users className="w-6 h-6 text-blue-600" />
              </div>
              <div>
                <h2 className="text-lg font-medium text-gray-900">Admin</h2>
                <p className="text-sm text-gray-500">Manage school</p>
              </div>
            </div>
          </Link>

          {/* Teacher Card */}
          <Link 
            href="/dashboard/teacher"
            className="bg-white rounded-lg shadow-sm border border-gray-100 p-6 hover:shadow-md transition-shadow duration-200 block"
          >
            <div className="flex items-center gap-4">
              <div className="p-3 bg-green-50 rounded-lg">
                <GraduationCap className="w-6 h-6 text-green-600" />
              </div>
              <div>
                <h2 className="text-lg font-medium text-gray-900">Teacher</h2>
                <p className="text-sm text-gray-500">My classes</p>
              </div>
            </div>
          </Link>

          {/* Student Card */}
          <Link 
            href="/dashboard/student"
            className="bg-white rounded-lg shadow-sm border border-gray-100 p-6 hover:shadow-md transition-shadow duration-200 block"
          >
            <div className="flex items-center gap-4">
              <div className="p-3 bg-purple-50 rounded-lg">
                <BookOpen className="w-6 h-6 text-purple-600" />
              </div>
              <div>
                <h2 className="text-lg font-medium text-gray-900">Student</h2>
                <p className="text-sm text-gray-500">My grades</p>
              </div>
            </div>
          </Link>

          {/* Parent Card */}
          <Link 
            href="/dashboard/parent"
            className="bg-white rounded-lg shadow-sm border border-gray-100 p-6 hover:shadow-md transition-shadow duration-200 block"
          >
            <div className="flex items-center gap-4">
              <div className="p-3 bg-amber-50 rounded-lg">
                <LayoutDashboard className="w-6 h-6 text-amber-600" />
              </div>
              <div>
                <h2 className="text-lg font-medium text-gray-900">Parent</h2>
                <p className="text-sm text-gray-500">My children</p>
              </div>
            </div>
          </Link>
        </div>
      </main>
    </div>
  );
}

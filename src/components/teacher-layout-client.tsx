

'use client';

import { Session } from 'next-auth';
import Link from 'next/link';
import { LayoutDashboard, BookOpen, LogOut } from 'lucide-react';
import { useEffect } from 'react';
import { signOut } from 'next-auth/react';

interface TeacherLayoutClientProps {
  session: Session;
  children: React.ReactNode;
}

export function TeacherLayoutClient({ session, children }: TeacherLayoutClientProps) {
  useEffect(() => {
    const handlePopState = () => {
      if (!window.location.pathname.startsWith('/dashboard/teacher')) {
        signOut({ callbackUrl: '/login' });
      }
    };

    window.addEventListener('popstate', handlePopState);

    return () => {
      window.removeEventListener('popstate', handlePopState);
    };
  }, []);

  return (
    <div className="min-h-screen bg-gray-50 flex">
      {/* Sidebar */}
      <aside className="w-64 bg-white border-r border-gray-200 flex flex-col">
        {/* Logo/Brand */}
        <div className="p-6 border-b border-gray-200">
          <h1 className="text-xl font-semibold text-gray-900">Teacher Portal</h1>
          <p className="text-sm text-gray-500 mt-1">School Management</p>
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-4 space-y-1">
          <Link
            href="/dashboard/teacher"
            className="flex items-center gap-3 px-3 py-2 text-sm font-medium text-gray-700 rounded-lg hover:bg-gray-100 transition-colors"
          >
            <LayoutDashboard className="w-5 h-5" />
            Dashboard
          </Link>
          <Link
            href="/dashboard/teacher/attendance"
            className="flex items-center gap-3 px-3 py-2 text-sm font-medium text-gray-700 rounded-lg hover:bg-gray-100 transition-colors"
          >
            <BookOpen className="w-5 h-5" />
            Attendance
          </Link>
        </nav>

        {/* User info & logout */}
        <div className="p-4 border-t border-gray-200">
          <div className="flex items-center gap-3 px-3 py-2 mb-2">
            <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
              <span className="text-sm font-medium text-blue-600">
                {session.user.name?.charAt(0) || 'T'}
              </span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-gray-900 truncate">
                {session.user.name || 'Teacher'}
              </p>
              <p className="text-xs text-gray-500 truncate">
                {session.user.email}
              </p>
            </div>
          </div>
          <form action="/api/auth/signout" method="POST">
            <button
              type="submit"
              className="w-full flex items-center gap-2 px-3 py-2 text-sm font-medium text-red-600 rounded-lg hover:bg-red-50 transition-colors"
            >
              <LogOut className="w-4 h-4" />
              Sign out
            </button>
          </form>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-auto">
        {children}
      </main>
    </div>
  );
}


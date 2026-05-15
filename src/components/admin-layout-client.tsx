'use client';

import { Session } from 'next-auth';
import Link from 'next/link';
import {
  LayoutDashboard,
  Users,
  BookOpen,
  GraduationCap,
  LogOut,
  CheckCircle,
  Calendar,
  CalendarDays,
  FileCheck,
  FileText,
  Lock,
  Settings,
} from 'lucide-react';
import { useEffect } from 'react';
import { signOut } from 'next-auth/react';

interface AdminLayoutClientProps {
  session: Session;
  children: React.ReactNode;
}

export function AdminLayoutClient({ session, children }: AdminLayoutClientProps) {
  useEffect(() => {
    const handlePopState = () => {
      if (!window.location.pathname.startsWith('/dashboard/admin')) {
        signOut({ callbackUrl: '/login' });
      }
    };

    window.addEventListener('popstate', handlePopState);

    return () => {
      window.removeEventListener('popstate', handlePopState);
    };
  }, []);

  return (
    <div className="flex h-screen overflow-hidden bg-gray-50">
      {/* Sidebar */}
      <aside className="flex h-screen w-64 shrink-0 flex-col border-r border-gray-200 bg-white">
        {/* Logo/Brand */}
        <div className="p-6 border-b border-gray-200">
          <h1 className="text-xl font-semibold text-gray-900">Admin Portal</h1>
          <p className="text-sm text-gray-500 mt-1">School Management</p>
        </div>

        {/* Navigation */}
        <nav className="flex-1 space-y-1 overflow-y-auto p-4">
          <Link
            href="/dashboard/admin"
            className="flex items-center gap-3 px-3 py-2 text-sm font-medium text-gray-700 rounded-lg hover:bg-gray-100 transition-colors"
          >
            <LayoutDashboard className="w-5 h-5" />
            Dashboard
          </Link>
          <Link
            href="/dashboard/admin/teachers"
            className="flex items-center gap-3 px-3 py-2 text-sm font-medium text-gray-700 rounded-lg hover:bg-gray-100 transition-colors"
          >
            <Users className="w-5 h-5" />
            Teachers
          </Link>
          <Link
            href="/dashboard/admin/students"
            className="flex items-center gap-3 px-3 py-2 text-sm font-medium text-gray-700 rounded-lg hover:bg-gray-100 transition-colors"
          >
            <GraduationCap className="w-5 h-5" />
            Students
          </Link>
          <Link
            href="/dashboard/admin/classes"
            className="flex items-center gap-3 px-3 py-2 text-sm font-medium text-gray-700 rounded-lg hover:bg-gray-100 transition-colors"
          >
            <BookOpen className="w-5 h-5" />
            Classes
          </Link>
          <Link
            href="/dashboard/admin/subjects"
            className="flex items-center gap-3 px-3 py-2 text-sm font-medium text-gray-700 rounded-lg hover:bg-gray-100 transition-colors"
          >
            <Calendar className="w-5 h-5" />
            Subjects
          </Link>
          <Link
            href="/dashboard/admin/sessions"
            className="flex items-center gap-3 px-3 py-2 text-sm font-medium text-gray-700 rounded-lg hover:bg-gray-100 transition-colors"
          >
            <CalendarDays className="w-5 h-5" />
            Academic Sessions
          </Link>
          <Link
            href="/dashboard/admin/attendance"
            className="flex items-center gap-3 px-3 py-2 text-sm font-medium text-gray-700 rounded-lg hover:bg-gray-100 transition-colors"
          >
            <CheckCircle className="w-5 h-5" />
            Attendance
          </Link>
          <Link
            href="/dashboard/admin/grades"
            className="flex items-center gap-3 px-3 py-2 text-sm font-medium text-gray-700 rounded-lg hover:bg-gray-100 transition-colors"
          >
            <FileText className="w-5 h-5" />
            Grades
          </Link>
          <Link
            href="/dashboard/admin/report-cards"
            className="flex items-center gap-3 px-3 py-2 text-sm font-medium text-gray-700 rounded-lg hover:bg-gray-100 transition-colors"
          >
            <FileCheck className="w-5 h-5" />
            Report Cards
          </Link>
          <Link
            href="/dashboard/admin/change-password"
            className="flex items-center gap-3 px-3 py-2 text-sm font-medium text-gray-700 rounded-lg hover:bg-gray-100 transition-colors"
          >
            <Lock className="w-5 h-5" />
            Change Password
          </Link>
          <Link
            href="/dashboard/admin/settings"
            className="flex items-center gap-3 px-3 py-2 text-sm font-medium text-gray-700 rounded-lg hover:bg-gray-100 transition-colors"
          >
            <Settings className="w-5 h-5" />
            Settings
          </Link>
        </nav>

        {/* User info & logout */}
        <div className="p-4 border-t border-gray-200">
          <div className="flex items-center gap-3 px-3 py-2 mb-2">
            <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
              <span className="text-sm font-medium text-blue-600">
                {session.user.name?.charAt(0) || 'A'}
              </span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-gray-900 truncate">
                {session.user.name || 'Admin'}
              </p>
              <p className="text-xs text-gray-500 truncate">
                {session.user.email}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => signOut({ callbackUrl: '/login' })}
            className="w-full flex items-center gap-2 px-3 py-2 text-sm font-medium text-red-600 rounded-lg hover:bg-red-50 transition-colors"
          >
            <LogOut className="w-4 h-4" />
            Sign out
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="h-screen flex-1 overflow-y-auto p-6">
        {children}
      </main>
    </div>
  );
}

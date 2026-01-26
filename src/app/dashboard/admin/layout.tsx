
import { getServerSession } from 'next-auth';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LayoutDashboard, Users, GraduationCap, BookOpen, Calendar, LogOut } from 'lucide-react';
import { authOptions } from '@/lib/auth';

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getServerSession(authOptions);

  // Role check
  if (!session?.user?.role || !['ADMIN', 'SUPER_ADMIN'].includes(session.user.role)) {
    redirect('/dashboard');
  }

  const navItems = [
    { label: 'Dashboard', href: '/dashboard/admin', icon: LayoutDashboard },
    { label: 'Students', href: '/dashboard/admin/students', icon: Users },
    { label: 'Teachers', href: '/dashboard/admin/teachers', icon: GraduationCap },
    { label: 'Classes', href: '/dashboard/admin/classes', icon: BookOpen },
    { label: 'Academic Sessions', href: '/dashboard/admin/sessions', icon: Calendar },
  ];

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Sidebar */}
      <aside className="fixed inset-y-0 left-0 w-64 bg-white border-r border-gray-200">
        <div className="flex flex-col h-full">
          {/* Logo */}
          <div className="flex items-center h-16 px-6 border-b border-gray-200">
            <h1 className="text-xl font-semibold text-gray-900">SchoolAdmin</h1>
          </div>

          {/* Navigation */}
          <nav className="flex-1 px-4 py-6 space-y-1 overflow-y-auto">
            {navItems.map((item) => {
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className="flex items-center gap-3 px-3 py-2 text-sm font-medium text-gray-700 rounded-md hover:bg-gray-100 hover:text-gray-900 transition-colors"
                >
                  <Icon className="w-5 h-5" />
                  {item.label}
                </Link>
              );
            })}
          </nav>

          {/* User section */}
          <div className="p-4 border-t border-gray-200">
            <div className="flex items-center gap-3 mb-3">
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
            <form action="/api/auth/signout" method="POST">
              <button
                type="submit"
                className="flex items-center gap-2 w-full px-3 py-2 text-sm font-medium text-gray-700 rounded-md hover:bg-gray-100 transition-colors"
              >
                <LogOut className="w-4 h-4" />
                Sign Out
              </button>
            </form>
          </div>
        </div>
      </aside>

      {/* Main content */}
      <div className="pl-64">
        {/* Top bar */}
        <header className="h-16 bg-white border-b border-gray-200 flex items-center justify-between px-6">
          <div>
            <h2 className="text-lg font-medium text-gray-900">Admin Portal</h2>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-sm text-gray-500">
              {session.user.role}
            </span>
          </div>
        </header>

        {/* Page content */}
        <main className="p-6">
          {children}
        </main>
      </div>
    </div>
  );
}


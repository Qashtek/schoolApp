'use client';

import { Session } from 'next-auth';
import { AdminSidebar } from '@/components/admin-sidebar';

interface AdminLayoutClientProps {
  session: Session;
  children: React.ReactNode;
}

export function AdminLayoutClient({ session, children }: AdminLayoutClientProps) {
  return (
    <div className="min-h-screen bg-gray-100">
      <AdminSidebar />

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

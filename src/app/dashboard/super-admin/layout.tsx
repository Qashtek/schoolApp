import Link from 'next/link';
import { getServerSession } from 'next-auth';
import { redirect } from 'next/navigation';
import { authOptions } from '@/lib/auth';
import { LogoutButton } from '@/components/logout-button';

const navItems = [
  { label: 'Dashboard', href: '/dashboard/super-admin' },
  { label: 'Schools', href: '/dashboard/super-admin/schools' },
  { label: 'Admins', href: '/dashboard/super-admin/admins' },
  { label: 'Create School', href: '/dashboard/super-admin/schools/new' },
  { label: 'Create Admin', href: '/dashboard/super-admin/admins/new' },
  { label: 'Change Password', href: '/dashboard/super-admin/change-password' },
];

export default async function SuperAdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    redirect('/login');
  }

  if (session.user.role !== 'SUPER_ADMIN') {
    redirect('/dashboard');
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="mx-auto grid max-w-7xl gap-6 px-4 py-6 md:grid-cols-[240px_minmax(0,1fr)] md:px-6 lg:px-8">
        <aside className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500">
            Super Admin
          </h2>

          <nav className="mt-3 space-y-1">
            {navItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="block rounded-md px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100"
              >
                {item.label}
              </Link>
            ))}
          </nav>

          <div className="mt-4 border-t border-gray-200 pt-4">
            <p className="mb-2 text-xs text-gray-500">{session.user.email}</p>
            <LogoutButton />
          </div>
        </aside>

        <main>{children}</main>
      </div>
    </div>
  );
}

'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LayoutDashboard, Users, GraduationCap, BookOpen, Calendar, CheckCircle } from 'lucide-react';

const navItems = [
  { label: 'Dashboard', href: '/dashboard/admin', icon: LayoutDashboard },
  { label: 'Students', href: '/dashboard/admin/students', icon: Users },
  { label: 'Teachers', href: '/dashboard/admin/teachers', icon: GraduationCap },
  { label: 'Classes', href: '/dashboard/admin/classes', icon: BookOpen },
  { label: 'Subjects', href: '/dashboard/admin/subjects', icon: Calendar },
  { label: 'Attendance', href: '/dashboard/admin/attendance', icon: CheckCircle },
];

export function AdminNav() {
  const pathname = usePathname();

  return (
    <nav className="flex-1 px-4 py-6">
      <ul className="space-y-2">
        {navItems.map((item) => {
          const isActive = pathname === item.href;
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                className={`flex items-center gap-3 px-3 py-2 text-sm font-medium rounded-md transition-colors ${
                  isActive
                    ? 'bg-blue-50 text-blue-700 border-r-2 border-blue-700'
                    : 'text-gray-700 hover:bg-gray-100'
                }`}
              >
                <item.icon className="w-5 h-5" />
                {item.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

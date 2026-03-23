
import { getServerSession } from 'next-auth';
import { redirect } from 'next/navigation';
import { authOptions } from '@/lib/auth';
import { Users, GraduationCap, Calendar, BookOpen } from 'lucide-react';
import Link from 'next/link';

export default async function AdminDashboard() {
  const session = await getServerSession(authOptions);

  // Redirect to login if not authenticated
  if (!session?.user) {
    redirect('/login');
  }

  // Additional role check - only admins can access
  if (!session.user.role || !['ADMIN', 'SUPER_ADMIN'].includes(session.user.role)) {
    redirect('/dashboard');
  }

  return (
    <div>
      {/* Page header */}
      <div className="mb-8">
        <h1 className="text-2xl font-semibold text-gray-900">
          Admin Dashboard
        </h1>
        <p className="mt-1 text-sm text-gray-500">
          Welcome back, {session.user.email}
        </p>
      </div>

      {/* Dashboard Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">

        {/* Students Section */}
        <Link href="/dashboard/admin/students" className="block">
          <section className="bg-white rounded-lg shadow-sm border border-gray-100 p-6 hover:shadow-md transition-shadow duration-200 h-full">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-blue-50 rounded-lg">
                <GraduationCap className="w-6 h-6 text-blue-600" />
              </div>
              <div>
                <h2 className="text-lg font-medium text-gray-900">Students</h2>
                <p className="text-sm text-gray-500">Manage student records</p>
              </div>
            </div>
          </section>
        </Link>

        {/* Teachers Section */}
        <Link href="/dashboard/admin/teachers" className="block">
          <section className="bg-white rounded-lg shadow-sm border border-gray-100 p-6 hover:shadow-md transition-shadow duration-200 h-full">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-green-50 rounded-lg">
                <Users className="w-6 h-6 text-green-600" />
              </div>
              <div>
                <h2 className="text-lg font-medium text-gray-900">Teachers</h2>
                <p className="text-sm text-gray-500">Manage faculty members</p>
              </div>
            </div>
          </section>
        </Link>

        {/* Classes Section */}
        <Link href="/dashboard/admin/classes" className="block">
          <section className="bg-white rounded-lg shadow-sm border border-gray-100 p-6 hover:shadow-md transition-shadow duration-200 h-full">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-purple-50 rounded-lg">
                <BookOpen className="w-6 h-6 text-purple-600" />
              </div>
              <div>
                <h2 className="text-lg font-medium text-gray-900">Classes</h2>
                <p className="text-sm text-gray-500">Organize class schedules</p>
              </div>
            </div>
          </section>
        </Link>

        {/* Subjects Section */}
        <Link href="/dashboard/admin/subjects" className="block">
          <section className="bg-white rounded-lg shadow-sm border border-gray-100 p-6 hover:shadow-md transition-shadow duration-200 h-full">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-amber-50 rounded-lg">
                <Calendar className="w-6 h-6 text-amber-600" />
              </div>
              <div>
                <h2 className="text-lg font-medium text-gray-900">Subjects</h2>
                <p className="text-sm text-gray-500">Manage subject catalog</p>
              </div>
            </div>
          </section>
        </Link>

      </div>
    </div>
  );
}

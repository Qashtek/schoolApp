import { redirect } from 'next/navigation';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { isAdmin } from '@/lib/permissions';
import { ClassService } from '@/lib/services/class.service';
import Link from 'next/link';

export default async function AdminClassesPage() {
  const session = await getServerSession(authOptions);

  if (!session?.user?.role || !isAdmin(session.user.role)) {
    redirect('/dashboard');
  }

  const classService = new ClassService({
    id: session.user.id,
    email: session.user.email,
    name: session.user.name,
    role: session.user.role,
    schoolId: session.user.schoolId,
  });

  const { classes } = await classService.getAllClasses();

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold">Classes</h1>
        <Link
          href="/dashboard/admin/classes/new"
          className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
        >
          Create New Class
        </Link>
      </div>

      <div className="bg-white shadow rounded-lg">
        <div className="px-4 py-5 sm:p-6">
          {classes.length === 0 ? (
            <p className="text-gray-500">No classes found.</p>
          ) : (
            <div className="space-y-4">
              {classes.map((classItem) => (
                <div key={classItem.id} className="border rounded-lg p-4">
                  <div className="flex justify-between items-start">
                    <div>
                      <h3 className="text-lg font-medium">{classItem.name}</h3>
                      <p className="text-sm text-gray-600">Grade: {classItem.grade}</p>
                      {classItem.description && (
                        <p className="text-sm text-gray-600 mt-1">{classItem.description}</p>
                      )}
                      {classItem.school && (
                        <p className="text-sm text-gray-600">School: {classItem.school.name}</p>
                      )}
                    </div>
                    <div className="text-right">
                      <p className="text-sm text-gray-600">
                        Students: {classItem._count.students}
                      </p>
                    </div>
                  </div>

                  <div className="mt-4">
                    <h4 className="text-sm font-medium text-gray-900">Assigned Teachers:</h4>
                    {classItem.teachers.length === 0 ? (
                      <p className="text-sm text-gray-500 mt-1">No teachers assigned</p>
                    ) : (
                      <div className="mt-2 space-y-1">
                        {classItem.teachers.map((teacherClass) => (
                          <div key={teacherClass.id} className="text-sm text-gray-600">
                            {teacherClass.teacher.user.name} ({teacherClass.teacher.user.email})
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

import Link from 'next/link';
import { getServerSession } from 'next-auth';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { authOptions, Role } from '@/lib/auth';
import { SuperAdminService } from '@/lib/services/super-admin.service';

async function createAdminAction(formData: FormData) {
  'use server';

  const session = await getServerSession(authOptions);

  if (!session?.user || session.user.role !== 'SUPER_ADMIN') {
    redirect('/dashboard');
  }

  const name = String(formData.get('name') ?? '').trim();
  const email = String(formData.get('email') ?? '').trim();
  const password = String(formData.get('password') ?? '');
  const schoolId = String(formData.get('schoolId') ?? '').trim();

  const service = new SuperAdminService({
    id: session.user.id,
    role: session.user.role as Role,
    email: session.user.email ?? undefined,
  });

  try {
    await service.createAdmin({
      name,
      email,
      password,
      schoolId,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to create admin account';
    redirect(`/dashboard/super-admin/admins/new?error=${encodeURIComponent(message)}`);
  }

  revalidatePath('/dashboard/super-admin');
  revalidatePath('/dashboard/super-admin/schools');
  redirect('/dashboard/super-admin/schools?adminCreated=1');
}

export default async function NewAdminPage({
  searchParams,
}: {
  searchParams?: { error?: string };
}) {
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    redirect('/login');
  }

  if (session.user.role !== 'SUPER_ADMIN') {
    redirect('/dashboard');
  }

  const service = new SuperAdminService({
    id: session.user.id,
    role: session.user.role as Role,
    email: session.user.email ?? undefined,
  });

  const schools = await service.getAllSchools();

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-gray-900">Create Admin</h1>
        <Link
          href="/dashboard/super-admin/schools"
          className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
        >
          Back to Schools
        </Link>
      </div>

      {searchParams?.error && (
        <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {searchParams.error}
        </div>
      )}

      {schools.length === 0 ? (
        <div className="space-y-4 rounded-lg border border-amber-200 bg-amber-50 p-5">
          <p className="text-sm text-amber-800">
            Create at least one school before creating an admin account.
          </p>
          <Link
            href="/dashboard/super-admin/schools/new"
            className="inline-flex rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
          >
            Create School
          </Link>
        </div>
      ) : (
        <form
          action={createAdminAction}
          className="space-y-5 rounded-lg border border-gray-200 bg-white p-6 shadow-sm"
        >
          <div>
            <label htmlFor="name" className="block text-sm font-medium text-gray-700">
              Admin Name <span className="text-red-500">*</span>
            </label>
            <input
              id="name"
              name="name"
              type="text"
              required
              className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="e.g. Jane Doe"
            />
          </div>

          <div>
            <label htmlFor="email" className="block text-sm font-medium text-gray-700">
              Email <span className="text-red-500">*</span>
            </label>
            <input
              id="email"
              name="email"
              type="email"
              required
              className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="admin@school.com"
            />
          </div>

          <div>
            <label htmlFor="password" className="block text-sm font-medium text-gray-700">
              Password <span className="text-red-500">*</span>
            </label>
            <input
              id="password"
              name="password"
              type="password"
              minLength={6}
              required
              className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Minimum 6 characters"
            />
          </div>

          <div>
            <label htmlFor="schoolId" className="block text-sm font-medium text-gray-700">
              Assign School <span className="text-red-500">*</span>
            </label>
            <select
              id="schoolId"
              name="schoolId"
              required
              className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              defaultValue=""
            >
              <option value="" disabled>
                Select a school
              </option>
              {schools.map((school) => (
                <option key={school.id} value={school.id}>
                  {school.name}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="submit"
              className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
            >
              Create Admin
            </button>
            <Link
              href="/dashboard/super-admin/schools"
              className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              Cancel
            </Link>
          </div>
        </form>
      )}
    </div>
  );
}

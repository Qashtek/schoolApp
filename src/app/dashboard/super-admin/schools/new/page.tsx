import Link from 'next/link';
import { getServerSession } from 'next-auth';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { authOptions, Role } from '@/lib/auth';
import { SuperAdminService } from '@/lib/services/super-admin.service';

async function createSchoolAction(formData: FormData) {
  'use server';

  const session = await getServerSession(authOptions);

  if (!session?.user || session.user.role !== 'SUPER_ADMIN') {
    redirect('/dashboard');
  }

  const name = String(formData.get('name') ?? '').trim();
  const address = String(formData.get('address') ?? '').trim();

  const service = new SuperAdminService({
    id: session.user.id,
    role: session.user.role as Role,
    email: session.user.email ?? undefined,
  });

  try {
    await service.createSchool({
      name,
      address: address || undefined,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to create school';
    redirect(`/dashboard/super-admin/schools/new?error=${encodeURIComponent(message)}`);
  }

  revalidatePath('/dashboard/super-admin');
  revalidatePath('/dashboard/super-admin/schools');
  redirect('/dashboard/super-admin/schools?created=1');
}

export default async function NewSchoolPage({
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

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-gray-900">Create School</h1>
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

      <form
        action={createSchoolAction}
        className="space-y-5 rounded-lg border border-gray-200 bg-white p-6 shadow-sm"
      >
        <div>
          <label htmlFor="name" className="block text-sm font-medium text-gray-700">
            School Name <span className="text-red-500">*</span>
          </label>
          <input
            id="name"
            name="name"
            type="text"
            required
            className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="e.g. Greenfield High School"
          />
        </div>

        <div>
          <label htmlFor="address" className="block text-sm font-medium text-gray-700">
            Address
          </label>
          <textarea
            id="address"
            name="address"
            rows={3}
            className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="Optional school address"
          />
        </div>

        <div className="flex items-center gap-3">
          <button
            type="submit"
            className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
          >
            Create School
          </button>
          <Link
            href="/dashboard/super-admin/schools"
            className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            Cancel
          </Link>
        </div>
      </form>
    </div>
  );
}

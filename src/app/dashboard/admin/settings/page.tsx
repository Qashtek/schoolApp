import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { redirect } from 'next/navigation';
import { LogoUploadForm } from './logo-upload-form';

export default async function SettingsPage() {
  const session = await getServerSession(authOptions);

  // Verify authentication
  if (!session || !session.user) {
    redirect('/auth/login');
  }

  // Verify role
  if (session.user.role !== 'ADMIN' && session.user.role !== 'SUPER_ADMIN') {
    redirect('/dashboard');
  }

  // Fetch school
  const school = await prisma.school.findUnique({
    where: { id: session.user.schoolId || '' }
  });

  if (!school) {
    return (
      <div className="p-6">
        <div className="text-red-600">School not found</div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-2xl">
      <h1 className="text-2xl font-bold mb-6">School Settings</h1>

      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <div>
          <h2 className="text-lg font-semibold mb-4">School Information</h2>
          <div className="space-y-3">
            <div>
              <p className="text-sm text-gray-600">School Name</p>
              <p className="font-medium">{school.name}</p>
            </div>
            {school.address && (
              <div>
                <p className="text-sm text-gray-600">Address</p>
                <p className="font-medium">{school.address}</p>
              </div>
            )}
          </div>
        </div>

        <div className="mt-8 pt-8 border-t border-gray-200">
          <h2 className="text-lg font-semibold mb-4">School Logo</h2>
          
          {school.logoUrl ? (
            <div className="mb-6">
              <p className="text-sm text-gray-600 mb-2">Current Logo</p>
              <img
                src={school.logoUrl}
                alt="School logo"
                className="h-32 w-auto object-contain border border-gray-300 rounded p-2"
              />
            </div>
          ) : (
            <div className="mb-6 h-32 bg-gray-100 border-2 border-dashed border-gray-300 rounded flex items-center justify-center">
              <p className="text-gray-500">No logo uploaded</p>
            </div>
          )}

          <LogoUploadForm currentLogoUrl={school.logoUrl || undefined} />
        </div>
      </div>
    </div>
  );
}

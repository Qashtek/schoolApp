import Link from 'next/link';
import { getServerSession } from 'next-auth';
import { redirect } from 'next/navigation';
import { authOptions } from '@/lib/auth';
import { GradeBandService } from '@/lib/services/grade-band.service';
import GradeBandsForm from './grade-bands-form';

export default async function AdminGradeBandsPage() {
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    redirect('/login');
  }

  if (session.user.role !== 'ADMIN') {
    redirect('/dashboard');
  }

  if (!session.user.schoolId) {
    throw new Error('Admin not assigned to school');
  }

  const gradeBandService = new GradeBandService({
    id: session.user.id,
    role: session.user.role,
    email: session.user.email ?? '',
    schoolId: session.user.schoolId,
  });

  const bands = await gradeBandService.getAllBands();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Grade Band Settings</h1>
          <p className="mt-1 text-sm text-gray-500">
            Configure score-to-letter ranges used for automatic grading.
          </p>
        </div>
        <Link
          href="/dashboard/admin/grades"
          className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
        >
          Back to Grades
        </Link>
      </div>

      <GradeBandsForm
        initialBands={{
          JUNIOR: bands.JUNIOR.map((band) => ({
            letter: band.letter,
            minScore: band.minScore,
            maxScore: band.maxScore,
          })),
          SENIOR: bands.SENIOR.map((band) => ({
            letter: band.letter,
            minScore: band.minScore,
            maxScore: band.maxScore,
          })),
        }}
      />
    </div>
  );
}

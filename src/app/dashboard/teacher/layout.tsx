
import { getServerSession } from 'next-auth';
import { redirect } from 'next/navigation';
import { authOptions } from '@/lib/auth';
import { TeacherLayoutClient } from '@/components/teacher-layout-client';

export default async function TeacherLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getServerSession(authOptions);

  // Redirect to login if not authenticated
  if (!session?.user) {
    redirect('/login');
  }

  // Check for teacher role
  if (!session.user.role || session.user.role !== 'TEACHER') {
    redirect('/dashboard');
  }

  return <TeacherLayoutClient session={session}>{children}</TeacherLayoutClient>;
}


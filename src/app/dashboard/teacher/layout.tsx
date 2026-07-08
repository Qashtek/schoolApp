
import { getServerSession } from 'next-auth';
import { redirect } from 'next/navigation';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
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

  const teacher = await prisma.teacher.findFirst({
    where: {
      userId: session.user.id,
      deletedAt: null,
    },
    select: {
      id: true,
    },
  });

  if (!teacher) {
    redirect('/dashboard');
  }

  // Check if teacher is CLASS_TEACHER of at least one class
  const classTeacherAssignment = await prisma.teacherClassSubject.findFirst({
    where: {
      teacherId: teacher.id,
      assignmentType: 'CLASS_TEACHER',
    },
    select: { id: true },
  });

  const isClassTeacher = Boolean(classTeacherAssignment);

  return (
    <TeacherLayoutClient session={session} isClassTeacher={isClassTeacher}>
      {children}
    </TeacherLayoutClient>
  );
}

import { getServerSession } from 'next-auth';
import { redirect } from 'next/navigation';
import { authOptions, Role } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { TeacherService } from '@/lib/services/teacher.service';
import GradeForm from './grade-form';

export const dynamic = 'force-dynamic';

type PageProps = {
  params: {
    classId: string;
  };
  searchParams?: {
    success?: string;
    error?: string;
    subjectId?: string;
  };
};

export default async function TeacherGradeEntryPage({ params, searchParams }: PageProps) {
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    redirect('/login');
  }

  if (session.user.role !== 'TEACHER') {
    redirect('/dashboard');
  }

  if (!session.user.schoolId) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-4">
        <p className="text-sm text-red-700">Unauthorized: Teacher is not assigned to a school.</p>
      </div>
    );
  }

  const classId = params.classId;
  const schoolId = session.user.schoolId;
  const selectedSubjectId = searchParams?.subjectId?.trim();

  const user = {
    id: session.user.id,
    role: session.user.role as Role,
    email: session.user.email,
  };

  const teacherService = new TeacherService(user);

  const teacher = await prisma.teacher.findFirst({
    where: {
      userId: session.user.id,
      schoolId,
    },
    select: { id: true },
  });

  if (!teacher) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-4">
        <p className="text-sm text-red-700">Unauthorized: Teacher profile not found.</p>
      </div>
    );
  }

  // Fetch teacher's assignments and check access to this class
  const teacherAssignments = await teacherService.getTeacherAssignments(teacher.id);
  const classAssignments = teacherAssignments.filter((a) => a.class.id === classId);

  if (classAssignments.length === 0) {
    redirect(`/dashboard/teacher?error=${encodeURIComponent('You are not assigned to this class')}`);
  }

  // Determine the teacher's role for this class
  const isClassTeacher = classAssignments.some((a) => a.assignmentType === 'CLASS_TEACHER');

  let subjects: { id: string; name: string; code: string }[];

  if (isClassTeacher) {
    // CLASS_TEACHER: fetch ALL subjects assigned to this class.
    // A subject counts as assigned to the class when it is linked through
    // class_subjects OR is taught by a subject teacher in this class.
    const [classSubjectEntries, subjectTeacherEntries] = await prisma.$transaction([
      prisma.classSubject.findMany({
        where: { classId },
        select: {
          subject: {
            select: {
              id: true,
              name: true,
              code: true,
            },
          },
        },
      }),
      prisma.teacherClassSubject.findMany({
        where: {
          classId,
          assignmentType: 'SUBJECT_TEACHER',
          subjectId: { not: null },
        },
        select: {
          subject: {
            select: {
              id: true,
              name: true,
              code: true,
            },
          },
        },
      }),
    ]);

    const mergedSubjects = new Map<string, { id: string; name: string; code: string }>();

    for (const entry of [...classSubjectEntries, ...subjectTeacherEntries]) {
      if (entry.subject) {
        mergedSubjects.set(entry.subject.id, entry.subject);
      }
    }

    subjects = Array.from(mergedSubjects.values());
  } else {
    // SUBJECT_TEACHER: the teacher can grade the subjects they are assigned
    // to teach in this class. The assignment record is authoritative, which
    // also covers cases where the class_subjects link is missing (legacy data
    // or assignments created directly without linking the subject to the class).
    subjects = classAssignments
      .filter((a) => a.subject)
      .map((a) => a.subject!);
  }

  if (selectedSubjectId) {
    subjects = subjects.filter((s) => s.id === selectedSubjectId);
  }

  subjects.sort((a, b) => a.name.localeCompare(b.name));
  const subjectIds = subjects.map((subject) => subject.id);

  // Fetch active term and students first
  const [activeTerm, students] = await prisma.$transaction([
    prisma.term.findFirst({
      where: {
        isActive: true,
        session: {
          is: {
            schoolId,
          },
        },
      },
      select: {
        id: true,
        name: true,
      },
      orderBy: {
        updatedAt: 'desc',
      },
    }),
    prisma.student.findMany({
      where: {
        classId,
        schoolId,
      },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        admissionNumber: true,
      },
      orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
    }),
  ]);

  // Fetch existing grades only if there's an active term and subjects
  const existingGrades = activeTerm && subjectIds.length > 0
    ? await prisma.grade.findMany({
        where: {
          schoolId,
          classId,
          termId: activeTerm.id,
          subjectId: {
            in: subjectIds,
          },
        },
        select: {
          studentId: true,
          subjectId: true,
          caScore: true,
          examScore: true,
          total: true,
          grade: true,
        },
      })
    : [];

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-semibold text-gray-900">Grade Entry</h1>
        <p className="mt-1 text-sm text-gray-600">
          {classAssignments[0].class.name} (Grade {classAssignments[0].class.grade})
        </p>
      </div>

      {searchParams?.success ? (
        <div className="rounded-lg border border-green-200 bg-green-50 px-4 py-3">
          <p className="text-sm text-green-700">{searchParams.success}</p>
        </div>
      ) : null}

      {searchParams?.error ? (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3">
          <p className="text-sm text-red-700">{searchParams.error}</p>
        </div>
      ) : null}

      {!activeTerm ? (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3">
          <p className="text-sm text-amber-800">
            No active term exists. Ask an administrator to activate a term before entering grades.
          </p>
        </div>
      ) : (
        <GradeForm
          students={students}
          subjects={subjects}
          classId={classId}
          termId={activeTerm.id}
          existingGrades={existingGrades}
        />
      )}
    </div>
  );
}

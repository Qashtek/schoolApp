import { prisma } from '@/lib/prisma';
import { resolveGradeBandLevel } from '@/lib/grade-bands';
import type { AuthenticatedUser } from '@/lib/permissions';

export interface UpsertGradeInput {
  studentId: string;
  subjectId: string;
  classId: string;
  termId: string;
  caScore?: number | null;
  examScore?: number | null;
}

export class GradeService {
  private user: AuthenticatedUser;

  constructor(user: AuthenticatedUser) {
    this.user = user;
  }

  private requireSchoolId(): string {
    if (!this.user.schoolId) {
      throw new Error('Unauthorized: User is not assigned to a school');
    }

    return this.user.schoolId;
  }

  private requireTeacher(): void {
    if (this.user.role !== 'TEACHER') {
      throw new Error('Unauthorized: Only TEACHER users can enter or update grades');
    }
  }

  private requireAdmin(): void {
    if (this.user.role !== 'ADMIN' && this.user.role !== 'SUPER_ADMIN') {
      throw new Error('Unauthorized: Only ADMIN users can perform this action');
    }
  }

  private requireTeacherOrAdmin(): void {
    if (this.user.role === 'TEACHER') {
      return;
    }

    if (this.user.role === 'ADMIN' || this.user.role === 'SUPER_ADMIN') {
      return;
    }

    throw new Error('Unauthorized: Only TEACHER or ADMIN users can view grades');
  }

  private validateScore(value: number | null | undefined, fieldName: 'caScore' | 'examScore'): void {
    if (value === null || value === undefined) {
      return;
    }

    if (!Number.isFinite(value)) {
      throw new Error(`${fieldName} must be a valid number`);
    }

    if (value < 0 || value > 100) {
      throw new Error(`${fieldName} must be between 0 and 100`);
    }
  }

  private calculateTotal(caScore: number | null, examScore: number | null): number | null {
    if (caScore === null && examScore === null) {
      return null;
    }

    return (caScore ?? 0) + (examScore ?? 0);
  }

  private calculateDefaultLetterGrade(total: number | null): string | null {
    if (total === null) {
      return null;
    }

    if (total >= 70) {
      return 'A';
    }

    if (total >= 60) {
      return 'B';
    }

    if (total >= 50) {
      return 'C';
    }

    if (total >= 40) {
      return 'D';
    }

    return 'F';
  }

  private async calculateLetterGrade(
    total: number | null,
    schoolId: string,
    classGrade: string | null | undefined
  ): Promise<string | null> {
    if (total === null) {
      return null;
    }

    const level = resolveGradeBandLevel(classGrade);
    const gradeBands = await prisma.gradeBand.findMany({
      where: {
        schoolId,
        level,
      },
      select: {
        letter: true,
        minScore: true,
        maxScore: true,
      },
      orderBy: [{ minScore: 'desc' }, { letter: 'asc' }],
    });

    if (gradeBands.length > 0) {
      const matchedBand = gradeBands.find(
        (band) => total >= band.minScore && total <= band.maxScore
      );

      if (matchedBand) {
        return matchedBand.letter;
      }
    }

    return this.calculateDefaultLetterGrade(total);
  }

  private async getTeacherInSchool(schoolId: string): Promise<{ id: string }> {
    const teacher = await prisma.teacher.findFirst({
      where: {
        userId: this.user.id,
        schoolId,
        deletedAt: null,
      },
      select: { id: true },
    });

    if (!teacher) {
      throw new Error('Unauthorized: Teacher profile not found in your school');
    }

    return teacher;
  }

  private async requireTeacherClassAndSubjectAssignment(
    teacherId: string,
    classId: string,
    subjectId: string
  ): Promise<void> {
    const [classAssignment, subjectAssignment] = await prisma.$transaction([
      prisma.teacherClass.findUnique({
        where: {
          teacherId_classId: {
            teacherId,
            classId,
          },
        },
      }),
      prisma.teacherSubject.findUnique({
        where: {
          teacherId_subjectId: {
            teacherId,
            subjectId,
          },
        },
      }),
    ]);

    if (!classAssignment) {
      throw new Error('Unauthorized: Teacher is not assigned to this class');
    }

    if (!subjectAssignment) {
      throw new Error('Unauthorized: Teacher is not assigned to this subject');
    }
  }

  async upsertGrade(data: UpsertGradeInput) {
    this.requireTeacher();
    const schoolId = this.requireSchoolId();

    const studentId = data.studentId?.trim();
    const subjectId = data.subjectId?.trim();
    const classId = data.classId?.trim();
    const termId = data.termId?.trim();

    if (!studentId) {
      throw new Error('studentId is required');
    }

    if (!subjectId) {
      throw new Error('subjectId is required');
    }

    if (!classId) {
      throw new Error('classId is required');
    }

    if (!termId) {
      throw new Error('termId is required');
    }

    this.validateScore(data.caScore, 'caScore');
    this.validateScore(data.examScore, 'examScore');

    const teacher = await this.getTeacherInSchool(schoolId);

    await this.requireTeacherClassAndSubjectAssignment(teacher.id, classId, subjectId);

    const [student, subject, classRecord, term, classSubject] = await prisma.$transaction([
      prisma.student.findFirst({
        where: {
          id: studentId,
          schoolId,
          deletedAt: null,
        },
        select: {
          id: true,
          classId: true,
        },
      }),
      prisma.subject.findFirst({
        where: {
          id: subjectId,
          schoolId,
          deletedAt: null,
        },
        select: { id: true },
      }),
      prisma.class.findFirst({
        where: {
          id: classId,
          schoolId,
          deletedAt: null,
        },
        select: {
          id: true,
          grade: true,
        },
      }),
      prisma.term.findFirst({
        where: {
          id: termId,
          session: {
            is: {
              schoolId,
            },
          },
          deletedAt: null,
        },
        select: { id: true },
      }),
      prisma.classSubject.findUnique({
        where: {
          classId_subjectId: {
            classId,
            subjectId,
          },
        },
        select: { id: true },
      }),
    ]);

    if (!student) {
      throw new Error('Student not found in your school');
    }

    if (!subject) {
      throw new Error('Subject not found in your school');
    }

    if (!classRecord) {
      throw new Error('Class not found in your school');
    }

    if (!term) {
      throw new Error('Term not found in your school');
    }

    if (!classSubject) {
      throw new Error('Subject is not assigned to this class');
    }

    if (student.classId !== classId) {
      throw new Error('Student is not assigned to the specified class');
    }

    const caScore = data.caScore ?? null;
    const examScore = data.examScore ?? null;
    const total = this.calculateTotal(caScore, examScore);

    if (total !== null && total > 100) {
      throw new Error('Total score cannot exceed 100');
    }

    const grade = await this.calculateLetterGrade(total, schoolId, classRecord.grade);

    return prisma.grade.upsert({
      where: {
        studentId_subjectId_termId: {
          studentId,
          subjectId,
          termId,
        },
      },
      update: {
        classId,
        schoolId,
        caScore,
        examScore,
        total,
        grade,
      },
      create: {
        studentId,
        subjectId,
        classId,
        termId,
        schoolId,
        caScore,
        examScore,
        total,
        grade,
      },
      include: {
        student: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            admissionNumber: true,
          },
        },
        subject: {
          select: {
            id: true,
            name: true,
            code: true,
          },
        },
        class: {
          select: {
            id: true,
            name: true,
            grade: true,
          },
        },
        term: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });
  }

  async getGradesByClass(
    classId: string,
    termId: string,
    options?: { skip?: number; take?: number }
  ) {
    this.requireTeacherOrAdmin();
    const schoolId = this.requireSchoolId();

    const classIdValue = classId?.trim();
    const termIdValue = termId?.trim();

    if (!classIdValue) {
      throw new Error('classId is required');
    }

    if (!termIdValue) {
      throw new Error('termId is required');
    }

    if (this.user.role === 'TEACHER') {
      const teacher = await this.getTeacherInSchool(schoolId);
      const classAssignment = await prisma.teacherClass.findUnique({
        where: {
          teacherId_classId: {
            teacherId: teacher.id,
            classId: classIdValue,
          },
        },
      });

      if (!classAssignment) {
        throw new Error('Unauthorized: Teacher is not assigned to this class');
      }
    }

    const where = {
      schoolId,
      classId: classIdValue,
      termId: termIdValue,
      deletedAt: null,
    };

    const [grades, count] = await prisma.$transaction([
      prisma.grade.findMany({
        where,
        skip: options?.skip,
        take: options?.take,
        include: {
          student: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              admissionNumber: true,
            },
          },
          subject: {
            select: {
              id: true,
              name: true,
              code: true,
            },
          },
        },
        orderBy: [
          { student: { lastName: 'asc' } },
          { student: { firstName: 'asc' } },
          { subject: { name: 'asc' } },
        ],
      }),
      prisma.grade.count({ where }),
    ]);

    return { grades, count };
  }

  async getGradesByStudent(studentId: string, termId: string) {
    this.requireTeacherOrAdmin();
    const schoolId = this.requireSchoolId();

    const studentIdValue = studentId?.trim();
    const termIdValue = termId?.trim();

    if (!studentIdValue) {
      throw new Error('studentId is required');
    }

    if (!termIdValue) {
      throw new Error('termId is required');
    }

    const student = await prisma.student.findFirst({
      where: {
        id: studentIdValue,
        schoolId,
        deletedAt: null,
      },
      select: {
        id: true,
        classId: true,
      },
    });

    if (!student) {
      throw new Error('Student not found in your school');
    }

    if (this.user.role === 'TEACHER') {
      if (!student.classId) {
        throw new Error('Unauthorized: Student is not assigned to a class');
      }

      const teacher = await this.getTeacherInSchool(schoolId);
      const classAssignment = await prisma.teacherClass.findUnique({
        where: {
          teacherId_classId: {
            teacherId: teacher.id,
            classId: student.classId,
          },
        },
      });

      if (!classAssignment) {
        throw new Error('Unauthorized: Teacher is not assigned to this student class');
      }
    }

    return prisma.grade.findMany({
      where: {
        schoolId,
        studentId: studentIdValue,
        termId: termIdValue,
        deletedAt: null,
      },
      include: {
        student: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            admissionNumber: true,
          },
        },
        subject: {
          select: {
            id: true,
            name: true,
            code: true,
          },
        },
        class: {
          select: {
            id: true,
            name: true,
            grade: true,
          },
        },
      },
      orderBy: [
        { subject: { name: 'asc' } },
        { createdAt: 'desc' },
      ],
    });
  }

  async getGradesByTerm(termId: string) {
    this.requireAdmin();
    const schoolId = this.requireSchoolId();

    const termIdValue = termId?.trim();

    if (!termIdValue) {
      throw new Error('termId is required');
    }

    const term = await prisma.term.findFirst({
      where: {
        id: termIdValue,
        session: {
          is: {
            schoolId,
          },
        },
        deletedAt: null,
      },
      select: { id: true },
    });

    if (!term) {
      throw new Error('Term not found in your school');
    }

    return prisma.grade.findMany({
      where: {
        schoolId,
        termId: termIdValue,
        deletedAt: null,
      },
      include: {
        student: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            admissionNumber: true,
          },
        },
        subject: {
          select: {
            id: true,
            name: true,
            code: true,
          },
        },
        class: {
          select: {
            id: true,
            name: true,
            grade: true,
          },
        },
      },
      orderBy: [
        { class: { name: 'asc' } },
        { student: { lastName: 'asc' } },
        { subject: { name: 'asc' } },
      ],
    });
  }
}

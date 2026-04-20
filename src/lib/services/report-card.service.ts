import { prisma } from '@/lib/prisma';
import { AuthenticatedUser, isAdmin, isStudent } from '@/lib/permissions';

export interface ReportCardGrade {
  subjectId: string;
  subjectName: string;
  caScore: number | null;
  examScore: number | null;
  total: number | null;
  letterGrade: string | null;
}

export interface ReportCardAttendanceSummary {
  totalDays: number;
  presentCount: number;
  absentCount: number;
  lateCount: number;
  attendancePercentage: number;
}

export interface ReportCardClassPosition {
  rank: number;
  outOf: number;
  totalMarks: number;
}

export interface StudentReportCard {
  student: {
    id: string;
    name: string;
    admissionNumber: string;
    class: {
      id: string;
      name: string;
      grade: string;
    } | null;
  };
  term: {
    id: string;
    name: string;
    startDate: Date;
    endDate: Date;
    session: {
      id: string;
      name: string;
    };
  };
  grades: ReportCardGrade[];
  attendance: ReportCardAttendanceSummary;
  classPosition: ReportCardClassPosition | null;
  overallAverage: number | null;
}

type AttendanceGroupRow = {
  studentId: string;
  status: string;
};

type GradeTotalGroupRow = {
  studentId: string;
  total: number | null;
};

export class ReportCardService {
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

  private requireAdminOrStudent(): void {
    if (isAdmin(this.user) || isStudent(this.user)) {
      return;
    }

    throw new Error('Unauthorized: Only ADMIN or STUDENT users can view report cards');
  }

  private requireAdmin(): void {
    if (!isAdmin(this.user)) {
      throw new Error('Unauthorized: Only ADMIN users can view class report cards');
    }
  }

  private requireId(value: string, fieldName: 'studentId' | 'classId' | 'termId'): string {
    const normalized = value?.trim();

    if (!normalized) {
      throw new Error(`${fieldName} is required`);
    }

    return normalized;
  }

  private toStartOfDay(value: Date): Date {
    const date = new Date(value);
    date.setHours(0, 0, 0, 0);
    return date;
  }

  private toEndOfDay(value: Date): Date {
    const date = new Date(value);
    date.setHours(23, 59, 59, 999);
    return date;
  }

  private roundToTwo(value: number): number {
    return Math.round(value * 100) / 100;
  }

  private formatStudentName(student: {
    firstName: string;
    lastName: string;
    user: { name: string | null } | null;
  }): string {
    const fullName = `${student.firstName} ${student.lastName}`.trim();
    return fullName || student.user?.name || 'Unknown Student';
  }

  private mapTerm(term: {
    id: string;
    name: string;
    startDate: Date;
    endDate: Date;
    session: { id: string; name: string };
  }): StudentReportCard['term'] {
    return {
      id: term.id,
      name: term.name,
      startDate: term.startDate,
      endDate: term.endDate,
      session: {
        id: term.session.id,
        name: term.session.name,
      },
    };
  }

  private emptyAttendanceSummary(): ReportCardAttendanceSummary {
    return {
      totalDays: 0,
      presentCount: 0,
      absentCount: 0,
      lateCount: 0,
      attendancePercentage: 0,
    };
  }

  private buildAttendanceSummaryMap(
    studentIds: string[],
    groupedRows: AttendanceGroupRow[]
  ): Map<string, ReportCardAttendanceSummary> {
    const summaryByStudentId = new Map<string, ReportCardAttendanceSummary>();

    for (const studentId of studentIds) {
      summaryByStudentId.set(studentId, this.emptyAttendanceSummary());
    }

    for (const row of groupedRows) {
      const summary = summaryByStudentId.get(row.studentId) ?? this.emptyAttendanceSummary();
      const status = String(row.status ?? '').toUpperCase();

      if (status === 'PRESENT') {
        summary.presentCount += 1;
      } else if (status === 'ABSENT') {
        summary.absentCount += 1;
      } else if (status === 'LATE') {
        summary.lateCount += 1;
      }

      summaryByStudentId.set(row.studentId, summary);
    }

    for (const studentId of studentIds) {
      const summary = summaryByStudentId.get(studentId) ?? this.emptyAttendanceSummary();
      const totalDays = summary.presentCount + summary.absentCount + summary.lateCount;

      summary.totalDays = totalDays;
      summary.attendancePercentage =
        totalDays === 0 ? 0 : this.roundToTwo((summary.presentCount / totalDays) * 100);
      summaryByStudentId.set(studentId, summary);
    }

    return summaryByStudentId;
  }

  private buildClassRankings(
    studentIds: string[],
    gradeTotalRows: GradeTotalGroupRow[]
  ): {
    totalMarksByStudentId: Map<string, number>;
    rankByStudentId: Map<string, number>;
  } {
    const totalMarksByStudentId = new Map<string, number>();

    for (const studentId of studentIds) {
      totalMarksByStudentId.set(studentId, 0);
    }

    for (const row of gradeTotalRows) {
      const previousTotal = totalMarksByStudentId.get(row.studentId) ?? 0;
      totalMarksByStudentId.set(row.studentId, previousTotal + (row.total ?? 0));
    }

    const sortedTotals = studentIds
      .map((studentId) => ({
        studentId,
        totalMarks: totalMarksByStudentId.get(studentId) ?? 0,
      }))
      .sort((left, right) => {
        if (right.totalMarks !== left.totalMarks) {
          return right.totalMarks - left.totalMarks;
        }

        return left.studentId.localeCompare(right.studentId);
      });

    const rankByStudentId = new Map<string, number>();
    let lastTotal: number | null = null;
    let currentRank = 0;

    for (let index = 0; index < sortedTotals.length; index += 1) {
      const row = sortedTotals[index];
      if (lastTotal === null || row.totalMarks < lastTotal) {
        currentRank = index + 1;
        lastTotal = row.totalMarks;
      }

      rankByStudentId.set(row.studentId, currentRank);
    }

    return {
      totalMarksByStudentId,
      rankByStudentId,
    };
  }

  private computeOverallAverage(grades: ReportCardGrade[]): number | null {
    const totals = grades
      .map((grade) => grade.total)
      .filter((value): value is number => value !== null);

    if (totals.length === 0) {
      return null;
    }

    const sum = totals.reduce((accumulator, current) => accumulator + current, 0);
    return this.roundToTwo(sum / totals.length);
  }

  async getStudentReportCard(studentId: string, termId: string): Promise<StudentReportCard> {
    this.requireAdminOrStudent();
    const schoolId = this.requireSchoolId();

    const studentIdValue = this.requireId(studentId, 'studentId');
    const termIdValue = this.requireId(termId, 'termId');

    const [student, term] = await prisma.$transaction([
      prisma.student.findFirst({
        where: {
          id: studentIdValue,
          schoolId,
        },
        select: {
          id: true,
          firstName: true,
          lastName: true,
          admissionNumber: true,
          userId: true,
          classId: true,
          user: {
            select: {
              name: true,
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
      }),
      prisma.term.findFirst({
        where: {
          id: termIdValue,
          session: {
            is: {
              schoolId,
            },
          },
        },
        select: {
          id: true,
          name: true,
          startDate: true,
          endDate: true,
          session: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      }),
    ]);

    if (!student) {
      throw new Error('Student not found in your school');
    }

    if (!term) {
      throw new Error('Term not found in your school');
    }

    if (isStudent(this.user) && student.userId !== this.user.id) {
      throw new Error('Unauthorized: Students can only view their own report card');
    }

    const attendanceStartDate = this.toStartOfDay(term.startDate);
    const attendanceEndDate = this.toEndOfDay(term.endDate);

    const [grades, attendanceRows] = await prisma.$transaction([
      prisma.grade.findMany({
        where: {
          schoolId,
          studentId: student.id,
          termId: term.id,
        },
        include: {
          subject: {
            select: {
              id: true,
              name: true,
            },
          },
        },
        orderBy: [{ subject: { name: 'asc' } }],
      }),
      prisma.attendance.findMany({
        where: {
          schoolId,
          studentId: student.id,
          date: {
            gte: attendanceStartDate,
            lte: attendanceEndDate,
          },
        },
        select: {
          studentId: true,
          status: true,
        },
      }),
    ]);

    const gradeItems: ReportCardGrade[] = grades.map((grade) => ({
      subjectId: grade.subject.id,
      subjectName: grade.subject.name,
      caScore: grade.caScore,
      examScore: grade.examScore,
      total: grade.total,
      letterGrade: grade.grade,
    }));

    const attendanceSummary =
      this.buildAttendanceSummaryMap([student.id], attendanceRows).get(student.id) ??
      this.emptyAttendanceSummary();

    let classPosition: ReportCardClassPosition | null = null;

    if (student.classId) {
      const classmates = await prisma.student.findMany({
        where: {
          schoolId,
          classId: student.classId,
        },
        select: {
          id: true,
        },
      });

      const classmateIds = classmates.map((classmate) => classmate.id);

      if (classmateIds.length > 0) {
        const gradeTotals = await prisma.grade.findMany({
          where: {
            schoolId,
            classId: student.classId,
            termId: term.id,
            studentId: {
              in: classmateIds,
            },
          },
          select: {
            studentId: true,
            total: true,
          },
        });

        const ranking = this.buildClassRankings(classmateIds, gradeTotals);
        classPosition = {
          rank: ranking.rankByStudentId.get(student.id) ?? classmateIds.length,
          outOf: classmateIds.length,
          totalMarks: this.roundToTwo(ranking.totalMarksByStudentId.get(student.id) ?? 0),
        };
      }
    }

    return {
      student: {
        id: student.id,
        name: this.formatStudentName(student),
        admissionNumber: student.admissionNumber,
        class: student.class
          ? {
              id: student.class.id,
              name: student.class.name,
              grade: student.class.grade,
            }
          : null,
      },
      term: this.mapTerm(term),
      grades: gradeItems,
      attendance: attendanceSummary,
      classPosition,
      overallAverage: this.computeOverallAverage(gradeItems),
    };
  }

  async getClassReportCards(classId: string, termId: string): Promise<StudentReportCard[]> {
    this.requireAdmin();
    const schoolId = this.requireSchoolId();

    const classIdValue = this.requireId(classId, 'classId');
    const termIdValue = this.requireId(termId, 'termId');

    const [classRecord, term, students] = await prisma.$transaction([
      prisma.class.findFirst({
        where: {
          id: classIdValue,
          schoolId,
        },
        select: {
          id: true,
          name: true,
          grade: true,
        },
      }),
      prisma.term.findFirst({
        where: {
          id: termIdValue,
          session: {
            is: {
              schoolId,
            },
          },
        },
        select: {
          id: true,
          name: true,
          startDate: true,
          endDate: true,
          session: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      }),
      prisma.student.findMany({
        where: {
          schoolId,
          classId: classIdValue,
        },
        select: {
          id: true,
          firstName: true,
          lastName: true,
          admissionNumber: true,
          classId: true,
          user: {
            select: {
              name: true,
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
        orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
      }),
    ]);

    if (!classRecord) {
      throw new Error('Class not found in your school');
    }

    if (!term) {
      throw new Error('Term not found in your school');
    }

    if (students.length === 0) {
      return [];
    }

    const studentIds = students.map((student) => student.id);
    const attendanceStartDate = this.toStartOfDay(term.startDate);
    const attendanceEndDate = this.toEndOfDay(term.endDate);

    const [grades, attendanceRows] = await prisma.$transaction([
      prisma.grade.findMany({
        where: {
          schoolId,
          classId: classIdValue,
          termId: term.id,
          studentId: {
            in: studentIds,
          },
        },
        include: {
          subject: {
            select: {
              id: true,
              name: true,
            },
          },
        },
        orderBy: [{ studentId: 'asc' }, { subject: { name: 'asc' } }],
      }),
      prisma.attendance.findMany({
        where: {
          schoolId,
          classId: classIdValue,
          studentId: {
            in: studentIds,
          },
          date: {
            gte: attendanceStartDate,
            lte: attendanceEndDate,
          },
        },
        select: {
          studentId: true,
          status: true,
        },
      }),
    ]);

    const gradesByStudentId = new Map<string, ReportCardGrade[]>();

    for (const grade of grades) {
      const entries = gradesByStudentId.get(grade.studentId) ?? [];
      entries.push({
        subjectId: grade.subject.id,
        subjectName: grade.subject.name,
        caScore: grade.caScore,
        examScore: grade.examScore,
        total: grade.total,
        letterGrade: grade.grade,
      });
      gradesByStudentId.set(grade.studentId, entries);
    }

    const attendanceByStudentId = this.buildAttendanceSummaryMap(studentIds, attendanceRows);
    const ranking = this.buildClassRankings(
      studentIds,
      grades.map((grade) => ({
        studentId: grade.studentId,
        total: grade.total,
      }))
    );
    const termPayload = this.mapTerm(term);

    return students.map((student) => {
      const studentGrades = gradesByStudentId.get(student.id) ?? [];
      const fallbackClass = {
        id: classRecord.id,
        name: classRecord.name,
        grade: classRecord.grade,
      };

      return {
        student: {
          id: student.id,
          name: this.formatStudentName(student),
          admissionNumber: student.admissionNumber,
          class: student.class
            ? {
                id: student.class.id,
                name: student.class.name,
                grade: student.class.grade,
              }
            : fallbackClass,
        },
        term: termPayload,
        grades: studentGrades,
        attendance: attendanceByStudentId.get(student.id) ?? this.emptyAttendanceSummary(),
        classPosition: {
          rank: ranking.rankByStudentId.get(student.id) ?? studentIds.length,
          outOf: studentIds.length,
          totalMarks: this.roundToTwo(ranking.totalMarksByStudentId.get(student.id) ?? 0),
        },
        overallAverage: this.computeOverallAverage(studentGrades),
      };
    });
  }
}

import { prisma } from '@/lib/prisma';
import { resolveGradeBandLevel, resolveTotalScore } from '@/lib/grade-bands';
import { isAdmin } from '@/lib/permissions';
import type { AuthenticatedUser } from '@/types/authenticated-user';

export type GradeBandLevel = 'JUNIOR' | 'SENIOR';

export interface GradeBandInput {
  letter: string;
  minScore: number;
  maxScore: number;
}

export interface GradeBandRecord {
  id?: string;
  letter: string;
  minScore: number;
  maxScore: number;
  level: GradeBandLevel;
}

const DEFAULT_GRADE_BANDS: Record<GradeBandLevel, GradeBandInput[]> = {
  JUNIOR: [
    { letter: 'A', minScore: 70, maxScore: 100 },
    { letter: 'B', minScore: 60, maxScore: 69.99 },
    { letter: 'C', minScore: 50, maxScore: 59.99 },
    { letter: 'D', minScore: 40, maxScore: 49.99 },
    { letter: 'F', minScore: 0, maxScore: 39.99 },
  ],
  SENIOR: [
    { letter: 'A', minScore: 70, maxScore: 100 },
    { letter: 'B', minScore: 60, maxScore: 69.99 },
    { letter: 'C', minScore: 50, maxScore: 59.99 },
    { letter: 'D', minScore: 45, maxScore: 49.99 },
    { letter: 'E', minScore: 40, maxScore: 44.99 },
    { letter: 'F', minScore: 0, maxScore: 39.99 },
  ],
};

export class GradeBandService {
  private user: AuthenticatedUser;

  constructor(user: AuthenticatedUser) {
    this.user = user;
  }

  private requireAdmin(): void {
    if (!isAdmin(this.user)) {
      throw new Error('Unauthorized: Only administrators can manage grade bands');
    }
  }

  private requireSchoolId(): string {
    if (!this.user.schoolId) {
      throw new Error('Unauthorized: Admin is not assigned to a school');
    }

    return this.user.schoolId;
  }

  private normalizeLevel(level: string): GradeBandLevel {
    const normalized = level.trim().toUpperCase();

    if (normalized !== 'JUNIOR' && normalized !== 'SENIOR') {
      throw new Error('Invalid level. Expected JUNIOR or SENIOR');
    }

    return normalized;
  }

  private normalizeAndValidateBands(input: GradeBandInput[]): GradeBandInput[] {
    if (!input.length) {
      throw new Error('At least one grade band is required');
    }

    const bands = input.map((band) => {
      const letter = band.letter.trim().toUpperCase();
      const minScore = Number(band.minScore);
      const maxScore = Number(band.maxScore);

      if (!letter) {
        throw new Error('Grade letter is required');
      }

      if (!Number.isFinite(minScore) || !Number.isFinite(maxScore)) {
        throw new Error('Grade band scores must be valid numbers');
      }

      if (minScore < 0 || minScore > 100 || maxScore < 0 || maxScore > 100) {
        throw new Error('Grade band scores must be between 0 and 100');
      }

      if (minScore > maxScore) {
        throw new Error(`Invalid range for ${letter}: minScore cannot exceed maxScore`);
      }

      return { letter, minScore, maxScore };
    });

    const letters = new Set<string>();
    for (const band of bands) {
      if (letters.has(band.letter)) {
        throw new Error(`Duplicate grade letter found: ${band.letter}`);
      }
      letters.add(band.letter);
    }

    const sorted = [...bands].sort((a, b) => a.minScore - b.minScore);
    for (let index = 1; index < sorted.length; index += 1) {
      const previous = sorted[index - 1];
      const current = sorted[index];

      if (current.minScore <= previous.maxScore) {
        throw new Error(
          `Overlapping ranges detected between ${previous.letter} and ${current.letter}`
        );
      }
    }

    return bands;
  }

  private async getPersistedBands(level: GradeBandLevel, schoolId: string): Promise<GradeBandRecord[]> {
    const bands = await prisma.gradeBand.findMany({
      where: {
        schoolId,
        level,
      },
      orderBy: [{ minScore: 'desc' }, { letter: 'asc' }],
      select: {
        id: true,
        letter: true,
        minScore: true,
        maxScore: true,
        level: true,
      },
    });

    return bands.map((band) => ({
      ...band,
      level: this.normalizeLevel(band.level),
    }));
  }

  private resolveLetterFromBands(total: number | null, bands: GradeBandInput[]): string | null {
    if (total === null) {
      return null;
    }

    const matchedBand = bands.find(
      (band) => total >= band.minScore && total <= band.maxScore
    );

    return matchedBand?.letter ?? null;
  }

  private async recalculateGradesForLevel(level: GradeBandLevel, schoolId: string): Promise<void> {
    const [classes, persistedBands] = await Promise.all([
      prisma.class.findMany({
        where: { schoolId },
        select: {
          id: true,
          grade: true,
        },
      }),
      this.getPersistedBands(level, schoolId),
    ]);

    const activeBands = persistedBands.length
      ? persistedBands.map((band) => ({
          letter: band.letter,
          minScore: band.minScore,
          maxScore: band.maxScore,
        }))
      : DEFAULT_GRADE_BANDS[level];

    const classIds = classes
      .filter((classRecord) => resolveGradeBandLevel(classRecord.grade) === level)
      .map((classRecord) => classRecord.id);

    if (classIds.length === 0) {
      return;
    }

    const grades = await prisma.grade.findMany({
      where: {
        schoolId,
        classId: {
          in: classIds,
        },
      },
      select: {
        id: true,
        caScore: true,
        examScore: true,
        total: true,
      },
    });

    if (grades.length === 0) {
      return;
    }

    const updates = grades.map((grade) => {
      const resolvedTotal = resolveTotalScore(grade.caScore, grade.examScore, grade.total);
      const resolvedLetter = this.resolveLetterFromBands(resolvedTotal, activeBands);

      return prisma.grade.update({
        where: { id: grade.id },
        data: {
          total: resolvedTotal,
          grade: resolvedLetter,
        },
      });
    });

    await prisma.$transaction(updates);
  }

  async getBandsByLevel(level: GradeBandLevel): Promise<GradeBandRecord[]> {
    this.requireAdmin();
    const schoolId = this.requireSchoolId();
    const normalizedLevel = this.normalizeLevel(level);
    const persisted = await this.getPersistedBands(normalizedLevel, schoolId);

    if (persisted.length > 0) {
      return persisted;
    }

    return DEFAULT_GRADE_BANDS[normalizedLevel]
      .map((band) => ({
        ...band,
        level: normalizedLevel,
      }))
      .sort((a, b) => b.minScore - a.minScore);
  }

  async getAllBands(): Promise<Record<GradeBandLevel, GradeBandRecord[]>> {
    this.requireAdmin();

    const [junior, senior] = await Promise.all([
      this.getBandsByLevel('JUNIOR'),
      this.getBandsByLevel('SENIOR'),
    ]);

    return {
      JUNIOR: junior,
      SENIOR: senior,
    };
  }

  async replaceBands(level: GradeBandLevel, bandsInput: GradeBandInput[]): Promise<GradeBandRecord[]> {
    this.requireAdmin();
    const schoolId = this.requireSchoolId();
    const normalizedLevel = this.normalizeLevel(level);
    const normalizedBands = this.normalizeAndValidateBands(bandsInput);

    await prisma.$transaction(async (tx) => {
      await tx.gradeBand.deleteMany({
        where: {
          schoolId,
          level: normalizedLevel,
        },
      });

      await tx.gradeBand.createMany({
        data: normalizedBands.map((band) => ({
          schoolId,
          level: normalizedLevel,
          letter: band.letter,
          minScore: band.minScore,
          maxScore: band.maxScore,
        })),
      });
    });

    await this.recalculateGradesForLevel(normalizedLevel, schoolId);

    const persisted = await this.getPersistedBands(normalizedLevel, schoolId);
    return persisted;
  }
}

export function getDefaultGradeBands(level: GradeBandLevel): GradeBandInput[] {
  return DEFAULT_GRADE_BANDS[level];
}

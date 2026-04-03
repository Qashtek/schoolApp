export type GradeBandLevel = 'JUNIOR' | 'SENIOR';

export type GradeBandRange = {
  letter: string;
  minScore: number;
  maxScore: number;
};

export function resolveGradeBandLevel(classGrade: string | null | undefined): GradeBandLevel {
  const value = (classGrade ?? '').trim().toUpperCase();

  if (!value) {
    return 'JUNIOR';
  }

  if (
    value.includes('JUNIOR') ||
    value.includes('JSS') ||
    value.startsWith('JS')
  ) {
    return 'JUNIOR';
  }

  if (
    value.includes('SENIOR') ||
    value.includes('SSS') ||
    value.startsWith('SS')
  ) {
    return 'SENIOR';
  }

  return 'JUNIOR';
}

export function resolveTotalScore(
  caScore: number | null | undefined,
  examScore: number | null | undefined,
  total: number | null | undefined
): number | null {
  if (total !== null && total !== undefined) {
    return total;
  }

  if (caScore == null && examScore == null) {
    return null;
  }

  return (caScore ?? 0) + (examScore ?? 0);
}

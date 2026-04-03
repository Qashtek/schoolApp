'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';

type Student = {
  id: string;
  firstName: string;
  lastName: string;
  admissionNumber?: string;
};

type Subject = {
  id: string;
  name: string;
  code?: string;
};

type ExistingGrade = {
  studentId: string;
  subjectId: string;
  caScore: number | null;
  examScore: number | null;
  total?: number | null;
  grade?: string | null;
};

type GradeFormProps = {
  students: Student[];
  subjects: Subject[];
  classId: string;
  termId: string;
  existingGrades: ExistingGrade[];
};

type ScoreState = {
  caScore: string;
  examScore: string;
};

function getCellKey(studentId: string, subjectId: string): string {
  return `${studentId}:${subjectId}`;
}

function parseOptionalScore(value: string): number | null {
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  const numericValue = Number(trimmed);
  if (!Number.isFinite(numericValue)) {
    return null;
  }

  return numericValue;
}

function formatTotal(total: number): string {
  if (Number.isInteger(total)) {
    return String(total);
  }

  return total.toFixed(2).replace(/\.?0+$/, '');
}

export default function GradeForm({
  students,
  subjects,
  classId,
  termId,
  existingGrades,
}: GradeFormProps) {
  const router = useRouter();

  const [isSavingStudentId, setIsSavingStudentId] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  const existingGradeMap = useMemo(() => {
    const map = new Map<string, ExistingGrade>();
    for (const grade of existingGrades) {
      map.set(getCellKey(grade.studentId, grade.subjectId), grade);
    }
    return map;
  }, [existingGrades]);

  const [scores, setScores] = useState<Record<string, ScoreState>>(() => {
    const initialState: Record<string, ScoreState> = {};

    for (const student of students) {
      for (const subject of subjects) {
        const cellKey = getCellKey(student.id, subject.id);
        const existing = existingGradeMap.get(cellKey);

        initialState[cellKey] = {
          caScore: existing?.caScore != null ? String(existing.caScore) : '',
          examScore: existing?.examScore != null ? String(existing.examScore) : '',
        };
      }
    }

    return initialState;
  });

  const handleScoreChange = (
    studentId: string,
    subjectId: string,
    field: 'caScore' | 'examScore',
    value: string
  ) => {
    const cellKey = getCellKey(studentId, subjectId);

    setScores(prev => ({
      ...prev,
      [cellKey]: {
        ...(prev[cellKey] ?? { caScore: '', examScore: '' }),
        [field]: value,
      },
    }));
  };

  const getTotalDisplay = (studentId: string, subjectId: string): string => {
    const cellKey = getCellKey(studentId, subjectId);
    const value = scores[cellKey] ?? { caScore: '', examScore: '' };

    const caScore = parseOptionalScore(value.caScore);
    const examScore = parseOptionalScore(value.examScore);

    if (caScore === null && examScore === null) {
      return '-';
    }

    return formatTotal((caScore ?? 0) + (examScore ?? 0));
  };

  const saveStudentGrades = async (studentId: string) => {
    setSuccessMessage('');
    setErrorMessage('');
    setIsSavingStudentId(studentId);

    try {
      const requests: Promise<Response>[] = [];

      for (const subject of subjects) {
        const cellKey = getCellKey(studentId, subject.id);
        const currentValue = scores[cellKey] ?? { caScore: '', examScore: '' };
        const existing = existingGradeMap.get(cellKey);

        const caScore = parseOptionalScore(currentValue.caScore);
        const examScore = parseOptionalScore(currentValue.examScore);

        // Skip brand new empty cells; submit filled cells and existing grades (supports clearing scores).
        if (!existing && caScore === null && examScore === null) {
          continue;
        }

        const payload: {
          studentId: string;
          subjectId: string;
          classId: string;
          termId: string;
          caScore?: number;
          examScore?: number;
        } = {
          studentId,
          subjectId: subject.id,
          classId,
          termId,
        };

        if (caScore !== null) {
          payload.caScore = caScore;
        }

        if (examScore !== null) {
          payload.examScore = examScore;
        }

        requests.push(
          fetch('/api/grades', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
          })
        );
      }

      if (requests.length === 0) {
        setSuccessMessage('Nothing to save for this student.');
        return;
      }

      const responses = await Promise.all(requests);
      const failedResponse = responses.find(response => !response.ok);

      if (failedResponse) {
        let message = 'Failed to save grades';

        try {
          const data = await failedResponse.json();
          message = typeof data?.error === 'string' ? data.error : message;
        } catch {
          message = 'Failed to save grades';
        }

        throw new Error(message);
      }

      const student = students.find(item => item.id === studentId);
      const studentName = student ? `${student.firstName} ${student.lastName}` : 'student';

      setSuccessMessage(`Grades saved successfully for ${studentName}.`);
      router.refresh();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Failed to save grades');
    } finally {
      setIsSavingStudentId(null);
    }
  };

  if (students.length === 0) {
    return (
      <div className="rounded-lg border border-gray-200 bg-white px-4 py-6">
        <p className="text-sm text-gray-500">No students found in this class.</p>
      </div>
    );
  }

  if (subjects.length === 0) {
    return (
      <div className="rounded-lg border border-gray-200 bg-white px-4 py-6">
        <p className="text-sm text-gray-500">No subjects assigned to this class.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {successMessage ? (
        <div className="rounded-md border border-green-200 bg-green-50 px-4 py-3">
          <p className="text-sm text-green-700">{successMessage}</p>
        </div>
      ) : null}

      {errorMessage ? (
        <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3">
          <p className="text-sm text-red-700">{errorMessage}</p>
        </div>
      ) : null}

      <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="sticky left-0 z-10 bg-gray-50 px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-600">
                Student
              </th>
              {subjects.map(subject => (
                <th
                  key={subject.id}
                  className="min-w-[260px] px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-600"
                >
                  <span>{subject.name}</span>
                  {subject.code ? (
                    <span className="ml-1 text-gray-400">({subject.code})</span>
                  ) : null}
                </th>
              ))}
              <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-gray-600">
                Action
              </th>
            </tr>
          </thead>

          <tbody className="divide-y divide-gray-100 bg-white">
            {students.map(student => (
              <tr key={student.id}>
                <td className="sticky left-0 z-10 bg-white px-4 py-4 align-top">
                  <p className="text-sm font-medium text-gray-900">
                    {student.firstName} {student.lastName}
                  </p>
                  {student.admissionNumber ? (
                    <p className="text-xs text-gray-500">{student.admissionNumber}</p>
                  ) : null}
                </td>

                {subjects.map(subject => {
                  const cellKey = getCellKey(student.id, subject.id);
                  const cellState = scores[cellKey] ?? { caScore: '', examScore: '' };

                  return (
                    <td key={subject.id} className="px-4 py-4 align-top">
                      <div className="grid grid-cols-3 gap-2">
                        <label className="space-y-1">
                          <span className="block text-[11px] font-medium uppercase tracking-wide text-gray-500">
                            CA
                          </span>
                          <input
                            type="number"
                            min={0}
                            max={100}
                            step="0.01"
                            value={cellState.caScore}
                            onChange={event =>
                              handleScoreChange(student.id, subject.id, 'caScore', event.target.value)
                            }
                            className="w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                          />
                        </label>

                        <label className="space-y-1">
                          <span className="block text-[11px] font-medium uppercase tracking-wide text-gray-500">
                            Exam
                          </span>
                          <input
                            type="number"
                            min={0}
                            max={100}
                            step="0.01"
                            value={cellState.examScore}
                            onChange={event =>
                              handleScoreChange(student.id, subject.id, 'examScore', event.target.value)
                            }
                            className="w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                          />
                        </label>

                        <div className="space-y-1">
                          <span className="block text-[11px] font-medium uppercase tracking-wide text-gray-500">
                            Total
                          </span>
                          <div className="rounded-md border border-gray-200 bg-gray-50 px-2 py-1.5 text-sm font-medium text-gray-800">
                            {getTotalDisplay(student.id, subject.id)}
                          </div>
                        </div>
                      </div>
                    </td>
                  );
                })}

                <td className="px-4 py-4 align-top text-right">
                  <button
                    type="button"
                    onClick={() => void saveStudentGrades(student.id)}
                    disabled={isSavingStudentId === student.id}
                    className="rounded-md bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {isSavingStudentId === student.id ? 'Saving...' : 'Save Row'}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

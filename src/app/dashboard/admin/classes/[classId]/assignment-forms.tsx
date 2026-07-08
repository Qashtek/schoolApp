'use client';

import { FormEvent, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, Trash2, UserCheck, BookOpen } from 'lucide-react';

interface TeacherOption {
  id: string;
  name: string | null;
  email: string;
}

interface SubjectOption {
  id: string;
  name: string;
  code: string;
}

interface ClassTeacherInfo {
  id: string;
  teacherId: string;
  teacherName: string | null;
  teacherEmail: string;
}

interface SubjectTeacherInfo {
  id: string;
  teacherId: string;
  teacherName: string | null;
  teacherEmail: string;
  subjectId: string;
  subjectName: string;
  subjectCode: string;
}

interface ClassDetailAssignmentManagerProps {
  classId: string;
  classTeacher: ClassTeacherInfo | null;
  subjectTeachers: SubjectTeacherInfo[];
  teacherOptions: TeacherOption[];
  subjectOptions: SubjectOption[];
}

export function ClassDetailAssignmentManager({
  classId,
  classTeacher,
  subjectTeachers,
  teacherOptions,
  subjectOptions,
}: ClassDetailAssignmentManagerProps) {
  const router = useRouter();
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Class teacher form
  const [classTeacherId, setClassTeacherId] = useState('');
  const [isAssigningClassTeacher, setIsAssigningClassTeacher] = useState(false);
  const [isRemovingClassTeacher, setIsRemovingClassTeacher] = useState(false);

  // Subject teacher form
  const [subjectTeacherId, setSubjectTeacherId] = useState('');
  const [subjectSelectorSubjectId, setSubjectSelectorSubjectId] = useState('');
  const [isAddingSubjectTeacher, setIsAddingSubjectTeacher] = useState(false);
  const [isRemovingSubjectTeacher, setIsRemovingSubjectTeacher] = useState<string | null>(null);

  const clearMessages = () => {
    setError('');
    setSuccess('');
  };

  const handleAssignClassTeacher = async (e: FormEvent) => {
    e.preventDefault();
    clearMessages();

    if (!classTeacherId) {
      setError('Please select a teacher');
      return;
    }

    setIsAssigningClassTeacher(true);

    try {
      const response = await fetch(`/api/teachers/${classTeacherId}/assignments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          classId,
          assignmentType: 'CLASS_TEACHER',
        }),
      });

      const payload = await response.json().catch(() => null);

      if (!response.ok) {
        setError(payload?.error || 'Failed to assign class teacher');
        return;
      }

      setSuccess('Class teacher assigned successfully');
      setClassTeacherId('');
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setIsAssigningClassTeacher(false);
    }
  };

  const handleRemoveClassTeacher = async () => {
    if (!classTeacher) return;

    if (!window.confirm('Remove this class teacher assignment?')) {
      return;
    }

    clearMessages();
    setIsRemovingClassTeacher(true);

    try {
      const response = await fetch(
        `/api/teachers/${classTeacher.teacherId}/assignments?assignmentId=${classTeacher.id}`,
        { method: 'DELETE' }
      );

      const payload = await response.json().catch(() => null);

      if (!response.ok) {
        setError(payload?.error || 'Failed to remove class teacher');
        return;
      }

      setSuccess('Class teacher removed');
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setIsRemovingClassTeacher(false);
    }
  };

  const handleAddSubjectTeacher = async (e: FormEvent) => {
    e.preventDefault();
    clearMessages();

    if (!subjectTeacherId) {
      setError('Please select a teacher');
      return;
    }

    if (!subjectSelectorSubjectId) {
      setError('Please select a subject');
      return;
    }

    setIsAddingSubjectTeacher(true);

    try {
      const response = await fetch(`/api/teachers/${subjectTeacherId}/assignments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          classId,
          assignmentType: 'SUBJECT_TEACHER',
          subjectId: subjectSelectorSubjectId,
        }),
      });

      const payload = await response.json().catch(() => null);

      if (!response.ok) {
        setError(payload?.error || 'Failed to add subject teacher');
        return;
      }

      setSuccess('Subject teacher added successfully');
      setSubjectTeacherId('');
      setSubjectSelectorSubjectId('');
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setIsAddingSubjectTeacher(false);
    }
  };

  const handleRemoveSubjectTeacher = async (assignment: SubjectTeacherInfo) => {
    if (!window.confirm(`Remove ${assignment.teacherName || assignment.teacherEmail} as subject teacher for ${assignment.subjectName}?`)) {
      return;
    }

    clearMessages();
    setIsRemovingSubjectTeacher(assignment.id);

    try {
      const response = await fetch(
        `/api/teachers/${assignment.teacherId}/assignments?assignmentId=${assignment.id}`,
        { method: 'DELETE' }
      );

      const payload = await response.json().catch(() => null);

      if (!response.ok) {
        setError(payload?.error || 'Failed to remove subject teacher');
        return;
      }

      setSuccess('Subject teacher removed');
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setIsRemovingSubjectTeacher(null);
    }
  };

  return (
    <div className="space-y-8">
      {error && (
        <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}
      {success && (
        <div className="rounded-md border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">
          {success}
        </div>
      )}

      {/* Class Teacher Section */}
      <section className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
        <div className="mb-4 flex items-center justify-between gap-4">
          <h2 className="flex items-center gap-2 text-lg font-semibold text-gray-900">
            <UserCheck className="h-5 w-5" />
            Class Teacher
          </h2>
          <span className="rounded-full bg-blue-100 px-2.5 py-1 text-xs font-medium text-blue-800">
            CLASS_TEACHER
          </span>
        </div>

        {classTeacher ? (
          <div className="space-y-4">
            <div className="flex items-center justify-between rounded-md border border-blue-100 bg-blue-50 px-4 py-3 text-sm">
              <div>
                <p className="font-medium text-gray-900">
                  {classTeacher.teacherName || 'Unnamed Teacher'}
                </p>
                <p className="text-gray-600">{classTeacher.teacherEmail}</p>
              </div>
              <button
                onClick={handleRemoveClassTeacher}
                disabled={isRemovingClassTeacher}
                className="inline-flex items-center gap-1 rounded-md border border-red-200 bg-red-50 px-2.5 py-1.5 text-xs font-medium text-red-700 hover:bg-red-100 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Trash2 className="w-3 h-3" />
                {isRemovingClassTeacher ? 'Removing...' : 'Remove'}
              </button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleAssignClassTeacher} className="space-y-3">
            <p className="text-sm text-gray-500">No class teacher assigned.</p>
            <div>
              <label htmlFor="classTeacherSelect" className="mb-1 block text-sm font-medium text-gray-700">
                Assign Class Teacher
              </label>
              <select
                id="classTeacherSelect"
                value={classTeacherId}
                onChange={(e) => setClassTeacherId(e.target.value)}
                disabled={isAssigningClassTeacher}
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100"
              >
                <option value="">Select a teacher</option>
                {teacherOptions.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name || t.email} ({t.email})
                  </option>
                ))}
              </select>
            </div>
            <button
              type="submit"
              disabled={isAssigningClassTeacher}
              className="inline-flex items-center gap-2 rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Plus className="h-4 w-4" />
              {isAssigningClassTeacher ? 'Assigning...' : 'Assign Class Teacher'}
            </button>
          </form>
        )}
      </section>

      {/* Subject Teachers Section */}
      <section className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
        <div className="mb-4 flex items-center justify-between gap-4">
          <h2 className="flex items-center gap-2 text-lg font-semibold text-gray-900">
            <BookOpen className="h-5 w-5" />
            Subject Teachers
          </h2>
          <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-medium text-emerald-800">
            SUBJECT_TEACHER
          </span>
        </div>

        {/* Current Subject Teachers Table */}
        {subjectTeachers.length === 0 ? (
          <p className="mb-6 rounded-md border border-gray-100 bg-gray-50 px-4 py-3 text-sm text-gray-500">
            No subject teachers assigned.
          </p>
        ) : (
          <div className="mb-6 overflow-hidden rounded-lg border border-gray-200">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                    Teacher
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                    Subject
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-500">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 bg-white">
                {subjectTeachers.map((assignment) => (
                  <tr key={assignment.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-sm text-gray-900">
                      {assignment.teacherName || 'Unnamed Teacher'}
                      <span className="ml-1 text-xs text-gray-500">({assignment.teacherEmail})</span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center rounded-full bg-blue-50 px-2.5 py-0.5 text-xs font-medium text-blue-700 ring-1 ring-inset ring-blue-200">
                        {assignment.subjectName} ({assignment.subjectCode})
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={() => handleRemoveSubjectTeacher(assignment)}
                        disabled={isRemovingSubjectTeacher === assignment.id}
                        className="inline-flex items-center gap-1 rounded-md border border-red-200 bg-red-50 px-2.5 py-1.5 text-xs font-medium text-red-700 hover:bg-red-100 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <Trash2 className="w-3 h-3" />
                        {isRemovingSubjectTeacher === assignment.id ? 'Removing...' : 'Remove'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Add Subject Teacher Form */}
        <div className="rounded-lg border border-dashed border-gray-300 bg-gray-50 p-4">
          <h3 className="mb-3 text-sm font-medium text-gray-700">Add Subject Teacher</h3>
          <form onSubmit={handleAddSubjectTeacher} className="space-y-3">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label htmlFor="subjectTeacherSelect" className="mb-1 block text-xs font-medium text-gray-600">
                  Teacher
                </label>
                <select
                  id="subjectTeacherSelect"
                  value={subjectTeacherId}
                  onChange={(e) => setSubjectTeacherId(e.target.value)}
                  disabled={isAddingSubjectTeacher}
                  className="block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 disabled:bg-gray-100"
                >
                  <option value="">Select a teacher</option>
                  {teacherOptions.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name || t.email} ({t.email})
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor="subjectTeacherSubject" className="mb-1 block text-xs font-medium text-gray-600">
                  Subject
                </label>
                <select
                  id="subjectTeacherSubject"
                  value={subjectSelectorSubjectId}
                  onChange={(e) => setSubjectSelectorSubjectId(e.target.value)}
                  disabled={isAddingSubjectTeacher}
                  className="block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 disabled:bg-gray-100"
                >
                  <option value="">Select a subject</option>
                  {subjectOptions.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name} ({s.code})
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <button
              type="submit"
              disabled={isAddingSubjectTeacher}
              className="inline-flex items-center gap-1.5 rounded-md bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Plus className="h-4 w-4" />
              {isAddingSubjectTeacher ? 'Adding...' : 'Add Subject Teacher'}
            </button>
          </form>
        </div>
      </section>
    </div>
  );
}

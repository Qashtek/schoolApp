'use client';

import { FormEvent, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, Trash2, UserCheck, BookOpen } from 'lucide-react';

interface ClassTeacherInfo {
  id: string;
  classId: string;
  className: string;
  classGrade: string;
}

interface SubjectTeacherInfo {
  id: string;
  classId: string;
  className: string;
  classGrade: string;
  subjectId: string;
  subjectName: string;
  subjectCode: string;
}

interface ClassOption {
  id: string;
  name: string;
  grade: string;
}

interface SubjectOption {
  id: string;
  name: string;
  code: string;
}

interface AssignmentManagerProps {
  teacherId: string;
  classTeacherAssignment: ClassTeacherInfo | null;
  subjectTeacherAssignments: SubjectTeacherInfo[];
  allClasses: ClassOption[];
  allSubjects: SubjectOption[];
}

export function AssignmentManager({
  teacherId,
  classTeacherAssignment,
  subjectTeacherAssignments,
  allClasses,
  allSubjects,
}: AssignmentManagerProps) {
  const router = useRouter();
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Class teacher form state
  const [classTeacherClassId, setClassTeacherClassId] = useState('');
  const [isAssigningClassTeacher, setIsAssigningClassTeacher] = useState(false);
  const [isRemovingClassTeacher, setIsRemovingClassTeacher] = useState(false);

  // Subject teacher form state
  const [subjectClassId, setSubjectClassId] = useState('');
  const [subjectSubjectId, setSubjectSubjectId] = useState('');
  const [isAddingSubjectTeacher, setIsAddingSubjectTeacher] = useState(false);
  const [isRemovingSubjectTeacher, setIsRemovingSubjectTeacher] = useState<string | null>(null);

  const clearMessages = () => {
    setError('');
    setSuccess('');
  };

  const handleAssignClassTeacher = async (e: FormEvent) => {
    e.preventDefault();
    clearMessages();

    if (!classTeacherClassId) {
      setError('Please select a class');
      return;
    }

    setIsAssigningClassTeacher(true);

    try {
      const response = await fetch(`/api/teachers/${teacherId}/assignments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          classId: classTeacherClassId,
          assignmentType: 'CLASS_TEACHER',
        }),
      });

      const payload = await response.json().catch(() => null);

      if (!response.ok) {
        setError(payload?.error || 'Failed to assign class teacher');
        return;
      }

      setSuccess('Class teacher assigned successfully');
      setClassTeacherClassId('');
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setIsAssigningClassTeacher(false);
    }
  };

  const handleRemoveClassTeacher = async () => {
    if (!classTeacherAssignment) return;

    if (!window.confirm('Remove this teacher as class teacher for this class?')) {
      return;
    }

    clearMessages();
    setIsRemovingClassTeacher(true);

    try {
      const response = await fetch(
        `/api/teachers/${teacherId}/assignments?assignmentId=${classTeacherAssignment.id}`,
        { method: 'DELETE' }
      );

      const payload = await response.json().catch(() => null);

      if (!response.ok) {
        setError(payload?.error || 'Failed to remove class teacher');
        return;
      }

      setSuccess('Class teacher assignment removed');
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

    if (!subjectClassId) {
      setError('Please select a class');
      return;
    }

    if (!subjectSubjectId) {
      setError('Please select a subject');
      return;
    }

    setIsAddingSubjectTeacher(true);

    try {
      const response = await fetch(`/api/teachers/${teacherId}/assignments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          classId: subjectClassId,
          assignmentType: 'SUBJECT_TEACHER',
          subjectId: subjectSubjectId,
        }),
      });

      const payload = await response.json().catch(() => null);

      if (!response.ok) {
        setError(payload?.error || 'Failed to add subject teaching assignment');
        return;
      }

      setSuccess('Subject teaching assignment added');
      setSubjectClassId('');
      setSubjectSubjectId('');
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setIsAddingSubjectTeacher(false);
    }
  };

  const handleRemoveSubjectTeacher = async (assignmentId: string) => {
    if (!window.confirm('Remove this subject teaching assignment?')) {
      return;
    }

    clearMessages();
    setIsRemovingSubjectTeacher(assignmentId);

    try {
      const response = await fetch(
        `/api/teachers/${teacherId}/assignments?assignmentId=${assignmentId}`,
        { method: 'DELETE' }
      );

      const payload = await response.json().catch(() => null);

      if (!response.ok) {
        setError(payload?.error || 'Failed to remove subject teaching assignment');
        return;
      }

      setSuccess('Subject teaching assignment removed');
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setIsRemovingSubjectTeacher(null);
    }
  };

  return (
    <div className="space-y-6">
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

      {/* Class Teacher Assignment Section */}
      <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
          <UserCheck className="w-5 h-5" />
          Class Teacher Assignment
        </h2>

        {classTeacherAssignment ? (
          <div className="flex items-center justify-between rounded-md border border-blue-100 bg-blue-50 px-4 py-3">
            <div>
              <p className="text-sm font-medium text-gray-900">
                {classTeacherAssignment.className}
              </p>
              <p className="text-xs text-gray-500">Grade {classTeacherAssignment.classGrade}</p>
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
        ) : (
          <form onSubmit={handleAssignClassTeacher} className="space-y-3">
            <p className="text-sm text-gray-500">This teacher is not assigned as a class teacher.</p>
            <div>
              <label htmlFor="classTeacherClass" className="block text-sm font-medium text-gray-700 mb-1">
                Assign as Class Teacher
              </label>
              <select
                id="classTeacherClass"
                value={classTeacherClassId}
                onChange={(e) => setClassTeacherClassId(e.target.value)}
                disabled={isAssigningClassTeacher}
                className="block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100"
              >
                <option value="">Select a class</option>
                {allClasses.map((cls) => (
                  <option key={cls.id} value={cls.id}>
                    {cls.name} - Grade {cls.grade}
                  </option>
                ))}
              </select>
              <p className="mt-1 text-xs text-gray-500">
                The class teacher is responsible for taking attendance for this class.
              </p>
            </div>
            <button
              type="submit"
              disabled={isAssigningClassTeacher}
              className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isAssigningClassTeacher ? 'Assigning...' : 'Assign as Class Teacher'}
            </button>
          </form>
        )}
      </div>

      {/* Subject Teaching Assignments Section */}
      <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
          <BookOpen className="w-5 h-5" />
          Subject Teaching Assignments
        </h2>

        {/* Current Subject Teacher Assignments Table */}
        {subjectTeacherAssignments.length === 0 ? (
          <p className="text-sm text-gray-500 mb-6 bg-gray-50 rounded-md px-4 py-3">
            No subject teaching assignments yet.
          </p>
        ) : (
          <div className="overflow-hidden rounded-lg border border-gray-200 mb-6">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                    Class
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
                {subjectTeacherAssignments.map((assignment) => (
                  <tr key={assignment.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-sm text-gray-900">
                      {assignment.className}
                      <span className="text-xs text-gray-500 ml-1">(Grade {assignment.classGrade})</span>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-900">
                      {assignment.subjectName}
                      <span className="text-xs text-gray-500 ml-1">({assignment.subjectCode})</span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={() => handleRemoveSubjectTeacher(assignment.id)}
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
          <h3 className="text-sm font-medium text-gray-700 mb-3">Add Subject Teaching Assignment</h3>
          <form onSubmit={handleAddSubjectTeacher} className="space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label htmlFor="subjectClass" className="block text-xs font-medium text-gray-600 mb-1">
                  Class
                </label>
                <select
                  id="subjectClass"
                  value={subjectClassId}
                  onChange={(e) => {
                    setSubjectClassId(e.target.value);
                    setSubjectSubjectId('');
                  }}
                  disabled={isAddingSubjectTeacher}
                  className="block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100"
                >
                  <option value="">Select class</option>
                  {allClasses.map((cls) => (
                    <option key={cls.id} value={cls.id}>
                      {cls.name} - Grade {cls.grade}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor="subjectSubject" className="block text-xs font-medium text-gray-600 mb-1">
                  Subject
                </label>
                <select
                  id="subjectSubject"
                  value={subjectSubjectId}
                  onChange={(e) => setSubjectSubjectId(e.target.value)}
                  disabled={isAddingSubjectTeacher}
                  className="block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100"
                >
                  <option value="">Select subject</option>
                  {allSubjects.map((subject) => (
                    <option key={subject.id} value={subject.id}>
                      {subject.name} ({subject.code})
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <button
              type="submit"
              disabled={isAddingSubjectTeacher}
              className="inline-flex items-center gap-1.5 rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Plus className="w-4 h-4" />
              {isAddingSubjectTeacher ? 'Adding...' : 'Add Assignment'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

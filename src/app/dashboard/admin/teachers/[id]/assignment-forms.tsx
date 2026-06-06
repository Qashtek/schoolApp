'use client';

import { FormEvent, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Trash2 } from 'lucide-react';

type AvailableSubject = {
  id: string;
  name: string;
  code: string;
};

type AssignedSubject = {
  id: string;
  teacherSubjectId: string;
  name: string;
  code: string;
};

type ManageSubjectsFormProps = {
  teacherId: string;
  assignedSubjects: AssignedSubject[];
  availableSubjects: AvailableSubject[];
};

export function ManageSubjectsForm({
  teacherId,
  assignedSubjects,
  availableSubjects,
}: ManageSubjectsFormProps) {
  const router = useRouter();
  const [subjectId, setSubjectId] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [isAssigning, setIsAssigning] = useState(false);
  const [isRemoving, setIsRemoving] = useState(false);
  const [removingId, setRemovingId] = useState<string | null>(null);

  const handleAssignSubject = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError('');
    setSuccess('');

    if (!subjectId) {
      setError('Subject is required');
      return;
    }

    setIsAssigning(true);

    try {
      const response = await fetch(`/api/subjects/${subjectId}/teachers`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ teacherId }),
      });

      const payload = await response.json().catch(() => null);

      if (!response.ok) {
        setError(payload?.error || 'Failed to assign subject');
        return;
      }

      setSuccess('Subject assigned successfully');
      setSubjectId('');
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to assign subject');
    } finally {
      setIsAssigning(false);
    }
  };

  const handleRemoveSubject = async (subjectIdToRemove: string) => {
    if (!window.confirm('Are you sure you want to unassign this subject from the teacher?')) {
      return;
    }

    setIsRemoving(true);
    setRemovingId(subjectIdToRemove);
    setError('');
    setSuccess('');

    try {
      const response = await fetch(`/api/teachers/${teacherId}/subjects`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ subjectId: subjectIdToRemove }),
      });

      const payload = await response.json().catch(() => null);

      if (!response.ok) {
        setError(payload?.error || 'Failed to remove subject');
        return;
      }

      setSuccess('Subject unassigned successfully');
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to remove subject');
    } finally {
      setIsRemoving(false);
      setRemovingId(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Assigned Subjects List */}
      <div>
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Assigned Subjects</h3>
        {assignedSubjects.length === 0 ? (
          <p className="text-sm text-gray-500 bg-gray-50 px-4 py-3 rounded-md">
            No subjects assigned yet.
          </p>
        ) : (
          <div className="space-y-2">
            {assignedSubjects.map((subject) => (
              <div
                key={subject.id}
                className="flex items-center justify-between rounded-md border border-gray-100 bg-gray-50 px-4 py-3 text-sm"
              >
                <div>
                  <p className="font-medium text-gray-900">{subject.name}</p>
                  <p className="text-xs text-gray-500">Code: {subject.code}</p>
                </div>
                <button
                  onClick={() => handleRemoveSubject(subject.id)}
                  disabled={isRemoving && removingId === subject.id}
                  className="inline-flex items-center gap-1 rounded-md border border-red-200 bg-red-50 px-2.5 py-1.5 text-xs font-medium text-red-700 hover:bg-red-100 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Trash2 className="w-3 h-3" />
                  {isRemoving && removingId === subject.id ? 'Removing...' : 'Remove'}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Assign New Subject Form */}
      <div>
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Assign New Subject</h3>
        <form onSubmit={handleAssignSubject} className="space-y-3">
          <div>
            <label htmlFor="subjectId" className="block text-sm font-medium text-gray-700 mb-1">
              Subject
            </label>
            <select
              id="subjectId"
              name="subjectId"
              value={subjectId}
              onChange={(event) => setSubjectId(event.target.value)}
              disabled={availableSubjects.length === 0 || isAssigning}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100"
            >
              <option value="" disabled>
                {availableSubjects.length === 0 ? 'No subjects available' : 'Select a subject'}
              </option>
              {availableSubjects.map((subject) => (
                <option key={subject.id} value={subject.id}>
                  {subject.name} ({subject.code})
                </option>
              ))}
            </select>
          </div>

          {error && (
            <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}
            </p>
          )}
          {success && (
            <p className="rounded-md border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-700">
              {success}
            </p>
          )}

          <button
            type="submit"
            disabled={availableSubjects.length === 0 || isAssigning}
            className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isAssigning ? 'Assigning...' : 'Assign Subject'}
          </button>
        </form>
      </div>
    </div>
  );
}

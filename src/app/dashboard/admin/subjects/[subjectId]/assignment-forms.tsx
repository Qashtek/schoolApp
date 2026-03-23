'use client';

import { FormEvent, useState } from 'react';
import { useRouter } from 'next/navigation';

type AvailableClass = {
  id: string;
  name: string;
  grade: string;
};

type AvailableTeacher = {
  id: string;
  name: string;
  email: string;
};

type AssignClassFormProps = {
  subjectId: string;
  availableClasses: AvailableClass[];
};

type AssignTeacherFormProps = {
  subjectId: string;
  availableTeachers: AvailableTeacher[];
};

export function AssignClassForm({ subjectId, availableClasses }: AssignClassFormProps) {
  const router = useRouter();
  const [classId, setClassId] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [isAssigning, setIsAssigning] = useState(false);

  const handleAssignClass = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError('');
    setSuccess('');

    if (!classId) {
      setError('Class is required');
      return;
    }

    setIsAssigning(true);

    try {
      const response = await fetch(`/api/subjects/${subjectId}/classes`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ classId }),
      });

      const payload = await response.json().catch(() => null);

      if (!response.ok) {
        setError(payload?.error || 'Failed to assign class');
        return;
      }

      setSuccess('Class assigned successfully');
      setClassId('');
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to assign class');
    } finally {
      setIsAssigning(false);
    }
  };

  return (
    <form onSubmit={handleAssignClass} className="mt-5 space-y-3">
      <label htmlFor="classId" className="block text-sm font-medium text-gray-700">
        Assign New Class
      </label>
      <select
        id="classId"
        name="classId"
        value={classId}
        onChange={(event) => setClassId(event.target.value)}
        disabled={availableClasses.length === 0 || isAssigning}
        className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100"
      >
        <option value="" disabled>
          {availableClasses.length === 0 ? 'No classes available' : 'Select a class'}
        </option>
        {availableClasses.map((entry) => (
          <option key={entry.id} value={entry.id}>
            {entry.name} ({entry.grade})
          </option>
        ))}
      </select>
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
        disabled={availableClasses.length === 0 || isAssigning}
        className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {isAssigning ? 'Assigning...' : 'Assign Class'}
      </button>
    </form>
  );
}

export function AssignTeacherForm({ subjectId, availableTeachers }: AssignTeacherFormProps) {
  const router = useRouter();
  const [teacherId, setTeacherId] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [isAssigning, setIsAssigning] = useState(false);

  const handleAssignTeacher = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError('');
    setSuccess('');

    if (!teacherId) {
      setError('Teacher is required');
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
        setError(payload?.error || 'Failed to assign teacher');
        return;
      }

      setSuccess('Teacher assigned successfully');
      setTeacherId('');
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to assign teacher');
    } finally {
      setIsAssigning(false);
    }
  };

  return (
    <form onSubmit={handleAssignTeacher} className="mt-5 space-y-3">
      <label htmlFor="teacherId" className="block text-sm font-medium text-gray-700">
        Assign New Teacher
      </label>
      <select
        id="teacherId"
        name="teacherId"
        value={teacherId}
        onChange={(event) => setTeacherId(event.target.value)}
        disabled={availableTeachers.length === 0 || isAssigning}
        className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100"
      >
        <option value="" disabled>
          {availableTeachers.length === 0 ? 'No teachers available' : 'Select a teacher'}
        </option>
        {availableTeachers.map((entry) => (
          <option key={entry.id} value={entry.id}>
            {entry.name} ({entry.email})
          </option>
        ))}
      </select>
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
        disabled={availableTeachers.length === 0 || isAssigning}
        className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {isAssigning ? 'Assigning...' : 'Assign Teacher'}
      </button>
    </form>
  );
}

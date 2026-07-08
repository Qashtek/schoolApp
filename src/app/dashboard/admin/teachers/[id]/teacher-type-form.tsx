'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { AlertCircle, CheckCircle } from 'lucide-react';

interface TeacherTypeFormProps {
  teacherId: string;
  initialType: string;
}

export function TeacherTypeForm({ teacherId, initialType }: TeacherTypeFormProps) {
  const router = useRouter();
  const [type, setType] = useState<'CLASS_TEACHER' | 'SUBJECT_TEACHER'>(
    initialType as 'CLASS_TEACHER' | 'SUBJECT_TEACHER'
  );
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');
    setSuccess('');

    try {
      const response = await fetch(`/api/teachers/${teacherId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ type }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to update teacher type');
      }

      setSuccess('Teacher type updated successfully');
      router.refresh();

      // Clear success message after 3 seconds
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'An error occurred';
      setError(message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && (
        <div className="flex items-start gap-3 rounded-md bg-red-50 p-3 border border-red-200">
          <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
          <p className="text-sm text-red-600">{error}</p>
        </div>
      )}

      {success && (
        <div className="flex items-start gap-3 rounded-md bg-green-50 p-3 border border-green-200">
          <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
          <p className="text-sm text-green-600">{success}</p>
        </div>
      )}

      <div>
        <label htmlFor="type" className="block text-sm font-medium text-gray-700 mb-2">
          Teacher Type
        </label>
        <select
          id="type"
          value={type}
          onChange={(e) => setType(e.target.value as 'CLASS_TEACHER' | 'SUBJECT_TEACHER')}
          disabled={isLoading}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
        >
          <option value="CLASS_TEACHER">Class Teacher (Can take attendance)</option>
          <option value="SUBJECT_TEACHER">Subject Teacher (Can grade only)</option>
        </select>
        <p className="mt-2 text-xs text-gray-500">
          {type === 'CLASS_TEACHER'
            ? 'This teacher can take attendance for their assigned classes.'
            : 'This teacher can only grade students for their assigned subjects and classes.'}
        </p>
      </div>

      <button
        type="submit"
        disabled={isLoading || type === initialType}
        className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
      >
        {isLoading ? 'Updating...' : 'Update Teacher Type'}
      </button>
    </form>
  );
}

'use client';

import { FormEvent, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';

type UnlinkedStudent = {
  id: string;
  firstName: string;
  lastName: string;
  admissionNumber: string;
  grade: string | null;
};

type LinkStudentFormProps = {
  parentId: string;
  students: UnlinkedStudent[];
};

export function LinkStudentForm({ parentId, students }: LinkStudentFormProps) {
  const router = useRouter();
  const dropdownRef = useRef<HTMLDivElement | null>(null);
  const searchInputRef = useRef<HTMLInputElement | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [studentId, setStudentId] = useState('');
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const filteredStudents = useMemo(() => {
    const normalizedQuery = searchQuery.trim().toLowerCase();

    if (!normalizedQuery) {
      return students;
    }

    return students.filter((student) => {
      const fullName = `${student.firstName} ${student.lastName}`.toLowerCase();
      const admissionNumber = student.admissionNumber.toLowerCase();
      const grade = (student.grade ?? '').toLowerCase();

      return (
        fullName.includes(normalizedQuery) ||
        admissionNumber.includes(normalizedQuery) ||
        grade.includes(normalizedQuery)
      );
    });
  }, [searchQuery, students]);

  const selectedStudent = students.find((student) => student.id === studentId);

  useEffect(() => {
    if (!isDropdownOpen) {
      return;
    }

    searchInputRef.current?.focus();

    const handleClickOutside = (event: MouseEvent) => {
      if (!dropdownRef.current?.contains(event.target as Node)) {
        setIsDropdownOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isDropdownOpen]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError('');
    setSuccess('');

    if (!studentId) {
      setError('Please select a student to link.');
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await fetch(`/api/parents/${parentId}/students`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ studentId }),
      });

      const payload = await response.json().catch(() => null);

      if (!response.ok) {
        setError(payload?.error || 'Failed to link student');
        return;
      }

      setSuccess('Student linked successfully.');
      setStudentId('');
      setSearchQuery('');
      setIsDropdownOpen(false);
      router.refresh();
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Failed to link student');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="mt-4 space-y-3">
      <div className="space-y-1">
        <label htmlFor="studentId" className="block text-sm font-medium text-gray-700">
          Select student
        </label>
        <div ref={dropdownRef} className="relative w-full sm:max-w-md">
          <button
            id="studentId"
            type="button"
            onClick={() => setIsDropdownOpen((prev) => !prev)}
            disabled={students.length === 0 || isSubmitting}
            className="flex w-full items-center justify-between rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:cursor-not-allowed disabled:bg-gray-100"
          >
            <span className={selectedStudent ? 'text-gray-900' : 'text-gray-500'}>
              {selectedStudent
                ? `${selectedStudent.firstName} ${selectedStudent.lastName} (${selectedStudent.admissionNumber})`
                : students.length === 0
                  ? 'No students available'
                  : 'Select a student'}
            </span>
            <span className="text-xs text-gray-400">{isDropdownOpen ? '▲' : '▼'}</span>
          </button>

          {isDropdownOpen && (
            <div className="absolute z-20 mt-1 w-full rounded-md border border-gray-200 bg-white shadow-lg">
              <div className="border-b border-gray-100 p-2">
                <input
                  ref={searchInputRef}
                  type="text"
                  value={searchQuery}
                  onChange={(event) => setSearchQuery(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === 'Escape') {
                      setIsDropdownOpen(false);
                    }
                  }}
                  placeholder="Search by name, admission number, or grade"
                  className="w-full rounded-md border border-gray-300 px-2.5 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <ul className="max-h-56 overflow-auto py-1">
                {filteredStudents.length === 0 ? (
                  <li className="px-3 py-2 text-sm text-gray-500">No students found</li>
                ) : (
                  filteredStudents.map((student) => (
                    <li key={student.id}>
                      <button
                        type="button"
                        onClick={() => {
                          setStudentId(student.id);
                          setSearchQuery('');
                          setIsDropdownOpen(false);
                        }}
                        className={`w-full px-3 py-2 text-left text-sm hover:bg-gray-100 ${
                          student.id === studentId ? 'bg-blue-50 text-blue-700' : 'text-gray-700'
                        }`}
                      >
                        {student.firstName} {student.lastName} ({student.admissionNumber})
                      </button>
                    </li>
                  ))
                )}
              </ul>
            </div>
          )}
        </div>
        <input type="hidden" name="studentId" value={studentId} />
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
        disabled={!studentId || isSubmitting}
        className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {isSubmitting ? 'Linking...' : 'Link Student'}
      </button>
    </form>
  );
}

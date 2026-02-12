'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

interface Student {
  id: string;
  user: {
    id: string;
    name: string | null;
    email: string;
  };
}

interface AttendanceFormProps {
  classId: string;
  students: Student[];
  isAlreadyMarked: boolean;
  existingAttendance: Record<string, 'PRESENT' | 'ABSENT' | 'LATE'>;
}

type AttendanceStatus = 'PRESENT' | 'ABSENT' | 'LATE';

interface AttendanceRecord {
  studentId: string;
  status: AttendanceStatus;
}

export default function AttendanceForm({
  classId,
  students,
  isAlreadyMarked,
  existingAttendance,
}: AttendanceFormProps) {
  const router = useRouter();
  const [attendanceRecords, setAttendanceRecords] = useState<AttendanceRecord[]>(
    students.map(student => ({
      studentId: student.id,
      status: existingAttendance[student.id] || 'PRESENT' as AttendanceStatus,
    }))
  );
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  const handleStatusChange = (studentId: string, status: AttendanceStatus) => {
    setAttendanceRecords(prev =>
      prev.map(record =>
        record.studentId === studentId ? { ...record, status } : record
      )
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    setIsSubmitting(true);
    setSuccessMessage('');
    setErrorMessage('');

    try {
      // Submit attendance for each student individually
      const promises = attendanceRecords
        .filter(record => !existingAttendance[record.studentId]) // Only submit for unmarked students
        .map(record =>
          fetch('/api/attendance', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              classId,
              studentId: record.studentId,
              status: record.status,
            }),
          }).then(response => {
            if (!response.ok) {
              return response.json().then(errorData => {
                throw new Error(errorData.error || 'Failed to mark attendance for student');
              });
            }
            return response.json();
          })
        );

      await Promise.all(promises);

      setSuccessMessage('Attendance marked successfully!');

      // Refresh the page to update existing attendance
      router.refresh();

      // Clear success message after 3-5 seconds
      setTimeout(() => {
        setSuccessMessage('');
      }, 3000);
    } catch (error) {
      console.error('Error submitting attendance:', error);
      setErrorMessage(
        error instanceof Error ? error.message : 'An unexpected error occurred'
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  if (students.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow-sm border border-gray-100 p-8 text-center">
        <p className="text-gray-500">No students enrolled in this class.</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-100">
      {/* Success/Error Messages */}
      {successMessage && (
        <div className="p-4 bg-green-50 border-b border-green-200">
          <p className="text-sm text-green-600">{successMessage}</p>
        </div>
      )}

      {errorMessage && (
        <div className="p-4 bg-red-50 border-b border-red-200">
          <p className="text-sm text-red-600">{errorMessage}</p>
        </div>
      )}

      {/* Form */}
      <form onSubmit={handleSubmit}>
        <div className="px-6 py-4 border-b border-gray-100">
          <h3 className="text-lg font-medium text-gray-900">
            Mark Attendance for Today
          </h3>
          <p className="text-sm text-gray-500 mt-1">
            {students.length} student{students.length !== 1 ? 's' : ''} in this class
          </p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Student Name
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Email
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {students.map((student) => {
                const record = attendanceRecords.find(r => r.studentId === student.id);
                return (
                  <tr key={student.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4">
                      <span className="text-sm font-medium text-gray-900">
                        {student.user.name || 'Unknown Student'}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-sm text-gray-500">
                        {student.user.email}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex space-x-4">
                        {(['PRESENT', 'ABSENT', 'LATE'] as AttendanceStatus[]).map((status) => (
                          <label key={status} className="flex items-center">
                            <input
                              type="radio"
                              name={`attendance-${student.id}`}
                              value={status}
                              checked={record?.status === status}
                              onChange={() => handleStatusChange(student.id, status)}
                              disabled={!!existingAttendance[student.id]}
                              className="mr-2 text-blue-600 focus:ring-blue-500"
                            />
                            <span className="text-sm text-gray-700 capitalize">
                              {status.toLowerCase()}
                            </span>
                          </label>
                        ))}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Submit Button */}
        <div className="px-6 py-4 border-t border-gray-100 bg-gray-50">
          <div className="flex justify-end">
            <button
              type="button"
              onClick={() => router.back()}
              className="mr-4 px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting || isAlreadyMarked}
              className="px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSubmitting ? 'Submitting...' : isAlreadyMarked ? 'Already Marked' : 'Mark Attendance'}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}

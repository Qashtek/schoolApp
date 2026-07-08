'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { ArrowLeft, Save } from 'lucide-react';

interface Student {
  id: string;
  firstName: string;
  lastName: string;
  admissionNumber: string;
  email?: string;
  dateOfBirth?: string;
  gender?: string;
  address?: string;
  parentName?: string;
  parentPhone?: string;
  parentEmail?: string;
  grade?: string;
  classId?: string;
  class?: {
    id: string;
    name: string;
  };
  user?: {
    id: string;
    name: string;
    email: string;
  };
}

interface Class {
  id: string;
  name: string;
  grade: string;
}

interface FormErrors {
  grade?: string;
  classId?: string;
  general?: string;
}

export default function StudentDetailPage() {
  const router = useRouter();
  const params = useParams();
  const studentId = params.studentId as string;

  const [student, setStudent] = useState<Student | null>(null);
  const [classes, setClasses] = useState<Class[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [errors, setErrors] = useState<FormErrors>({});
  const [success, setSuccess] = useState('');
  const successRef = useRef<HTMLDivElement | null>(null);

  const [formData, setFormData] = useState({
    grade: '',
    classId: '',
  });

  useEffect(() => {
    const fetchData = async () => {
      try {
        setIsLoading(true);
        const [studentResponse, classesResponse] = await Promise.all([
          fetch(`/api/students/${studentId}`),
          fetch('/api/classes?limit=100'),
        ]);

        if (!studentResponse.ok) {
          throw new Error('Failed to fetch student');
        }

        const studentData = await studentResponse.json();
        setStudent(studentData);
        setFormData({
          grade: studentData.grade || '',
          classId: studentData.classId || '',
        });

        if (classesResponse.ok) {
          const classesData = await classesResponse.json();
          const classList = Array.isArray(classesData) ? classesData : classesData.data || [];
          setClasses(classList);
        }
      } catch (error) {
        console.error('Error fetching data:', error);
        setErrors({
          general: error instanceof Error ? error.message : 'Failed to load student data',
        });
      } finally {
        setIsLoading(false);
      }
    };

    if (studentId) {
      fetchData();
    }
  }, [studentId]);

  useEffect(() => {
    if (success && successRef.current) {
      successRef.current.focus();
      successRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, [success]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});
    setSuccess('');

    if (!formData.grade.trim() && !formData.classId) {
      setErrors({
        general: 'Please update at least one field',
      });
      return;
    }

    setIsSaving(true);

    try {
      const response = await fetch(`/api/students/${studentId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          grade: formData.grade.trim() || undefined,
          classId: formData.classId || undefined,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to update student');
      }

      const updatedStudent = await response.json();
      setStudent(updatedStudent);
      setSuccess('Student updated successfully');
      router.refresh();

      setTimeout(() => {
        setSuccess('');
      }, 3000);
    } catch (error) {
      console.error('Error updating student:', error);
      setErrors({
        general: error instanceof Error ? error.message : 'Failed to update student',
      });
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading student details...</p>
        </div>
      </div>
    );
  }

  if (!student) {
    return (
      <div className="min-h-screen bg-gray-50">
        <header className="bg-white shadow-sm">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
            <div className="flex items-center gap-4">
              <button
                onClick={() => router.back()}
                className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
              <h1 className="text-2xl font-semibold text-gray-900">Student Not Found</h1>
            </div>
          </div>
        </header>
        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <p className="text-gray-600">The student you are looking for could not be found.</p>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center gap-4">
            <button
              onClick={() => router.back()}
              className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div>
              <h1 className="text-2xl font-semibold text-gray-900">
                {student.firstName} {student.lastName}
              </h1>
              <p className="mt-1 text-sm text-gray-500">Admission: {student.admissionNumber}</p>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* View Info */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-lg shadow-sm border border-gray-100 p-6">
              <h2 className="text-lg font-medium text-gray-900 mb-4">Student Information</h2>
              <div className="space-y-4">
                <div>
                  <p className="text-sm font-medium text-gray-500">Full Name</p>
                  <p className="mt-1 text-sm text-gray-900">
                    {student.firstName} {student.lastName}
                  </p>
                </div>

                <div>
                  <p className="text-sm font-medium text-gray-500">Admission Number</p>
                  <p className="mt-1 text-sm text-gray-900">{student.admissionNumber}</p>
                </div>

                <div>
                  <p className="text-sm font-medium text-gray-500">Email</p>
                  <p className="mt-1 text-sm text-gray-900">{student.user?.email || 'N/A'}</p>
                </div>

                <div>
                  <p className="text-sm font-medium text-gray-500">Current Class</p>
                  <p className="mt-1 text-sm text-gray-900">
                    {student.class?.name || 'Not assigned'}
                  </p>
                </div>

                <div>
                  <p className="text-sm font-medium text-gray-500">Grade</p>
                  <p className="mt-1 text-sm text-gray-900">{student.grade || 'N/A'}</p>
                </div>
              </div>
            </div>
          </div>

          {/* Edit Form */}
          <div className="lg:col-span-2">
            <form onSubmit={handleSubmit} className="bg-white rounded-lg shadow-sm border border-gray-100 p-6">
              <h2 className="text-lg font-medium text-gray-900 mb-6">Update Student</h2>

              {errors.general && (
                <div className="mb-6 bg-red-50 border border-red-200 rounded-lg p-4">
                  <p className="text-sm text-red-600">{errors.general}</p>
                </div>
              )}

              {success && (
                <div
                  ref={successRef}
                  tabIndex={-1}
                  className="mb-6 bg-green-50 border border-green-200 rounded-lg p-4 outline-none"
                >
                  <p className="text-sm text-green-700">{success}</p>
                </div>
              )}

              <div className="space-y-6">
                {/* Grade */}
                <div>
                  <label htmlFor="grade" className="block text-sm font-medium text-gray-700">
                    Grade
                  </label>
                  <input
                    type="text"
                    id="grade"
                    value={formData.grade}
                    onChange={(e) => setFormData(prev => ({ ...prev, grade: e.target.value }))}
                    className={`mt-1 block w-full px-3 py-2 border rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                      errors.grade ? 'border-red-300' : 'border-gray-300'
                    }`}
                    placeholder="e.g. A, B, C"
                  />
                  {errors.grade && (
                    <p className="mt-1 text-sm text-red-600">{errors.grade}</p>
                  )}
                </div>

                {/* Class */}
                <div>
                  <label htmlFor="classId" className="block text-sm font-medium text-gray-700">
                    Class
                  </label>
                  <select
                    id="classId"
                    value={formData.classId}
                    onChange={(e) => setFormData(prev => ({ ...prev, classId: e.target.value }))}
                    className={`mt-1 block w-full px-3 py-2 border rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                      errors.classId ? 'border-red-300' : 'border-gray-300'
                    }`}
                  >
                    <option value="">Select a class</option>
                    {classes.map((cls) => (
                      <option key={cls.id} value={cls.id}>
                        {cls.name} - Grade {cls.grade}
                      </option>
                    ))}
                  </select>
                  {errors.classId && (
                    <p className="mt-1 text-sm text-red-600">{errors.classId}</p>
                  )}
                </div>
              </div>

              <div className="mt-8 flex justify-end gap-4">
                <button
                  type="button"
                  onClick={() => router.back()}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  <Save className="w-4 h-4" />
                  {isSaving ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      </main>
    </div>
  );
}

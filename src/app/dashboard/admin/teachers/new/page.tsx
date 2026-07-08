'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Save, User, Mail, Lock, Plus, X } from 'lucide-react';

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

interface SubjectTeachingEntry {
  classId: string;
  subjectId: string;
}

interface FormErrors {
  name?: string;
  email?: string;
  password?: string;
  general?: string;
}

export default function NewTeacherPage() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [classes, setClasses] = useState<ClassOption[]>([]);
  const [subjects, setSubjects] = useState<SubjectOption[]>([]);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [primaryClassId, setPrimaryClassId] = useState('');
  const [subjectEntries, setSubjectEntries] = useState<SubjectTeachingEntry[]>([]);
  const [errors, setErrors] = useState<FormErrors>({});

  const normalizeListResponse = <T,>(payload: unknown): T[] => {
    if (Array.isArray(payload)) {
      return payload as T[];
    }

    if (
      payload &&
      typeof payload === 'object' &&
      Array.isArray((payload as { data?: unknown }).data)
    ) {
      return (payload as { data: T[] }).data;
    }

    // Handle { classes: [...] } shape
    if (
      payload &&
      typeof payload === 'object' &&
      Array.isArray((payload as { classes?: unknown }).classes)
    ) {
      return (payload as { classes: T[] }).classes;
    }

    // Handle { subjects: [...] } shape
    if (
      payload &&
      typeof payload === 'object' &&
      Array.isArray((payload as { subjects?: unknown }).subjects)
    ) {
      return (payload as { subjects: T[] }).subjects;
    }

    return [];
  };

  // Fetch classes and subjects on component mount
  useEffect(() => {
    const fetchData = async () => {
      try {
        const [classesResponse, subjectsResponse] = await Promise.all([
          fetch('/api/classes?limit=100'),
          fetch('/api/subjects?limit=100'),
        ]);

        if (classesResponse.ok) {
          const classesData = await classesResponse.json();
          setClasses(normalizeListResponse<ClassOption>(classesData));
        }

        if (subjectsResponse.ok) {
          const subjectsData = await subjectsResponse.json();
          setSubjects(normalizeListResponse<SubjectOption>(subjectsData));
        }
      } catch (error) {
        console.error('Error fetching page data:', error);
      }
    };

    fetchData();
  }, []);

  const validateForm = (): boolean => {
    const newErrors: FormErrors = {};

    if (!name.trim()) {
      newErrors.name = 'Name is required';
    }

    if (!email.trim()) {
      newErrors.email = 'Email is required';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      newErrors.email = 'Invalid email address';
    }

    if (!password) {
      newErrors.password = 'Password is required';
    } else if (password.length < 6) {
      newErrors.password = 'Password must be at least 6 characters';
    }

    // Validate subject teaching entries are complete
    const incompleteEntries = subjectEntries.some(
      (entry) => (entry.classId && !entry.subjectId) || (!entry.classId && entry.subjectId)
    );

    if (incompleteEntries) {
      newErrors.general = 'Please complete all subject teaching entries or remove incomplete ones';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    setIsLoading(true);
    setErrors({});

    try {
      const body: {
        name: string;
        email: string;
        password: string;
        classTeacher?: { classId: string };
        subjectTeacher?: { classId: string; subjectId: string }[];
      } = {
        name: name.trim(),
        email: email.trim(),
        password,
      };

      if (primaryClassId) {
        body.classTeacher = { classId: primaryClassId };
      }

      if (subjectEntries.length > 0) {
        body.subjectTeacher = subjectEntries
          .filter((entry) => entry.classId && entry.subjectId)
          .map((entry) => ({
            classId: entry.classId,
            subjectId: entry.subjectId,
          }));
      }

      const response = await fetch('/api/teachers', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      });

      const payload = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(payload?.error || 'Failed to create teacher');
      }

      router.push('/dashboard/admin/teachers');
      router.refresh();
    } catch (error) {
      console.error('Error creating teacher:', error);
      setErrors({
        general: error instanceof Error ? error.message : 'An unexpected error occurred',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const addSubjectEntry = () => {
    setSubjectEntries((prev) => [...prev, { classId: '', subjectId: '' }]);
  };

  const removeSubjectEntry = (index: number) => {
    setSubjectEntries((prev) => prev.filter((_, i) => i !== index));
  };

  const updateSubjectEntry = (index: number, field: keyof SubjectTeachingEntry, value: string) => {
    setSubjectEntries((prev) =>
      prev.map((entry, i) => (i === index ? { ...entry, [field]: value } : entry))
    );
  };

  const getAvailableSubjects = () => subjects;

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
              <h1 className="text-2xl font-semibold text-gray-900">Add New Teacher</h1>
              <p className="mt-1 text-sm text-gray-500">
                Create a new teacher account with optional class assignments
              </p>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="max-w-2xl">
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* General Error */}
            {errors.general && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                <p className="text-sm text-red-600">{errors.general}</p>
              </div>
            )}

            {/* Basic Information */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-100 p-6">
              <h2 className="text-lg font-medium text-gray-900 mb-4 flex items-center gap-2">
                <User className="w-5 h-5" />
                Basic Information
              </h2>

              <div className="space-y-4">
                {/* Name */}
                <div>
                  <label htmlFor="name" className="block text-sm font-medium text-gray-700">
                    Full Name *
                  </label>
                  <input
                    type="text"
                    id="name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className={`mt-1 block w-full px-3 py-2 border rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                      errors.name ? 'border-red-300' : 'border-gray-300'
                    }`}
                    placeholder="Enter teacher's full name"
                  />
                  {errors.name && (
                    <p className="mt-1 text-sm text-red-600">{errors.name}</p>
                  )}
                </div>

                {/* Email */}
                <div>
                  <label htmlFor="email" className="block text-sm font-medium text-gray-700">
                    Email Address *
                  </label>
                  <div className="mt-1 relative">
                    <Mail className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" />
                    <input
                      type="email"
                      id="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className={`block w-full px-3 py-2 pl-10 border rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                        errors.email ? 'border-red-300' : 'border-gray-300'
                      }`}
                      placeholder="teacher@school.edu"
                    />
                  </div>
                  {errors.email && (
                    <p className="mt-1 text-sm text-red-600">{errors.email}</p>
                  )}
                </div>

                {/* Password */}
                <div>
                  <label htmlFor="password" className="block text-sm font-medium text-gray-700">
                    Password *
                  </label>
                  <div className="mt-1 relative">
                    <Lock className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" />
                    <input
                      type="password"
                      id="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className={`block w-full px-3 py-2 pl-10 border rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                        errors.password ? 'border-red-300' : 'border-gray-300'
                      }`}
                      placeholder="Minimum 6 characters"
                    />
                  </div>
                  {errors.password && (
                    <p className="mt-1 text-sm text-red-600">{errors.password}</p>
                  )}
                </div>
              </div>
            </div>

            {/* Primary Class Assignment */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-100 p-6">
              <h2 className="text-lg font-medium text-gray-900 mb-4">
                Class Teacher Assignment <span className="text-sm font-normal text-gray-400">(optional)</span>
              </h2>

              <div>
                <label htmlFor="primaryClass" className="block text-sm font-medium text-gray-700">
                  Primary Class
                </label>
                <select
                  id="primaryClass"
                  value={primaryClassId}
                  onChange={(e) => setPrimaryClassId(e.target.value)}
                  className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">No class teacher assignment</option>
                  {classes.map((cls) => (
                    <option key={cls.id} value={cls.id}>
                      {cls.name} - Grade {cls.grade}
                    </option>
                  ))}
                </select>
                <p className="mt-2 text-sm text-gray-500">
                  This teacher will be responsible for attendance in this class.
                </p>
                {classes.length === 0 && (
                  <p className="mt-2 text-sm text-gray-600">
                    No classes available.{' '}
                    <Link
                      href="/dashboard/admin/classes/new"
                      className="font-medium text-blue-600 hover:text-blue-700"
                    >
                      Create Class
                    </Link>
                    .
                  </p>
                )}
              </div>
            </div>

            {/* Subject Teaching Assignments */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-100 p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-medium text-gray-900">
                  Subject Teaching Assignments{' '}
                  <span className="text-sm font-normal text-gray-400">(optional)</span>
                </h2>
                <button
                  type="button"
                  onClick={addSubjectEntry}
                  disabled={classes.length === 0 || subjects.length === 0}
                  className="inline-flex items-center gap-1.5 rounded-md bg-blue-50 px-3 py-1.5 text-sm font-medium text-blue-700 hover:bg-blue-100 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Plus className="w-4 h-4" />
                  Add Entry
                </button>
              </div>

              {subjectEntries.length === 0 ? (
                <div className="rounded-lg border-2 border-dashed border-gray-200 p-6 text-center">
                  <p className="text-sm text-gray-500">
                    No subject teaching assignments yet. Click &quot;Add Entry&quot; to add one.
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {subjectEntries.map((entry, index) => (
                    <div
                      key={index}
                      className="rounded-lg border border-gray-100 bg-gray-50 p-4"
                    >
                      <div className="flex items-start justify-between gap-4 mb-3">
                        <h3 className="text-sm font-medium text-gray-700">
                          Assignment #{index + 1}
                        </h3>
                        <button
                          type="button"
                          onClick={() => removeSubjectEntry(index)}
                          className="p-1 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                          title="Remove assignment"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {/* Class dropdown */}
                        <div>
                          <label
                            htmlFor={`subject-class-${index}`}
                            className="block text-xs font-medium text-gray-600 mb-1"
                          >
                            Class
                          </label>
                          <select
                            id={`subject-class-${index}`}
                            value={entry.classId}
                            onChange={(e) => updateSubjectEntry(index, 'classId', e.target.value)}
                            className="block w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                          >
                            <option value="">Select class</option>
                            {classes.map((cls) => (
                              <option key={cls.id} value={cls.id}>
                                {cls.name} - Grade {cls.grade}
                              </option>
                            ))}
                          </select>
                        </div>

                        {/* Subject dropdown */}
                        <div>
                          <label
                            htmlFor={`subject-subject-${index}`}
                            className="block text-xs font-medium text-gray-600 mb-1"
                          >
                            Subject
                          </label>
                          <select
                            id={`subject-subject-${index}`}
                            value={entry.subjectId}
                            onChange={(e) => updateSubjectEntry(index, 'subjectId', e.target.value)}
                            disabled={!entry.classId}
                            className="block w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100"
                          >
                            <option value="">
                              {!entry.classId
                                ? 'Select a class first'
                                : 'Select subject'}
                            </option>
                            {getAvailableSubjects().map((subject) => (
                              <option key={subject.id} value={subject.id}>
                                {subject.name} ({subject.code})
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {classes.length === 0 && (
                <p className="mt-3 text-sm text-gray-600">
                  No classes available.{' '}
                  <Link
                    href="/dashboard/admin/classes/new"
                    className="font-medium text-blue-600 hover:text-blue-700"
                  >
                    Create Class
                  </Link>
                  .
                </p>
              )}

              {classes.length > 0 && subjects.length === 0 && (
                <p className="mt-3 text-sm text-gray-600">
                  No subjects available.{' '}
                  <Link
                    href="/dashboard/admin/subjects/new"
                    className="font-medium text-blue-600 hover:text-blue-700"
                  >
                    Create Subject
                  </Link>
                  .
                </p>
              )}
            </div>

            {/* Submit Button */}
            <div className="flex justify-end gap-4">
              <button
                type="button"
                onClick={() => router.back()}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isLoading}
                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                <Save className="w-4 h-4" />
                {isLoading ? 'Creating...' : 'Create Teacher'}
              </button>
            </div>
          </form>
        </div>
      </main>
    </div>
  );
}

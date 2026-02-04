'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Save, User, Mail, Lock, BookOpen } from 'lucide-react';

interface Class {
  id: string;
  name: string;
  grade: string;
  school?: {
    id: string;
    name: string;
  };
  _count: {
    teachers: number;
    students: number;
  };
}

interface FormData {
  name: string;
  email: string;
  password: string;
  subject: string;
  classIds: string[];
}

interface FormErrors {
  name?: string;
  email?: string;
  password?: string;
  subject?: string;
  general?: string;
}

export default function NewTeacherPage() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [classes, setClasses] = useState<Class[]>([]);
  const [formData, setFormData] = useState<FormData>({
    name: '',
    email: '',
    password: '',
    subject: '',
    classIds: [],
  });
  const [errors, setErrors] = useState<FormErrors>({});

  // Fetch classes on component mount
  useEffect(() => {
    const fetchClasses = async () => {
      try {
        const response = await fetch('/api/classes');
        if (response.ok) {
          const data = await response.json();
          setClasses(data);
        }
      } catch (error) {
        console.error('Error fetching classes:', error);
      }
    };
    fetchClasses();
  }, []);

  const validateForm = (): boolean => {
    const newErrors: FormErrors = {};

    if (!formData.name.trim()) {
      newErrors.name = 'Name is required';
    }

    if (!formData.email.trim()) {
      newErrors.email = 'Email is required';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      newErrors.email = 'Invalid email address';
    }

    if (!formData.password) {
      newErrors.password = 'Password is required';
    } else if (formData.password.length < 6) {
      newErrors.password = 'Password must be at least 6 characters';
    }

    if (!formData.subject.trim()) {
      newErrors.subject = 'Subject is required';
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
      // First create the user account
      const userResponse = await fetch('/api/auth/register', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: formData.name,
          email: formData.email,
          password: formData.password,
          role: 'TEACHER',
        }),
      });

      if (!userResponse.ok) {
        const errorData = await userResponse.json();
        throw new Error(errorData.error || 'Failed to create user account');
      }

      const userData = await userResponse.json();

      try {
        // Then create the teacher record
        const teacherResponse = await fetch('/api/teachers', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            userId: userData.id,
            subject: formData.subject || undefined,
          }),
        });

        if (!teacherResponse.ok) {
          const errorData = await teacherResponse.json();
          throw new Error(errorData.error || 'Failed to create teacher record');
        }

        const teacherData = await teacherResponse.json();

        // Assign classes if any selected
        if (formData.classIds.length > 0) {
          const assignResponse = await fetch(`/api/teachers/${teacherData.id}/classes`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              classIds: formData.classIds,
            }),
          });

          if (!assignResponse.ok) {
            const errorData = await assignResponse.json();
            throw new Error(errorData.error || 'Failed to assign classes');
          }
        }

        // Success - redirect to teachers list
        router.push('/dashboard/admin/teachers');
      } catch (teacherError) {
        // Clean up the created user if teacher creation failed
        await fetch(`/api/teachers/${userData.id}`, {
          method: 'DELETE',
        }).catch(() => {});
        throw teacherError;
      }
    } catch (error) {
      console.error('Error creating teacher:', error);
      setErrors({
        general: error instanceof Error ? error.message : 'An unexpected error occurred',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleClassToggle = (classId: string) => {
    setFormData(prev => ({
      ...prev,
      classIds: prev.classIds.includes(classId)
        ? prev.classIds.filter(id => id !== classId)
        : [...prev.classIds, classId],
    }));
  };

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
              <p className="mt-1 text-sm text-gray-500">Create a new teacher account and assign classes</p>
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
                    value={formData.name}
                    onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
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
                    <input
                      type="email"
                      id="email"
                      value={formData.email}
                      onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                      className={`block w-full px-3 py-2 pl-10 border rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                        errors.email ? 'border-red-300' : 'border-gray-300'
                      }`}
                      placeholder="teacher@school.edu"
                    />
                    <Mail className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" />
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
                    <input
                      type="password"
                      id="password"
                      value={formData.password}
                      onChange={(e) => setFormData(prev => ({ ...prev, password: e.target.value }))}
                      className={`block w-full px-3 py-2 pl-10 border rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                        errors.password ? 'border-red-300' : 'border-gray-300'
                      }`}
                      placeholder="Minimum 6 characters"
                    />
                    <Lock className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" />
                  </div>
                  {errors.password && (
                    <p className="mt-1 text-sm text-red-600">{errors.password}</p>
                  )}
                </div>

                {/* Subject */}
                <div>
                  <label htmlFor="subject" className="block text-sm font-medium text-gray-700">
                    Subject *
                  </label>
                  <input
                    type="text"
                    id="subject"
                    value={formData.subject}
                    onChange={(e) => setFormData(prev => ({ ...prev, subject: e.target.value }))}
                    className={`mt-1 block w-full px-3 py-2 border rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                      errors.subject ? 'border-red-300' : 'border-gray-300'
                    }`}
                    placeholder="e.g., Mathematics, English, Science"
                  />
                  {errors.subject && (
                    <p className="mt-1 text-sm text-red-600">{errors.subject}</p>
                  )}
                </div>
              </div>
            </div>

            {/* Class Assignments */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-100 p-6">
              <h2 className="text-lg font-medium text-gray-900 mb-4 flex items-center gap-2">
                <BookOpen className="w-5 h-5" />
                Class Assignments
              </h2>

              <div className="space-y-3">
                {classes.length === 0 ? (
                  <p className="text-sm text-gray-500">No classes available</p>
                ) : (
                  classes.map((cls) => (
                    <label key={cls.id} className="flex items-center space-x-3">
                      <input
                        type="checkbox"
                        checked={formData.classIds.includes(cls.id)}
                        onChange={() => handleClassToggle(cls.id)}
                        className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                      />
                      <div className="flex-1">
                        <span className="text-sm font-medium text-gray-900">
                          {cls.name} - Grade {cls.grade}
                        </span>
                        {cls.school && (
                          <span className="text-xs text-gray-500 ml-2">
                            ({cls.school.name})
                          </span>
                        )}
                        <div className="text-xs text-gray-500">
                          {cls._count.teachers} teachers, {cls._count.students} students
                        </div>
                      </div>
                    </label>
                  ))
                )}
              </div>
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

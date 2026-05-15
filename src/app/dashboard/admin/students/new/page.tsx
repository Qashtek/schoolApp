'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Save, User, Mail, GraduationCap } from 'lucide-react';

interface Class {
  id: string;
  name: string;
  grade: string;
}

interface FormData {
  firstName: string;
  lastName: string;
  admissionNumber: string;
  classId: string;
  email: string;
  dateOfBirth: string;
  gender: string;
  address: string;
  parentName: string;
  parentPhone: string;
  parentEmail: string;
}

interface FormErrors {
  firstName?: string;
  lastName?: string;
  admissionNumber?: string;
  classId?: string;
  email?: string;
  general?: string;
}

const STUDENTS_API_ROUTE = '/api/students';
const INITIAL_FORM_DATA: FormData = {
  firstName: '',
  lastName: '',
  admissionNumber: '',
  classId: '',
  email: '',
  dateOfBirth: '',
  gender: '',
  address: '',
  parentName: '',
  parentPhone: '',
  parentEmail: '',
};

export default function NewStudentPage() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [classes, setClasses] = useState<Class[]>([]);
  const [formData, setFormData] = useState<FormData>(INITIAL_FORM_DATA);
  const [errors, setErrors] = useState<FormErrors>({});
  const [success, setSuccess] = useState('');
  const successRef = useRef<HTMLDivElement | null>(null);

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

    return [];
  };

  // Fetch classes on component mount
  useEffect(() => {
    const fetchClasses = async () => {
      try {
        const response = await fetch('/api/classes?limit=100');
        if (response.ok) {
          const data = await response.json();
          setClasses(normalizeListResponse<Class>(data));
        }
      } catch (error) {
        console.error('Error fetching classes:', error);
      }
    };
    fetchClasses();
  }, []);

  useEffect(() => {
    if (success && successRef.current) {
      successRef.current.focus();
      successRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, [success]);

  const validateForm = (): boolean => {
    const newErrors: FormErrors = {};

    if (!formData.firstName.trim()) {
      newErrors.firstName = 'First name is required';
    }

    if (!formData.lastName.trim()) {
      newErrors.lastName = 'Last name is required';
    }

    if (!formData.admissionNumber.trim()) {
      newErrors.admissionNumber = 'Admission number is required';
    }

    if (!formData.classId) {
      newErrors.classId = 'Class is required';
    }

    if (formData.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      newErrors.email = 'Invalid email address';
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
    setSuccess('');

    try {
      // Keep auth on the server boundary. The client only posts to the API route.
      const response = await fetch(STUDENTS_API_ROUTE, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify(formData),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to create student');
      }

      setSuccess('Student created successfully');
      setFormData(INITIAL_FORM_DATA);
      router.refresh();
      setTimeout(() => {
        setSuccess('');
      }, 3000);
    } catch (error) {
      console.error('Error creating student:', error);
      setErrors({
        general: error instanceof Error ? error.message : 'An unexpected error occurred',
      });
    } finally {
      setIsLoading(false);
    }
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
              <h1 className="text-2xl font-semibold text-gray-900">Add New Student</h1>
              <p className="mt-1 text-sm text-gray-500">Create a new student record and assign to a class</p>
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
            {success && (
              <div
                ref={successRef}
                tabIndex={-1}
                className="bg-green-50 border border-green-200 rounded-lg p-4 outline-none"
              >
                <p className="text-sm text-green-700">{success}</p>
              </div>
            )}

            {/* Basic Information */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-100 p-6">
              <h2 className="text-lg font-medium text-gray-900 mb-4 flex items-center gap-2">
                <User className="w-5 h-5" />
                Basic Information
              </h2>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* First Name */}
                <div>
                  <label htmlFor="firstName" className="block text-sm font-medium text-gray-700">
                    First Name *
                  </label>
                  <input
                    type="text"
                    id="firstName"
                    value={formData.firstName}
                    onChange={(e) => setFormData(prev => ({ ...prev, firstName: e.target.value }))}
                    className={`mt-1 block w-full px-3 py-2 border rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                      errors.firstName ? 'border-red-300' : 'border-gray-300'
                    }`}
                    placeholder="Enter first name"
                  />
                  {errors.firstName && (
                    <p className="mt-1 text-sm text-red-600">{errors.firstName}</p>
                  )}
                </div>

                {/* Last Name */}
                <div>
                  <label htmlFor="lastName" className="block text-sm font-medium text-gray-700">
                    Last Name *
                  </label>
                  <input
                    type="text"
                    id="lastName"
                    value={formData.lastName}
                    onChange={(e) => setFormData(prev => ({ ...prev, lastName: e.target.value }))}
                    className={`mt-1 block w-full px-3 py-2 border rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                      errors.lastName ? 'border-red-300' : 'border-gray-300'
                    }`}
                    placeholder="Enter last name"
                  />
                  {errors.lastName && (
                    <p className="mt-1 text-sm text-red-600">{errors.lastName}</p>
                  )}
                </div>
              </div>

              {/* Admission Number */}
              <div className="mt-4">
                <label htmlFor="admissionNumber" className="block text-sm font-medium text-gray-700">
                  Admission Number *
                </label>
                <input
                  type="text"
                  id="admissionNumber"
                  value={formData.admissionNumber}
                  onChange={(e) => setFormData(prev => ({ ...prev, admissionNumber: e.target.value }))}
                  className={`mt-1 block w-full px-3 py-2 border rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                    errors.admissionNumber ? 'border-red-300' : 'border-gray-300'
                  }`}
                  placeholder="Enter admission number"
                />
                {errors.admissionNumber && (
                  <p className="mt-1 text-sm text-red-600">{errors.admissionNumber}</p>
                )}
              </div>

              {/* Email */}
              <div className="mt-4">
                <label htmlFor="email" className="block text-sm font-medium text-gray-700">
                  Email Address
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
                    placeholder="student@school.edu"
                  />
                  <Mail className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" />
                </div>
                {errors.email && (
                  <p className="mt-1 text-sm text-red-600">{errors.email}</p>
                )}
              </div>

              {/* Date of Birth */}
              <div className="mt-4">
                <label htmlFor="dateOfBirth" className="block text-sm font-medium text-gray-700">
                  Date of Birth
                </label>
                <input
                  type="date"
                  id="dateOfBirth"
                  value={formData.dateOfBirth}
                  onChange={(e) => setFormData(prev => ({ ...prev, dateOfBirth: e.target.value }))}
                  className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {/* Gender */}
              <div className="mt-4">
                <label htmlFor="gender" className="block text-sm font-medium text-gray-700">
                  Gender
                </label>
                <select
                  id="gender"
                  value={formData.gender}
                  onChange={(e) => setFormData(prev => ({ ...prev, gender: e.target.value }))}
                  className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Select gender</option>
                  <option value="MALE">Male</option>
                  <option value="FEMALE">Female</option>
                  <option value="OTHER">Other</option>
                </select>
              </div>

              {/* Address */}
              <div className="mt-4">
                <label htmlFor="address" className="block text-sm font-medium text-gray-700">
                  Address
                </label>
                <textarea
                  id="address"
                  value={formData.address}
                  onChange={(e) => setFormData(prev => ({ ...prev, address: e.target.value }))}
                  rows={3}
                  className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Enter address"
                />
              </div>
            </div>

            {/* Class Assignment */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-100 p-6">
              <h2 className="text-lg font-medium text-gray-900 mb-4 flex items-center gap-2">
                <GraduationCap className="w-5 h-5" />
                Class Assignment
              </h2>

              <div>
                <label htmlFor="classId" className="block text-sm font-medium text-gray-700">
                  Class *
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

            {/* Parent Information */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-100 p-6">
              <h2 className="text-lg font-medium text-gray-900 mb-4 flex items-center gap-2">
                <User className="w-5 h-5" />
                Parent/Guardian Information
              </h2>

              <div className="space-y-4">
                {/* Parent Name */}
                <div>
                  <label htmlFor="parentName" className="block text-sm font-medium text-gray-700">
                    Parent/Guardian Name
                  </label>
                  <input
                    type="text"
                    id="parentName"
                    value={formData.parentName}
                    onChange={(e) => setFormData(prev => ({ ...prev, parentName: e.target.value }))}
                    className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Enter parent/guardian name"
                  />
                </div>

                {/* Parent Phone */}
                <div>
                  <label htmlFor="parentPhone" className="block text-sm font-medium text-gray-700">
                    Parent/Guardian Phone
                  </label>
                  <input
                    type="tel"
                    id="parentPhone"
                    value={formData.parentPhone}
                    onChange={(e) => setFormData(prev => ({ ...prev, parentPhone: e.target.value }))}
                    className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Enter phone number"
                  />
                </div>

                {/* Parent Email */}
                <div>
                  <label htmlFor="parentEmail" className="block text-sm font-medium text-gray-700">
                    Parent/Guardian Email
                  </label>
                  <input
                    type="email"
                    id="parentEmail"
                    value={formData.parentEmail}
                    onChange={(e) => setFormData(prev => ({ ...prev, parentEmail: e.target.value }))}
                    className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="parent@example.com"
                  />
                </div>
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
                {isLoading ? 'Creating...' : 'Create Student'}
              </button>
            </div>
          </form>
        </div>
      </main>
    </div>
  );
}

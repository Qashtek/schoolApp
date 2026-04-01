'use client';

import Link from 'next/link';
import { FormEvent, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';

type FormData = {
  name: string;
  startDate: string;
  endDate: string;
};

type FormErrors = {
  name?: string;
  startDate?: string;
  endDate?: string;
  general?: string;
};

const INITIAL_FORM_DATA: FormData = {
  name: '',
  startDate: '',
  endDate: '',
};

export default function NewTermPage() {
  const params = useParams();
  const router = useRouter();
  const [formData, setFormData] = useState<FormData>(INITIAL_FORM_DATA);
  const [errors, setErrors] = useState<FormErrors>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');

  const sessionId = useMemo(() => {
    const rawSessionId = params?.sessionId;
    if (Array.isArray(rawSessionId)) {
      return rawSessionId[0] ?? '';
    }
    return (rawSessionId as string | undefined) ?? '';
  }, [params]);

  const validateForm = (): boolean => {
    const nextErrors: FormErrors = {};

    if (!formData.name.trim()) {
      nextErrors.name = 'Term name is required';
    }

    if (!formData.startDate) {
      nextErrors.startDate = 'Start date is required';
    }

    if (!formData.endDate) {
      nextErrors.endDate = 'End date is required';
    }

    if (formData.startDate && formData.endDate && formData.endDate < formData.startDate) {
      nextErrors.endDate = 'End date must be on or after start date';
    }

    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!sessionId) {
      setErrors({ general: 'Invalid session. Please return and try again.' });
      return;
    }

    if (!validateForm()) {
      return;
    }

    setIsSubmitting(true);
    setErrors({});
    setSuccessMessage('');

    try {
      const response = await fetch(`/api/sessions/${sessionId}/terms`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: formData.name.trim(),
          startDate: formData.startDate,
          endDate: formData.endDate,
        }),
      });

      const payload = await response.json().catch(() => null);

      if (!response.ok) {
        const nextErrors: FormErrors = {};

        if (Array.isArray(payload?.details)) {
          for (const issue of payload.details) {
            const field = issue?.path?.[0];
            if (field === 'name' || field === 'startDate' || field === 'endDate') {
              nextErrors[field] = issue.message;
            }
          }
        }

        if (!nextErrors.name && !nextErrors.startDate && !nextErrors.endDate) {
          nextErrors.general = payload?.error || 'Failed to create term';
        }

        setErrors(nextErrors);
        return;
      }

      setSuccessMessage('Term created successfully. Redirecting...');

      router.push('/dashboard/admin/sessions?termCreated=1');
      router.refresh();
    } catch (error) {
      setErrors({
        general: error instanceof Error ? error.message : 'An unexpected error occurred',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-gray-900">Create Term</h1>
        <Link
          href="/dashboard/admin/sessions"
          className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
        >
          Back to Sessions
        </Link>
      </div>

      <form
        onSubmit={handleSubmit}
        className="space-y-5 rounded-lg border border-gray-200 bg-white p-6 shadow-sm"
      >
        {errors.general && (
          <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {errors.general}
          </div>
        )}

        {successMessage && (
          <div className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
            {successMessage}
          </div>
        )}

        <div>
          <label htmlFor="name" className="block text-sm font-medium text-gray-700">
            Term Name <span className="text-red-500">*</span>
          </label>
          <input
            id="name"
            type="text"
            value={formData.name}
            onChange={(event) => {
              setFormData((prev) => ({ ...prev, name: event.target.value }));
              if (errors.name) {
                setErrors((prev) => ({ ...prev, name: undefined }));
              }
            }}
            placeholder="e.g. Term 1"
            className={`mt-1 w-full rounded-md border px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${
              errors.name ? 'border-red-300' : 'border-gray-300'
            }`}
            required
          />
          {errors.name && <p className="mt-1 text-sm text-red-600">{errors.name}</p>}
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="startDate" className="block text-sm font-medium text-gray-700">
              Start Date <span className="text-red-500">*</span>
            </label>
            <input
              id="startDate"
              type="date"
              value={formData.startDate}
              onChange={(event) => {
                setFormData((prev) => ({ ...prev, startDate: event.target.value }));
                if (errors.startDate) {
                  setErrors((prev) => ({ ...prev, startDate: undefined }));
                }
              }}
              className={`mt-1 w-full rounded-md border px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                errors.startDate ? 'border-red-300' : 'border-gray-300'
              }`}
              required
            />
            {errors.startDate && <p className="mt-1 text-sm text-red-600">{errors.startDate}</p>}
          </div>

          <div>
            <label htmlFor="endDate" className="block text-sm font-medium text-gray-700">
              End Date <span className="text-red-500">*</span>
            </label>
            <input
              id="endDate"
              type="date"
              value={formData.endDate}
              onChange={(event) => {
                setFormData((prev) => ({ ...prev, endDate: event.target.value }));
                if (errors.endDate) {
                  setErrors((prev) => ({ ...prev, endDate: undefined }));
                }
              }}
              className={`mt-1 w-full rounded-md border px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                errors.endDate ? 'border-red-300' : 'border-gray-300'
              }`}
              required
            />
            {errors.endDate && <p className="mt-1 text-sm text-red-600">{errors.endDate}</p>}
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="submit"
            disabled={isSubmitting}
            className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isSubmitting ? 'Creating...' : 'Create Term'}
          </button>
          <Link
            href="/dashboard/admin/sessions"
            className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            Cancel
          </Link>
        </div>
      </form>
    </div>
  );
}

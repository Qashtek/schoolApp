'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { FormEvent, useState } from 'react';

type FormData = {
  name: string;
  code: string;
  description: string;
};

type FormErrors = {
  name?: string;
  code?: string;
  general?: string;
};

const INITIAL_FORM_DATA: FormData = {
  name: '',
  code: '',
  description: '',
};

export default function NewSubjectPage() {
  const router = useRouter();
  const [formData, setFormData] = useState<FormData>(INITIAL_FORM_DATA);
  const [errors, setErrors] = useState<FormErrors>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  const validateForm = (): boolean => {
    const nextErrors: FormErrors = {};

    if (!formData.name.trim()) {
      nextErrors.name = 'Name is required';
    }

    if (!formData.code.trim()) {
      nextErrors.code = 'Code is required';
    }

    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!validateForm()) {
      return;
    }

    setIsSubmitting(true);
    setErrors({});

    try {
      const response = await fetch('/api/subjects', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: formData.name.trim(),
          code: formData.code.trim(),
          description: formData.description.trim() || undefined,
        }),
      });

      const payload = await response.json().catch(() => null);

      if (!response.ok) {
        const nextErrors: FormErrors = {};

        if (Array.isArray(payload?.details)) {
          for (const issue of payload.details) {
            const field = issue?.path?.[0];
            if (field === 'name' || field === 'code') {
              nextErrors[field] = issue.message;
            }
          }
        }

        if (!nextErrors.name && !nextErrors.code) {
          nextErrors.general = payload?.error || 'Failed to create subject';
        }

        setErrors(nextErrors);
        return;
      }

      router.push('/dashboard/admin/subjects');
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
        <h1 className="text-2xl font-semibold text-gray-900">Create Subject</h1>
        <Link
          href="/dashboard/admin/subjects"
          className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
        >
          Back to Subjects
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

        <div>
          <label htmlFor="name" className="block text-sm font-medium text-gray-700">
            Name <span className="text-red-500">*</span>
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
            className={`mt-1 w-full rounded-md border px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${
              errors.name ? 'border-red-300' : 'border-gray-300'
            }`}
            placeholder="e.g. Mathematics"
          />
          {errors.name && <p className="mt-1 text-sm text-red-600">{errors.name}</p>}
        </div>

        <div>
          <label htmlFor="code" className="block text-sm font-medium text-gray-700">
            Code <span className="text-red-500">*</span>
          </label>
          <input
            id="code"
            type="text"
            value={formData.code}
            onChange={(event) => {
              setFormData((prev) => ({ ...prev, code: event.target.value }));
              if (errors.code) {
                setErrors((prev) => ({ ...prev, code: undefined }));
              }
            }}
            className={`mt-1 w-full rounded-md border px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${
              errors.code ? 'border-red-300' : 'border-gray-300'
            }`}
            placeholder="e.g. MTH101"
          />
          {errors.code && <p className="mt-1 text-sm text-red-600">{errors.code}</p>}
        </div>

        <div>
          <label htmlFor="description" className="block text-sm font-medium text-gray-700">
            Description
          </label>
          <textarea
            id="description"
            rows={4}
            value={formData.description}
            onChange={(event) =>
              setFormData((prev) => ({ ...prev, description: event.target.value }))
            }
            className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="Optional description"
          />
        </div>

        <div className="flex items-center gap-3">
          <button
            type="submit"
            disabled={isSubmitting}
            className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isSubmitting ? 'Creating...' : 'Create Subject'}
          </button>
          <Link
            href="/dashboard/admin/subjects"
            className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            Cancel
          </Link>
        </div>
      </form>
    </div>
  );
}

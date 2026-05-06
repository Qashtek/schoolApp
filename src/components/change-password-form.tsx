'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { FormEvent, useEffect, useMemo, useState } from 'react';
import { useSession } from 'next-auth/react';

type FormData = {
  currentPassword: string;
  newPassword: string;
  confirmNewPassword: string;
};

type FormErrors = {
  currentPassword?: string;
  newPassword?: string;
  confirmNewPassword?: string;
  general?: string;
};

type ErrorPayload = {
  error?: string;
  details?: {
    formErrors?: string[];
    fieldErrors?: {
      currentPassword?: string[];
      newPassword?: string[];
      confirmNewPassword?: string[];
    };
  };
};

type ChangePasswordFormProps = {
  allowedRoles: string[];
  backHref: string;
  backLabel?: string;
  title?: string;
};

const INITIAL_FORM_DATA: FormData = {
  currentPassword: '',
  newPassword: '',
  confirmNewPassword: '',
};

export function ChangePasswordForm({
  allowedRoles,
  backHref,
  backLabel = 'Back',
  title = 'Change Password',
}: ChangePasswordFormProps) {
  const router = useRouter();
  const { data: session, status } = useSession();
  const [formData, setFormData] = useState<FormData>(INITIAL_FORM_DATA);
  const [errors, setErrors] = useState<FormErrors>({});
  const [successMessage, setSuccessMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const allowedRolesSet = useMemo(
    () => new Set(allowedRoles.map((role) => role.toUpperCase())),
    [allowedRoles]
  );

  useEffect(() => {
    if (status === 'loading') {
      return;
    }

    if (!session?.user) {
      router.replace('/login');
      return;
    }

    const role = String(session.user.role ?? '').toUpperCase();
    if (!allowedRolesSet.has(role)) {
      router.replace('/dashboard');
    }
  }, [allowedRolesSet, router, session, status]);

  const validateForm = (): boolean => {
    const nextErrors: FormErrors = {};

    if (!formData.currentPassword) {
      nextErrors.currentPassword = 'Current password is required';
    }

    if (!formData.newPassword) {
      nextErrors.newPassword = 'New password is required';
    } else if (formData.newPassword.length < 8) {
      nextErrors.newPassword = 'New password must be at least 8 characters';
    }

    if (!formData.confirmNewPassword) {
      nextErrors.confirmNewPassword = 'Confirm new password is required';
    } else if (formData.newPassword !== formData.confirmNewPassword) {
      nextErrors.confirmNewPassword = 'New password and confirm password must match';
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
    setSuccessMessage('');

    try {
      const response = await fetch('/api/auth/change-password', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      });

      const payload: ErrorPayload | { message?: string } | null = await response
        .json()
        .catch(() => null);

      if (!response.ok) {
        const apiErrors = (payload as ErrorPayload | null)?.details?.fieldErrors;
        const nextErrors: FormErrors = {
          currentPassword: apiErrors?.currentPassword?.[0],
          newPassword: apiErrors?.newPassword?.[0],
          confirmNewPassword: apiErrors?.confirmNewPassword?.[0],
        };

        if (!nextErrors.currentPassword && !nextErrors.newPassword && !nextErrors.confirmNewPassword) {
          nextErrors.general =
            (payload as ErrorPayload | null)?.details?.formErrors?.[0] ||
            (payload as ErrorPayload | null)?.error ||
            'Failed to change password';
        }

        setErrors(nextErrors);
        return;
      }

      setFormData(INITIAL_FORM_DATA);
      setSuccessMessage((payload as { message?: string } | null)?.message || 'Password changed successfully');
      router.refresh();
    } catch (error) {
      setErrors({
        general: error instanceof Error ? error.message : 'An unexpected error occurred',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (status === 'loading') {
    return (
      <div className="mx-auto max-w-xl rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
        <p className="text-sm text-gray-500">Loading...</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-xl space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-gray-900">{title}</h1>
        <Link
          href={backHref}
          className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
        >
          {backLabel}
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
          <div className="rounded-md border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-700">
            {successMessage}
          </div>
        )}

        <div>
          <label htmlFor="currentPassword" className="block text-sm font-medium text-gray-700">
            Current Password
          </label>
          <input
            id="currentPassword"
            type="password"
            value={formData.currentPassword}
            onChange={(event) => {
              setFormData((prev) => ({ ...prev, currentPassword: event.target.value }));
              if (errors.currentPassword) {
                setErrors((prev) => ({ ...prev, currentPassword: undefined }));
              }
            }}
            className={`mt-1 w-full rounded-md border px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${
              errors.currentPassword ? 'border-red-300' : 'border-gray-300'
            }`}
            placeholder="Enter current password"
          />
          {errors.currentPassword && (
            <p className="mt-1 text-sm text-red-600">{errors.currentPassword}</p>
          )}
        </div>

        <div>
          <label htmlFor="newPassword" className="block text-sm font-medium text-gray-700">
            New Password
          </label>
          <input
            id="newPassword"
            type="password"
            value={formData.newPassword}
            onChange={(event) => {
              setFormData((prev) => ({ ...prev, newPassword: event.target.value }));
              if (errors.newPassword) {
                setErrors((prev) => ({ ...prev, newPassword: undefined }));
              }
            }}
            className={`mt-1 w-full rounded-md border px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${
              errors.newPassword ? 'border-red-300' : 'border-gray-300'
            }`}
            placeholder="Enter new password"
          />
          {errors.newPassword && <p className="mt-1 text-sm text-red-600">{errors.newPassword}</p>}
        </div>

        <div>
          <label htmlFor="confirmNewPassword" className="block text-sm font-medium text-gray-700">
            Confirm New Password
          </label>
          <input
            id="confirmNewPassword"
            type="password"
            value={formData.confirmNewPassword}
            onChange={(event) => {
              setFormData((prev) => ({ ...prev, confirmNewPassword: event.target.value }));
              if (errors.confirmNewPassword) {
                setErrors((prev) => ({ ...prev, confirmNewPassword: undefined }));
              }
            }}
            className={`mt-1 w-full rounded-md border px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${
              errors.confirmNewPassword ? 'border-red-300' : 'border-gray-300'
            }`}
            placeholder="Confirm new password"
          />
          {errors.confirmNewPassword && (
            <p className="mt-1 text-sm text-red-600">{errors.confirmNewPassword}</p>
          )}
        </div>

        <button
          type="submit"
          disabled={isSubmitting}
          className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isSubmitting ? 'Updating...' : 'Update Password'}
        </button>
      </form>
    </div>
  );
}

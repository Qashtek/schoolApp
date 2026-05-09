'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Trash2, Key } from 'lucide-react';

interface Admin {
  id: string;
  name: string | null;
  email: string;
  schoolId: string | null;
}

interface AdminsListProps {
  admins: Admin[];
  schools: { id: string; name: string }[];
}

export function AdminsList({ admins, schools }: AdminsListProps) {
  const router = useRouter();
  const [resetLoading, setResetLoading] = useState<string | null>(null);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const handleResetPassword = async (adminId: string, adminEmail: string) => {
    if (!confirm(`Reset password for ${adminEmail}? The new password will be their email prefix.`)) {
      return;
    }

    setResetLoading(adminId);

    try {
      const response = await fetch('/api/super-admin/reset-admin-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ adminId })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to reset password');
      }

      const data = await response.json();
      setMessage({ type: 'success', text: `Password reset for ${adminEmail}` });

      setTimeout(() => {
        setMessage(null);
      }, 3000);
    } catch (error) {
      setMessage({
        type: 'error',
        text: error instanceof Error ? error.message : 'An error occurred'
      });
    } finally {
      setResetLoading(null);
    }
  };

  return (
    <div className="space-y-4">
      {message && (
        <div
          className={`p-4 rounded-md ${
            message.type === 'success'
              ? 'bg-green-50 text-green-700 border border-green-200'
              : 'bg-red-50 text-red-700 border border-red-200'
          }`}
        >
          {message.text}
        </div>
      )}

      <div className="overflow-hidden rounded-lg border border-gray-200">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600">Name</th>
              <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600">Email</th>
              <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600">School</th>
              <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 bg-white">
            {admins.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-6 py-8 text-center text-sm text-gray-500">
                  No admins found
                </td>
              </tr>
            ) : (
              admins.map((admin) => (
                <tr key={admin.id}>
                  <td className="px-6 py-3 text-sm text-gray-900">{admin.name || 'Unnamed'}</td>
                  <td className="px-6 py-3 text-sm text-gray-700">{admin.email}</td>
                  <td className="px-6 py-3 text-sm text-gray-700">
                    {admin.schoolId
                      ? schools.find((s) => s.id === admin.schoolId)?.name || 'Unknown School'
                      : 'No School'}
                  </td>
                  <td className="px-6 py-3 text-sm">
                    <button
                      onClick={() => handleResetPassword(admin.id, admin.email)}
                      disabled={resetLoading === admin.id}
                      className="inline-flex items-center gap-2 rounded-md bg-blue-100 px-3 py-2 text-blue-700 hover:bg-blue-200 disabled:opacity-50 transition-colors"
                    >
                      <Key className="w-4 h-4" />
                      {resetLoading === admin.id ? 'Resetting...' : 'Reset Password'}
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

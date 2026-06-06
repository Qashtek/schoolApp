import { ChangePasswordForm } from '@/components/change-password-form';

export default function ChangePasswordPage() {
  return (
    <ChangePasswordForm
      allowedRoles={['STUDENT', 'PARENT', 'TEACHER']}
      backHref="/dashboard"
      title="Change Password"
    />
  );
}

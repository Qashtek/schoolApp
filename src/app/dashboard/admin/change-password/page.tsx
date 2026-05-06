import { ChangePasswordForm } from '@/components/change-password-form';

export default function AdminChangePasswordPage() {
  return (
    <ChangePasswordForm
      allowedRoles={['ADMIN', 'SUPER_ADMIN']}
      backHref="/dashboard/admin"
      title="Change Admin Password"
    />
  );
}

import { ChangePasswordForm } from '@/components/change-password-form';

export default function SuperAdminChangePasswordPage() {
  return (
    <ChangePasswordForm
      allowedRoles={['SUPER_ADMIN']}
      backHref="/dashboard/super-admin"
      title="Change Super Admin Password"
    />
  );
}

import { type ReactNode } from 'react';
import { useAdminAuth } from '../../hooks/useAdminAuth';

interface ProtectedRouteProps {
  children: ReactNode;
  requiredRole?: string;
}

export function ProtectedRoute({ children, requiredRole }: ProtectedRouteProps) {
  const { loading, isAdmin, role } = useAdminAuth();

  if (loading) {
    return (
      <div className="h-screen flex items-center justify-center bg-bg">
        <div className="text-muted text-sm">Loading...</div>
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="h-screen flex flex-col items-center justify-center gap-4 text-center px-6 bg-bg">
        <h1 className="text-2xl font-bold text-ink">Access Denied</h1>
        <p className="text-muted max-w-md">
          You do not have permission to access this area.
        </p>
      </div>
    );
  }

  if (requiredRole && role !== 'super_admin' && role !== requiredRole) {
    return (
      <div className="h-screen flex flex-col items-center justify-center gap-4 text-center px-6 bg-bg">
        <h1 className="text-2xl font-bold text-ink">Insufficient Permissions</h1>
        <p className="text-muted max-w-md">
          This section requires the <strong>{requiredRole}</strong> role.
        </p>
      </div>
    );
  }

  return <>{children}</>;
}
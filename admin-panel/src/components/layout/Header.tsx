import { useLocation } from 'react-router-dom';
import { useAdminAuth } from '../../hooks/useAdminAuth';
import { NAV_ITEMS } from '../../lib/constants';

export function Header() {
  const location = useLocation();
  const { role, userId } = useAdminAuth();

  const currentPath = location.pathname.replace('/', '') || 'dashboard';
  const navItem = NAV_ITEMS.find((n) => n.key === currentPath);

  return (
    <header className="h-12 border-b border-border bg-panel flex items-center justify-between px-6 shrink-0">
      <div className="text-sm font-bold text-ink">
        {navItem?.label || 'Admin Panel'}
      </div>
      <div className="flex items-center gap-3 text-xs text-muted">
        <span className="px-2 py-0.5 bg-border/40 rounded font-bold tracking-wider uppercase">
          {role || 'user'}
        </span>
        {userId && <span className="font-mono text-[10px]">{userId.substring(0, 8)}...</span>}
      </div>
    </header>
  );
}
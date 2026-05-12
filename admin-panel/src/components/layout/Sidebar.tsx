import { NavLink, useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import {
  LayoutDashboard, FileQuestion, FileText, Layers, Users, BarChart2,
  Activity, Zap, TreePine, Scan, BookOpen, StickyNote, BrainCircuit,
  Settings, LogOut, ChevronLeft, ChevronRight
} from 'lucide-react';
import { useState } from 'react';
import { NAV_ITEMS } from '../../lib/constants';
import { useAdminAuth } from '../../hooks/useAdminAuth';

const ICON_MAP: Record<string, any> = {
  LayoutDashboard, FileQuestion, FileText, Layers, Users, BarChart2,
  Activity, Zap, TreePine, Scan, BookOpen, StickyNote, BrainCircuit, Settings,
};

export function Sidebar() {
  const [collapsed, setCollapsed] = useState(false);
  const navigate = useNavigate();
  const { role } = useAdminAuth();

  const isSuperAdmin = role === 'super_admin';

  return (
    <aside className={`${collapsed ? 'w-16' : 'w-96'} border-r border-border bg-panel flex flex-col gap-1 p-2 transition-all duration-200 shrink-0`}>
      <div className="flex items-center gap-2 px-3 py-4 mb-2">
        {!collapsed && (
          <div>
            <div className="text-primary font-black text-lg leading-tight">Dr. UPSC</div>
            <div className="text-muted text-[10px] tracking-widest font-bold">ADMIN PANEL</div>
          </div>
        )}
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="ml-auto p-1 text-muted hover:text-ink"
        >
          {collapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
        </button>
      </div>

      <nav className="flex-1 space-y-0.5">
        {NAV_ITEMS.map((item) => {
          const Icon = ICON_MAP[item.icon] || LayoutDashboard;
          // Restrict super_admin-only items
          if (!isSuperAdmin && ['settings', 'users', 'analytics'].includes(item.key)) return null;

          return (
            <NavLink
              key={item.key}
              to={`/${item.key}`}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2 rounded font-semibold transition text-sm ${
                  isActive
                    ? 'bg-primary text-black'
                    : 'text-muted hover:text-ink hover:bg-border/40'
                }`
              }
              title={collapsed ? item.label : undefined}
            >
              <Icon size={18} className="shrink-0" />
              {!collapsed && <span>{item.label}</span>}
            </NavLink>
          );
        })}
      </nav>

      <button
        onClick={async () => {
          await supabase.auth.signOut();
          navigate('/login');
        }}
        className="flex items-center gap-3 px-3 py-2 text-muted hover:text-ink hover:bg-border/40 rounded transition text-sm mt-auto"
      >
        <LogOut size={18} />
        {!collapsed && <span>Sign out</span>}
      </button>
    </aside>
  );
}
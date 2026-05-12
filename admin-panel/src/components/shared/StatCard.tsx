import type { ReactNode } from 'react';

interface StatCardProps {
  icon?: ReactNode;
  value: string | number;
  label: string;
  subtitle?: string;
}

export function StatCard({ icon, value, label, subtitle }: StatCardProps) {
  return (
    <div className="bg-panel border border-border rounded-xl p-5">
      {icon && <div className="flex items-center justify-between mb-4">{icon}</div>}
      <div className="text-3xl font-black">{value}</div>
      <div className="text-muted text-xs font-bold tracking-widest mt-1">{label}</div>
      {subtitle && <div className="text-muted text-[10px] mt-1">{subtitle}</div>}
    </div>
  );
}
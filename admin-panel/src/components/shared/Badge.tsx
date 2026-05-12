import type { ReactNode } from 'react';

interface BadgeProps {
  children: ReactNode;
  variant?: 'default' | 'success' | 'warning' | 'danger' | 'info';
  size?: 'sm' | 'md';
}

export function Badge({ children, variant = 'default', size = 'sm' }: BadgeProps) {
  const variants: Record<string, string> = {
    default: 'bg-border/40 text-muted',
    success: 'bg-green-900/30 text-green-400',
    warning: 'bg-yellow-900/30 text-yellow-400',
    danger: 'bg-red-900/30 text-red-400',
    info: 'bg-blue-900/30 text-blue-400',
  };

  const sizes: Record<string, string> = {
    sm: 'px-2 py-0.5 text-[10px]',
    md: 'px-3 py-1 text-xs',
  };

  return (
    <span className={`inline-flex items-center font-bold tracking-widest rounded-full ${variants[variant]} ${sizes[size]}`}>
      {children}
    </span>
  );
}
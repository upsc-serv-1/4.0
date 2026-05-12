import type { ReactNode } from 'react';
import { useEffect, useRef } from 'react';
import { X } from 'lucide-react';

interface DetailModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  width?: string;
  footer?: ReactNode;
}

export function DetailModal({ open, onClose, title, children, width = 'max-w-2xl', footer }: DetailModalProps) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center p-4 z-50">
      <div ref={ref} className={`bg-panel border border-border rounded-2xl w-full ${width} max-h-[90vh] flex flex-col`}>
        <div className="flex items-center justify-between p-5 border-b border-border shrink-0">
          <h2 className="text-xl font-black">{title}</h2>
          <button onClick={onClose} className="p-1 text-muted hover:text-ink">
            <X size={20} />
          </button>
        </div>
        <div className="p-5 overflow-y-auto flex-1">
          {children}
        </div>
        {footer && (
          <div className="flex gap-2 p-5 border-t border-border shrink-0">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}
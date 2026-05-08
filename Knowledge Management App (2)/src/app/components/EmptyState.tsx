import { BookOpen } from 'lucide-react';

export function EmptyState() {
  return (
    <div className="flex-1 bg-background flex items-center justify-center">
      <div className="text-center">
        <div className="w-24 h-24 mx-auto mb-6 bg-primary/10 rounded-full flex items-center justify-center">
          <BookOpen className="w-12 h-12 text-primary" />
        </div>
        <p className="text-gray-600">Select a topic to view notes</p>
      </div>
    </div>
  );
}

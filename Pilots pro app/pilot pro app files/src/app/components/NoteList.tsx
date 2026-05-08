import { Search, Plus, FileText, Star, MoreVertical, ChevronLeft } from 'lucide-react';

interface Note {
  id: string;
  title: string;
  timestamp: string;
  isPinned?: boolean;
}

const notes: Note[] = [
  { id: '1', title: 'General Overview — Right to Equality', timestamp: 'Today, 9:47 AM', isPinned: true },
  { id: '2', title: 'Article 14 — Equality Before Law', timestamp: 'Today, 9:41 AM' },
  { id: '3', title: 'Article 15 — Prohibition of Discrimination', timestamp: 'Yesterday' },
  { id: '4', title: 'Article 16 — Equality of Opportunity', timestamp: '2 days ago' },
  { id: '5', title: 'Important Provisions - Women, Children, SCs, STs', timestamp: '3 days ago' },
];

interface NoteListProps {
  topicName: string;
  onBack?: () => void;
  onSelectNote: (noteId: string) => void;
}

export function NoteList({ topicName, onBack, onSelectNote }: NoteListProps) {
  return (
    <div className="flex-1 bg-background overflow-y-auto flex flex-col">
      <div className="bg-white border-b border-border px-6 py-4 shrink-0">
        <div className="flex items-center gap-4 mb-4">
          <button onClick={onBack} className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
            <ChevronLeft className="w-5 h-5" />
          </button>
          <h2>{topicName}</h2>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex-1 relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              placeholder={`Search in ${topicName}...`}
              className="w-full pl-12 pr-4 py-3 bg-gray-50 border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
            />
          </div>
          <button className="flex items-center gap-2 px-6 py-3 bg-primary text-white rounded-xl hover:bg-primary/90 transition-colors">
            <Plus className="w-5 h-5" />
            <span>New Note</span>
          </button>
        </div>
      </div>

      <div className="flex-1 px-6 py-4">
        <div className="space-y-2">
          {notes.map((note) => (
            <button
              key={note.id}
              onClick={() => onSelectNote(note.id)}
              className="w-full flex items-center gap-4 px-5 py-4 bg-white border border-border rounded-xl hover:shadow-md transition-all text-left group"
            >
              <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center shrink-0">
                <FileText className="w-5 h-5 text-blue-600" />
              </div>
              <div className="flex-1 min-w-0">
                <h4 className="mb-1 truncate">{note.title}</h4>
                <p className="text-sm text-muted-foreground">{note.timestamp}</p>
              </div>
              {note.isPinned && <Star className="w-5 h-5 fill-yellow-400 text-yellow-400 shrink-0" />}
              <button className="p-2 hover:bg-gray-100 rounded-lg transition-colors opacity-0 group-hover:opacity-100">
                <MoreVertical className="w-4 h-4 text-gray-400" />
              </button>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

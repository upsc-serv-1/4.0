import { Search, Plus, Clock, FileText, TrendingUp, Scale, Home as HomeIcon, Star, ChevronRight } from 'lucide-react';

interface Card {
  id: string;
  title: string;
  subject: string;
  timestamp: string;
  icon: React.ReactNode;
  iconBg: string;
}

const continueStudyingCards: Card[] = [
  {
    id: '1',
    title: 'Article 21',
    subject: 'Polity',
    timestamp: '2 mins ago',
    icon: <Scale className="w-5 h-5 text-blue-600" />,
    iconBg: 'bg-blue-100',
  },
  {
    id: '2',
    title: 'Indian Economy Overview',
    subject: 'Economy',
    timestamp: 'Yesterday',
    icon: <TrendingUp className="w-5 h-5 text-green-600" />,
    iconBg: 'bg-green-100',
  },
  {
    id: '3',
    title: 'Fundamental Rights',
    subject: 'Polity',
    timestamp: '2 days ago',
    icon: <FileText className="w-5 h-5 text-red-600" />,
    iconBg: 'bg-red-100',
  },
];

const pinnedNotes = [
  { id: '1', title: 'Budget 2025-26', subject: 'Economy', timestamp: '6 pages' },
  { id: '2', title: 'Ethics Case Studies', subject: 'Ethics', timestamp: '12 pages' },
  { id: '3', title: 'Climate Change', subject: 'Environment', timestamp: '8 pages' },
  { id: '4', title: 'Directive Principles', subject: 'Polity', timestamp: '10 pages' },
];

export function Dashboard({ onViewNote }: { onViewNote?: () => void }) {
  return (
    <div className="flex-1 bg-background overflow-y-auto">
      {/* Top Navigation */}
      <div className="bg-white border-b border-border px-6 py-4">
        <div className="flex items-center gap-4 mb-4">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <span>Polity</span>
            <ChevronRight className="w-4 h-4" />
            <span>Fundamental Rights</span>
            <ChevronRight className="w-4 h-4" />
            <span className="text-foreground">Right to Equality</span>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search notes, topics, keywords..."
              className="w-full pl-10 pr-4 py-2 bg-gray-50 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
            />
          </div>
          <button className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors">
            <Plus className="w-4 h-4" />
            <span>New</span>
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="px-8 py-6">
        {/* Greeting */}
        <div className="mb-8">
          <h1 className="mb-1">
            Good Morning, Aspirant <span className="inline-block">👋</span>
          </h1>
          <p className="text-muted-foreground">Ready to continue your preparation?</p>
        </div>

        {/* Continue Studying Section */}
        <section className="mb-10">
          <div className="flex items-center justify-between mb-4">
            <h2>Continue Studying</h2>
            <button className="text-sm text-primary hover:underline">See All</button>
          </div>

          <div className="flex gap-4 overflow-x-auto pb-2">
            {continueStudyingCards.map((card) => (
              <button
                key={card.id}
                onClick={onViewNote}
                className="min-w-[280px] bg-white border border-border rounded-lg p-5 hover:shadow-md transition-all text-left"
              >
                <div className={`w-10 h-10 ${card.iconBg} rounded-full flex items-center justify-center mb-4`}>
                  {card.icon}
                </div>
                <h3 className="mb-2">{card.title}</h3>
                <div className="flex items-center justify-between text-sm text-muted-foreground">
                  <span>{card.subject}</span>
                  <span>{card.timestamp}</span>
                </div>
              </button>
            ))}
          </div>
        </section>

        {/* Pinned Notes Section */}
        <section>
          <div className="flex items-center justify-between mb-4">
            <h2>Pinned Notes</h2>
            <button className="text-sm text-primary hover:underline">See All</button>
          </div>

          <div className="grid grid-cols-2 gap-4">
            {pinnedNotes.map((note) => (
              <div
                key={note.id}
                className="bg-white border border-border rounded-lg p-4 hover:shadow-md transition-all"
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center">
                    <FileText className="w-4 h-4 text-blue-600" />
                  </div>
                  <Star className="w-4 h-4 fill-yellow-400 text-yellow-400" />
                </div>
                <h4 className="mb-2">{note.title}</h4>
                <div className="flex items-center justify-between text-sm text-muted-foreground">
                  <span>{note.subject}</span>
                  <span>{note.timestamp}</span>
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}

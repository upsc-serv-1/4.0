import { Home, Pin, Clock, Share2, Trash2, Plus, Settings, ChevronRight, ChevronDown, ChevronLeft, Book } from 'lucide-react';
import { useState } from 'react';

interface Topic {
  id: string;
  label: string;
  subtopics?: Topic[];
}

interface Subject {
  id: string;
  label: string;
  icon: string;
  color: string;
  topics?: Topic[];
}

const subjects: Subject[] = [
  {
    id: 'polity',
    label: 'Polity',
    icon: '🏛️',
    color: 'bg-purple-100 text-purple-600',
    topics: [
      { id: 'constitution', label: 'Constitution' },
      {
        id: 'fundamental-rights',
        label: 'Fundamental Rights',
        subtopics: [
          { id: 'preamble', label: 'Preamble' },
          { id: 'right-to-equality', label: 'Right to Equality' },
          { id: 'right-to-freedom', label: 'Right to Freedom' },
          { id: 'exploitation', label: 'Right against Exploitation' },
          { id: 'religious-freedom', label: 'Right to Freedom of Religion' },
          { id: 'cultural-rights', label: 'Cultural & Educational Rights' },
          { id: 'constitutional-remedies', label: 'Right to Constitutional Remedies' },
        ],
      },
      { id: 'directive-principles', label: 'Directive Principles' },
      { id: 'fundamental-duties', label: 'Fundamental Duties' },
      { id: 'executive', label: 'Executive' },
      { id: 'legislature', label: 'Legislature' },
      { id: 'judiciary', label: 'Judiciary' },
      { id: 'federalism', label: 'Federalism' },
      { id: 'local-government', label: 'Local Government' },
      { id: 'election-commission', label: 'Election Commission' },
      { id: 'constitutional-bodies', label: 'Constitutional Bodies' },
      { id: 'amendments', label: 'Amendments' },
      { id: 'important-articles', label: 'Important Articles' },
    ],
  },
  { id: 'economy', label: 'Economy', icon: '💰', color: 'bg-pink-100 text-pink-600' },
  { id: 'history', label: 'History', icon: '📜', color: 'bg-orange-100 text-orange-600' },
  { id: 'geography', label: 'Geography', icon: '🌍', color: 'bg-green-100 text-green-600' },
  { id: 'ethics', label: 'Ethics', icon: '⚖️', color: 'bg-blue-100 text-blue-600' },
  { id: 'environment', label: 'Environment', icon: '🌱', color: 'bg-teal-100 text-teal-600' },
  { id: 'science-tech', label: 'Science & Tech', icon: '🔬', color: 'bg-amber-100 text-amber-600' },
];

interface SidebarProps {
  mode: 'home' | 'subject';
  selectedSubject?: string;
  selectedTopic?: string;
  selectedSubtopic?: string;
  onNavigateHome: () => void;
  onSelectSubject: (subjectId: string) => void;
  onSelectTopic?: (topicId: string) => void;
  onSelectSubtopic?: (subtopicId: string) => void;
}

export function Sidebar({
  mode,
  selectedSubject,
  selectedTopic,
  selectedSubtopic,
  onNavigateHome,
  onSelectSubject,
  onSelectTopic,
  onSelectSubtopic,
}: SidebarProps) {
  const [expandedTopics, setExpandedTopics] = useState<string[]>(['fundamental-rights']);

  const toggleTopic = (topicId: string) => {
    setExpandedTopics((prev) =>
      prev.includes(topicId) ? prev.filter((id) => id !== topicId) : [...prev, topicId]
    );
  };

  if (mode === 'home') {
    return (
      <div className="w-[300px] h-screen bg-white border-r border-border flex flex-col shrink-0">
        <div className="px-6 py-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-primary rounded-lg flex items-center justify-center">
              <Book className="w-6 h-6 text-white" />
            </div>
            <h1>Notes</h1>
          </div>
        </div>

        <nav className="px-4 pb-4 space-y-1">
          <button className="w-full flex items-center gap-3 px-4 py-3 text-sm rounded-xl bg-primary/10 text-primary transition-colors">
            <Home className="w-5 h-5" />
            <span>Home</span>
          </button>
          <button className="w-full flex items-center gap-3 px-4 py-3 text-sm text-gray-600 hover:bg-gray-50 rounded-xl transition-colors">
            <Pin className="w-5 h-5" />
            <span>Pinned</span>
          </button>
          <button className="w-full flex items-center gap-3 px-4 py-3 text-sm text-gray-600 hover:bg-gray-50 rounded-xl transition-colors">
            <Clock className="w-5 h-5" />
            <span>Recent</span>
          </button>
          <button className="w-full flex items-center gap-3 px-4 py-3 text-sm text-gray-600 hover:bg-gray-50 rounded-xl transition-colors">
            <Share2 className="w-5 h-5" />
            <span>Shared with me</span>
          </button>
          <button className="w-full flex items-center gap-3 px-4 py-3 text-sm text-gray-600 hover:bg-gray-50 rounded-xl transition-colors">
            <Trash2 className="w-5 h-5" />
            <span>Trash</span>
          </button>
        </nav>

        <div className="border-t border-border mx-4" />

        <div className="flex-1 overflow-y-auto px-4 py-6">
          <h4 className="px-4 mb-3 text-xs uppercase tracking-wide text-muted-foreground">Subjects</h4>
          <div className="space-y-1">
            {subjects.map((subject) => (
              <button
                key={subject.id}
                onClick={() => onSelectSubject(subject.id)}
                className="w-full flex items-center gap-3 px-4 py-3 text-sm text-gray-700 hover:bg-gray-50 rounded-xl transition-colors group"
              >
                <div className={`w-8 h-8 ${subject.color} rounded-lg flex items-center justify-center text-base`}>
                  {subject.icon}
                </div>
                <span className="flex-1 text-left">{subject.label}</span>
                <ChevronRight className="w-4 h-4 text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity" />
              </button>
            ))}

            <button className="w-full flex items-center gap-3 px-4 py-3 text-sm text-primary hover:bg-primary/5 rounded-xl transition-colors">
              <Plus className="w-5 h-5" />
              <span>New Subject</span>
            </button>
          </div>
        </div>

        <div className="border-t border-border p-4">
          <button className="w-full flex items-center gap-3 px-4 py-3 text-sm text-gray-700 hover:bg-gray-50 rounded-xl transition-colors">
            <Settings className="w-5 h-5" />
            <span>Settings</span>
          </button>
        </div>
      </div>
    );
  }

  const subject = subjects.find((s) => s.id === selectedSubject);
  if (!subject) return null;

  return (
    <div className="w-[300px] h-screen bg-white border-r border-border flex flex-col shrink-0">
      <div className="px-6 py-6 border-b border-border">
        <button
          onClick={onNavigateHome}
          className="flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-4"
        >
          <ChevronLeft className="w-5 h-5" />
          <span className="text-sm">Back</span>
        </button>
        <div className="flex items-center gap-3">
          <div className={`w-10 h-10 ${subject.color} rounded-lg flex items-center justify-center text-xl`}>
            {subject.icon}
          </div>
          <h2>{subject.label}</h2>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-4">
        {subject.topics && subject.topics.length > 0 ? (
          <div className="space-y-1">
            {subject.topics.map((topic, index) => (
              <div key={topic.id}>
                <button
                  onClick={() => {
                    if (topic.subtopics) {
                      toggleTopic(topic.id);
                    } else {
                      onSelectTopic?.(topic.id);
                    }
                  }}
                  className={`w-full flex items-center gap-3 px-3 py-2 text-sm rounded-lg transition-colors ${
                    selectedTopic === topic.id ? 'bg-primary/10 text-primary' : 'text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  <span className="text-gray-400 text-xs w-5">{index + 1}.</span>
                  <span className="flex-1 text-left">{topic.label}</span>
                  {topic.subtopics && (
                    <ChevronDown
                      className={`w-4 h-4 transition-transform ${
                        expandedTopics.includes(topic.id) ? 'rotate-0' : '-rotate-90'
                      }`}
                    />
                  )}
                </button>

                {topic.subtopics && expandedTopics.includes(topic.id) && (
                  <div className="ml-8 mt-1 space-y-1">
                    {topic.subtopics.map((subtopic) => (
                      <button
                        key={subtopic.id}
                        onClick={() => onSelectSubtopic?.(subtopic.id)}
                        className={`w-full flex items-center gap-2 px-3 py-2 text-sm rounded-lg transition-colors ${
                          selectedSubtopic === subtopic.id
                            ? 'bg-primary/10 text-primary'
                            : 'text-gray-600 hover:bg-gray-50'
                        }`}
                      >
                        <span className="flex-1 text-left">{subtopic.label}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center text-gray-500 text-sm py-8">No topics available</div>
        )}
      </div>

      <div className="border-t border-border p-4">
        <h4 className="px-3 mb-2 text-xs uppercase tracking-wide text-muted-foreground">Other Subjects</h4>
        <div className="space-y-1 max-h-48 overflow-y-auto">
          {subjects
            .filter((s) => s.id !== selectedSubject)
            .slice(0, 4)
            .map((s) => (
              <button
                key={s.id}
                onClick={() => onSelectSubject(s.id)}
                className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-600 hover:bg-gray-50 rounded-lg transition-colors"
              >
                <div className={`w-6 h-6 ${s.color} rounded-md flex items-center justify-center text-sm`}>
                  {s.icon}
                </div>
                <span className="flex-1 text-left">{s.label}</span>
              </button>
            ))}
        </div>
      </div>
    </div>
  );
}

import { useState } from 'react';
import { Sidebar } from './components/Sidebar';
import { Dashboard } from './components/Dashboard';
import { EmptyState } from './components/EmptyState';
import { NoteList } from './components/NoteList';
import { GlanceView } from './components/GlanceView';
import { EditorView } from './components/EditorView';
import { PanelLeftClose, PanelLeft } from 'lucide-react';

type ViewMode = 'dashboard' | 'subject' | 'noteList' | 'glance' | 'editor';

export default function App() {
  const [viewMode, setViewMode] = useState<ViewMode>('dashboard');
  const [selectedSubject, setSelectedSubject] = useState<string | undefined>();
  const [selectedTopic, setSelectedTopic] = useState<string | undefined>();
  const [selectedSubtopic, setSelectedSubtopic] = useState<string | undefined>();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  const handleNavigateHome = () => {
    setViewMode('dashboard');
    setSelectedSubject(undefined);
    setSelectedTopic(undefined);
    setSelectedSubtopic(undefined);
  };

  const handleSelectSubject = (subjectId: string) => {
    setSelectedSubject(subjectId);
    setSelectedTopic(undefined);
    setSelectedSubtopic(undefined);
    setViewMode('subject');
  };

  const handleSelectTopic = (topicId: string) => {
    setSelectedTopic(topicId);
    setSelectedSubtopic(undefined);
    setViewMode('subject');
  };

  const handleSelectSubtopic = (subtopicId: string) => {
    setSelectedSubtopic(subtopicId);
    setViewMode('noteList');
  };

  const handleSelectNote = (noteId: string) => {
    setViewMode('glance');
  };

  const handleBackFromNoteList = () => {
    setSelectedSubtopic(undefined);
    setViewMode('subject');
  };

  const handleBackFromGlance = () => {
    setViewMode('noteList');
  };

  const handleOpenEditor = () => {
    setViewMode('editor');
    setSidebarCollapsed(false);
  };

  const handleCloseEditor = () => {
    setViewMode('glance');
  };

  const getTopicName = () => {
    if (selectedSubtopic === 'right-to-equality') return 'Right to Equality';
    return 'Topic';
  };

  const renderMainContent = () => {
    switch (viewMode) {
      case 'dashboard':
        return <Dashboard onViewNote={() => setViewMode('glance')} />;
      case 'subject':
        return selectedSubtopic ? (
          <NoteList
            topicName={getTopicName()}
            onBack={handleBackFromNoteList}
            onSelectNote={handleSelectNote}
          />
        ) : (
          <EmptyState />
        );
      case 'noteList':
        return (
          <NoteList
            topicName={getTopicName()}
            onBack={handleBackFromNoteList}
            onSelectNote={handleSelectNote}
          />
        );
      case 'glance':
        return <GlanceView onBack={handleBackFromGlance} onOpenEditor={handleOpenEditor} />;
      case 'editor':
        return <EditorView onClose={handleCloseEditor} />;
      default:
        return <Dashboard onViewNote={() => setViewMode('glance')} />;
    }
  };

  const showSidebar = viewMode !== 'editor' && !sidebarCollapsed;
  const sidebarMode = viewMode === 'dashboard' ? 'home' : 'subject';

  return (
    <div className="size-full flex relative">
      {showSidebar && (
        <Sidebar
          mode={sidebarMode}
          selectedSubject={selectedSubject}
          selectedTopic={selectedTopic}
          selectedSubtopic={selectedSubtopic}
          onNavigateHome={handleNavigateHome}
          onSelectSubject={handleSelectSubject}
          onSelectTopic={handleSelectTopic}
          onSelectSubtopic={handleSelectSubtopic}
        />
      )}

      {renderMainContent()}

      {/* Sidebar Toggle Button (only show in glance view) */}
      {viewMode === 'glance' && (
        <button
          onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
          className="fixed top-4 left-4 p-2 bg-white border border-border rounded-lg shadow-lg hover:bg-gray-50 transition-colors z-10"
          title={sidebarCollapsed ? 'Show Sidebar' : 'Hide Sidebar'}
        >
          {sidebarCollapsed ? <PanelLeft className="w-5 h-5" /> : <PanelLeftClose className="w-5 h-5" />}
        </button>
      )}
    </div>
  );
}

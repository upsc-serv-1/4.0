import { useState, useEffect } from 'react';
import { Sidebar } from './components/Sidebar';
import { Dashboard } from './components/Dashboard';
import { EmptyState } from './components/EmptyState';
import { NoteList } from './components/NoteList';
import { GlanceView } from './components/GlanceView';
import { EditorView } from './components/EditorView';
import { fetchAllCapsuleNodes, createCapsuleNode, createNotebookRow } from '../repositories/capsuleRepo';
import { supabase } from '../lib/supabase';
import { PanelLeftClose, PanelLeft } from 'lucide-react';

type ViewMode = 'dashboard' | 'subject' | 'noteList' | 'glance' | 'editor';

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

export default function App() {
  const [viewMode, setViewMode] = useState<ViewMode>('dashboard');
  const [selectedSubject, setSelectedSubject] = useState<string | undefined>();
  const [selectedTopic, setSelectedTopic] = useState<string | undefined>();
  const [selectedSubtopic, setSelectedSubtopic] = useState<string | undefined>();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [subjectsList, setSubjectsList] = useState<Subject[]>([]);
  const [userId, setUserId] = useState<string | null>(null);
  const [rawNodes, setRawNodes] = useState<any[]>([]);
  const [selectedNoteId, setSelectedNoteId] = useState<string | undefined>();
  const [selectedNoteDbId, setSelectedNoteDbId] = useState<string | null | undefined>();

  useEffect(() => {
    const initUser = async () => {
      const params = new URLSearchParams(window.location.search);
      let id = params.get('userId');
      
      if (!id) {
        // Auto-detect the active user ID from user_notes to support direct laptop loading
        const { data } = await supabase
          .from('user_notes')
          .select('user_id')
          .limit(1)
          .maybeSingle();
        id = data?.user_id || null;
      }

      if (id) {
        setUserId(id);
        loadLiveNodes(id);
      }
    };
    initUser();
  }, []);

  const getSubjectVisuals = (title: string) => {
    const t = title.toLowerCase();
    if (t.includes('polity')) return { icon: '🏛️', color: 'bg-purple-100 text-purple-600' };
    if (t.includes('economy')) return { icon: '💰', color: 'bg-pink-100 text-pink-600' };
    if (t.includes('history')) return { icon: '📜', color: 'bg-orange-100 text-orange-600' };
    if (t.includes('geography')) return { icon: '🌍', color: 'bg-green-100 text-green-600' };
    if (t.includes('ethics')) return { icon: '⚖️', color: 'bg-blue-100 text-blue-600' };
    if (t.includes('environment') || t.includes('ecology')) return { icon: '🌱', color: 'bg-teal-100 text-teal-600' };
    if (t.includes('science') || t.includes('tech')) return { icon: '🔬', color: 'bg-amber-100 text-amber-600' };
    return { icon: '🏛️', color: 'bg-purple-100 text-purple-600' };
  };

  const loadLiveNodes = async (id: string) => {
    const nodes = await fetchAllCapsuleNodes(id);
    if (nodes && nodes.length > 0) {
      setRawNodes(nodes);
      const groupedSubjects: Subject[] = [];
      const subjectsMap = new Map<string, any>();
      const topicsMap = new Map<string, any>();

      // First pass: Subjects
      nodes.filter(n => n.type === 'subject').forEach(n => {
        const visuals = getSubjectVisuals(n.title);
        const s = {
          id: n.id,
          label: n.title,
          icon: n.icon || visuals.icon,
          color: n.color || visuals.color,
          topics: []
        };
        groupedSubjects.push(s);
        subjectsMap.set(n.id, s);
      });

      // Second pass: Topics
      nodes.filter(n => n.type === 'topic').forEach(n => {
        const t = { id: n.id, label: n.title, subtopics: [] };
        topicsMap.set(n.id, t);
        if (n.parent_id && subjectsMap.has(n.parent_id)) {
          subjectsMap.get(n.parent_id).topics.push(t);
        }
      });

      // Third pass: Subtopics
      nodes.filter(n => n.type === 'subtopic').forEach(n => {
        const st = { id: n.id, label: n.title };
        if (n.parent_id && topicsMap.has(n.parent_id)) {
          topicsMap.get(n.parent_id).subtopics.push(st);
        }
      });

      if (groupedSubjects.length > 0) {
        setSubjectsList(groupedSubjects);
      }
    }
  };

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

  const handleSelectNote = (noteId: string, noteDbId?: string | null) => {
    setSelectedNoteId(noteId);
    setSelectedNoteDbId(noteDbId);
    setViewMode('glance');
  };

  const handleCreateNote = async () => {
    if (!userId || !selectedSubtopic) return;
    const title = prompt('Enter note title:');
    if (!title) return;

    const noteId = await createNotebookRow({
      userId,
      subject: selectedSubject || 'Polity',
      title
    });

    if (noteId) {
      const newNode = await createCapsuleNode({
        userId,
        type: 'notebook',
        title,
        parentId: selectedSubtopic,
        noteId
      });
      
      if (newNode) {
        loadLiveNodes(userId);
      }
    }
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
    if (selectedSubtopic && rawNodes.length > 0) {
      const node = rawNodes.find(n => n.id === selectedSubtopic);
      if (node) return node.title;
    }
    if (selectedSubtopic === 'right-to-equality') return 'Right to Equality';
    return 'Topic';
  };

  const getSubtopicNotes = () => {
    if (!selectedSubtopic || rawNodes.length === 0) return [];
    return rawNodes
      .filter(n => n.type === 'notebook' && n.parent_id === selectedSubtopic)
      .map(n => ({
        id: n.id,
        title: n.title,
        timestamp: new Date(n.updated_at || n.created_at).toLocaleDateString(undefined, {
          month: 'short',
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit'
        }),
        isPinned: n.is_pinned || false,
        note_id: n.note_id
      }));
  };

  const getSelectedNoteTitle = () => {
    if (selectedNoteId && rawNodes.length > 0) {
      const node = rawNodes.find(n => n.id === selectedNoteId);
      if (node) return node.title;
    }
    return undefined;
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
            notes={getSubtopicNotes()}
            onCreateNote={handleCreateNote}
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
            notes={getSubtopicNotes()}
            onCreateNote={handleCreateNote}
          />
        );
      case 'glance':
        return (
          <GlanceView
            onBack={handleBackFromGlance}
            onOpenEditor={handleOpenEditor}
            noteId={selectedNoteId}
            noteDbId={selectedNoteDbId}
            noteTitle={getSelectedNoteTitle()}
          />
        );
      case 'editor':
        return (
          <EditorView
            onClose={handleCloseEditor}
            noteId={selectedNoteId}
            noteDbId={selectedNoteDbId}
            noteTitle={getSelectedNoteTitle()}
          />
        );
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
          subjects={subjectsList.length > 0 ? subjectsList : undefined}
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

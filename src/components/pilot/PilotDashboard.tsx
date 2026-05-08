import React, { useState, useMemo } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, Dimensions, useWindowDimensions
} from 'react-native';
import {
  Search, Plus, Scale, TrendingUp, FileText, Star, ChevronRight, BookOpen, Clock, Trash2,
  Home, Pin, Share2, Compass, Settings, ShieldAlert, Award, Globe, Leaf, Atom
} from 'lucide-react-native';
import { useTheme } from '../../context/ThemeContext';
import { PilotNote } from '../../context/PilotContext';

interface PilotDashboardProps {
  notes: PilotNote[];
  onSelectNote: (note: PilotNote) => void;
  onCreateNote?: (title: string, subject: string) => void;
  onDeleteNote?: (id: string) => void;
}

export const PilotDashboard: React.FC<PilotDashboardProps> = ({
  notes,
  onSelectNote,
  onCreateNote,
  onDeleteNote
}) => {
  const { colors, isDark } = useTheme();
  const { width } = useWindowDimensions();
  const isTablet = width >= 768;

  // Sidebar navigation state
  const [activeMenu, setActiveMenu] = useState<string>('home');
  const [searchQuery, setSearchQuery] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newNoteTitle, setNewNoteTitle] = useState('');
  const [newNoteSubject, setNewNoteSubject] = useState('Polity');

  const subjectsList = [
    { name: 'Polity', icon: <Scale size={15} color="#3b82f6" /> },
    { name: 'Economy', icon: <TrendingUp size={15} color="#10b981" /> },
    { name: 'History', icon: <Award size={15} color="#f59e0b" /> },
    { name: 'Geography', icon: <Globe size={15} color="#06b6d4" /> },
    { name: 'Ethics', icon: <ShieldAlert size={15} color="#8b5cf6" /> },
    { name: 'Environment', icon: <Leaf size={15} color="#10b981" /> },
    { name: 'Science & Tech', icon: <Atom size={15} color="#ec4899" /> },
  ];

  const filteredNotes = useMemo(() => {
    let result = notes;

    // Filter by sidebar active menu
    if (activeMenu === 'pinned') {
      result = result.slice(0, 4); // Simulate pinned notes
    } else if (activeMenu === 'recent') {
      result = [...result].sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime());
    } else if (subjectsList.some(s => s.name.toLowerCase() === activeMenu.toLowerCase())) {
      result = result.filter(n => n.subject.toLowerCase() === activeMenu.toLowerCase());
    }

    // Filter by search query
    if (searchQuery.trim()) {
      result = result.filter(n => 
        n.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        n.subject.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    return result;
  }, [notes, activeMenu, searchQuery]);

  const handleCreate = () => {
    if (newNoteTitle.trim() && onCreateNote) {
      onCreateNote(newNoteTitle.trim(), newNoteSubject.trim());
      setNewNoteTitle('');
      setShowCreateModal(false);
    }
  };

  const getSubjectIcon = (subject: string) => {
    const s = subject.toLowerCase();
    if (s.includes('polity')) return <Scale size={16} color="#3b82f6" />;
    if (s.includes('economy')) return <TrendingUp size={16} color="#10b981" />;
    if (s.includes('history')) return <Award size={16} color="#f59e0b" />;
    if (s.includes('geography')) return <Globe size={16} color="#06b6d4" />;
    if (s.includes('ethics')) return <ShieldAlert size={16} color="#8b5cf6" />;
    if (s.includes('environment')) return <Leaf size={16} color="#10b981" />;
    return <Atom size={16} color="#ec4899" />;
  };

  const getSubjectBg = (subject: string) => {
    const s = subject.toLowerCase();
    if (s.includes('polity')) return '#3b82f615';
    if (s.includes('economy')) return '#10b98115';
    if (s.includes('history')) return '#f59e0b15';
    if (s.includes('geography')) return '#06b6d415';
    if (s.includes('ethics')) return '#8b5cf615';
    if (s.includes('environment')) return '#10b98115';
    return '#ec489915';
  };

  const renderSidebar = () => (
    <View style={[styles.sidebar, { backgroundColor: colors.surfaceStrong, borderRightColor: colors.border }]}>
      {/* Sidebar Header */}
      <View style={styles.sidebarHeader}>
        <View style={[styles.sidebarLogoIcon, { backgroundColor: colors.primary }]}>
          <BookOpen size={16} color="#fff" />
        </View>
        <Text style={[styles.sidebarLogoText, { color: colors.textPrimary }]}>Notes</Text>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.sidebarScroll}>
        {/* Main Menu */}
        <View style={styles.sidebarSection}>
          <TouchableOpacity 
            onPress={() => setActiveMenu('home')}
            style={[styles.sidebarItem, activeMenu === 'home' && [styles.sidebarItemActive, { backgroundColor: colors.primary + '15' }]]}
          >
            <Home size={16} color={activeMenu === 'home' ? colors.primary : colors.textSecondary} />
            <Text style={[styles.sidebarItemText, { color: activeMenu === 'home' ? colors.primary : colors.textSecondary }]}>Home</Text>
          </TouchableOpacity>

          <TouchableOpacity 
            onPress={() => setActiveMenu('pinned')}
            style={[styles.sidebarItem, activeMenu === 'pinned' && [styles.sidebarItemActive, { backgroundColor: colors.primary + '15' }]]}
          >
            <Pin size={16} color={activeMenu === 'pinned' ? colors.primary : colors.textSecondary} />
            <Text style={[styles.sidebarItemText, { color: activeMenu === 'pinned' ? colors.primary : colors.textSecondary }]}>Pinned</Text>
          </TouchableOpacity>

          <TouchableOpacity 
            onPress={() => setActiveMenu('recent')}
            style={[styles.sidebarItem, activeMenu === 'recent' && [styles.sidebarItemActive, { backgroundColor: colors.primary + '15' }]]}
          >
            <Clock size={16} color={activeMenu === 'recent' ? colors.primary : colors.textSecondary} />
            <Text style={[styles.sidebarItemText, { color: activeMenu === 'recent' ? colors.primary : colors.textSecondary }]}>Recent</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.sidebarItem}>
            <Share2 size={16} color={colors.textSecondary} />
            <Text style={[styles.sidebarItemText, { color: colors.textSecondary }]}>Shared with me</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.sidebarItem}>
            <Trash2 size={16} color={colors.textSecondary} />
            <Text style={[styles.sidebarItemText, { color: colors.textSecondary }]}>Trash</Text>
          </TouchableOpacity>
        </View>

        {/* Subjects Section */}
        <Text style={[styles.sidebarSectionHeader, { color: colors.textTertiary }]}>SUBJECTS</Text>
        <View style={styles.sidebarSection}>
          {subjectsList.map((sub) => {
            const isActive = activeMenu === sub.name.toLowerCase();
            return (
              <TouchableOpacity 
                key={sub.name}
                onPress={() => setActiveMenu(sub.name.toLowerCase())}
                style={[styles.sidebarItem, isActive && [styles.sidebarItemActive, { backgroundColor: colors.primary + '15' }]]}
              >
                {sub.icon}
                <Text style={[styles.sidebarItemText, { color: isActive ? colors.primary : colors.textSecondary }]}>
                  {sub.name}
                </Text>
              </TouchableOpacity>
            );
          })}

          <TouchableOpacity onPress={() => setShowCreateModal(true)} style={styles.sidebarItem}>
            <Plus size={16} color={colors.primary} />
            <Text style={[styles.sidebarItemText, { color: colors.primary, fontWeight: '700' }]}>+ New Subject</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* Sidebar Footer */}
      <TouchableOpacity style={[styles.sidebarFooter, { borderTopColor: colors.border }]}>
        <Settings size={16} color={colors.textSecondary} />
        <Text style={[styles.sidebarItemText, { color: colors.textSecondary }]}>Settings</Text>
      </TouchableOpacity>
    </View>
  );

  return (
    <View style={[styles.root, { backgroundColor: colors.bg }]}>
      <View style={styles.container}>
        {/* Render Sidebar on Tablet/IPad screen */}
        {isTablet && renderSidebar()}

        {/* Main Content Area */}
        <View style={styles.mainPane}>
          {/* Breadcrumbs Top Bar */}
          <View style={[styles.topBreadcrumbRow, { borderBottomColor: colors.border }]}>
            <Text style={[styles.breadcrumbText, { color: colors.textTertiary }]}>
              {activeMenu === 'home' ? 'Notes' : `Notes  >  ${activeMenu.toUpperCase()}`}
            </Text>
            {onCreateNote && (
              <TouchableOpacity 
                onPress={() => setShowCreateModal(true)} 
                style={[styles.newBtn, { backgroundColor: colors.primary }]}
              >
                <Plus size={14} color="#fff" />
                <Text style={styles.newBtnText}>New</Text>
              </TouchableOpacity>
            )}
          </View>

          {/* Search bar row */}
          <View style={styles.searchRow}>
            <View style={[styles.searchContainer, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <Search size={16} color={colors.textTertiary} style={styles.searchIcon} />
              <TextInput
                value={searchQuery}
                onChangeText={setSearchQuery}
                placeholder="Search notes, topics, keywords..."
                placeholderTextColor={colors.textTertiary}
                style={[styles.searchInput, { color: colors.textPrimary }]}
              />
            </View>
          </View>

          <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
            {/* Greetings */}
            <View style={styles.greetingSection}>
              <Text style={[styles.greeting, { color: colors.textPrimary }]}>
                Good Morning, Aspirant 👋
              </Text>
              <Text style={[styles.subGreeting, { color: colors.textSecondary }]}>
                Ready to continue your preparation?
              </Text>
            </View>

            {/* Continue Studying Section */}
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>Continue Studying</Text>
                <TouchableOpacity><Text style={[styles.seeAllText, { color: colors.primary }]}>See All</Text></TouchableOpacity>
              </View>

              {filteredNotes.length === 0 ? (
                <View style={[styles.emptyCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                  <BookOpen size={24} color={colors.textTertiary} opacity={0.4} />
                  <Text style={{ color: colors.textTertiary, fontSize: 13, fontWeight: '700', marginTop: 4 }}>
                    No notes in this section
                  </Text>
                </View>
              ) : (
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.horizontalScroll}>
                  {filteredNotes.slice(0, 3).map((note, idx) => (
                    <TouchableOpacity
                      key={note.id}
                      onPress={() => onSelectNote(note)}
                      style={[styles.continueCard, { backgroundColor: colors.surface, borderColor: colors.border }]}
                    >
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                        <View style={[styles.subjectIconWrap, { backgroundColor: getSubjectBg(note.subject) }]}>
                          {getSubjectIcon(note.subject)}
                        </View>
                        <Text style={[styles.timeAgo, { color: colors.textTertiary }]}>{idx === 0 ? '2 mins ago' : idx === 1 ? 'Yesterday' : '2 days ago'}</Text>
                      </View>
                      <Text style={[styles.continueTitle, { color: colors.textPrimary }]} numberOfLines={2}>
                        {note.title}
                      </Text>
                      <Text style={[styles.continueSubject, { color: colors.textSecondary }]}>{note.subject}</Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              )}
            </View>

            {/* Pinned Notes Section */}
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>Pinned Notes</Text>
                <TouchableOpacity><Text style={[styles.seeAllText, { color: colors.primary }]}>See All</Text></TouchableOpacity>
              </View>

              <View style={styles.pinnedGrid}>
                {filteredNotes.length === 0 ? (
                  <View style={[styles.emptyCard, { backgroundColor: colors.surface, borderColor: colors.border, width: '100%' }]}>
                    <Star size={24} color={colors.textTertiary} opacity={0.4} />
                    <Text style={{ color: colors.textTertiary, fontSize: 13, fontWeight: '700', marginTop: 4 }}>
                      No pinned notes
                    </Text>
                  </View>
                ) : (
                  filteredNotes.map((note) => (
                    <TouchableOpacity
                      key={note.id}
                      onPress={() => onSelectNote(note)}
                      style={[styles.pinnedCard, { backgroundColor: colors.surface, borderColor: colors.border }]}
                    >
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                        <View style={[styles.subjectIconWrap, { backgroundColor: getSubjectBg(note.subject) }]}>
                          {getSubjectIcon(note.subject)}
                        </View>
                        <Star size={14} color="#f59e0b" fill="#f59e0b" />
                      </View>
                      <View style={{ marginTop: 12 }}>
                        <Text style={[styles.pinnedCardTitle, { color: colors.textPrimary }]} numberOfLines={1}>
                          {note.title}
                        </Text>
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 8, alignItems: 'center' }}>
                          <Text style={{ fontSize: 11, color: colors.textSecondary, fontWeight: '600' }}>{note.subject}</Text>
                          <Text style={{ fontSize: 11, color: colors.textTertiary, fontWeight: '600' }}>6 pages</Text>
                        </View>
                      </View>
                    </TouchableOpacity>
                  ))
                )}
              </View>
            </View>
          </ScrollView>
        </View>
      </View>

      {/* Creation Modal */}
      {showCreateModal && (
        <View style={[StyleSheet.absoluteFillObject, { backgroundColor: 'rgba(0,0,0,0.4)', zIndex: 1000, justifyContent: 'center', padding: 20 }]}>
          <View style={[styles.modalContent, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Text style={[styles.modalTitle, { color: colors.textPrimary }]}>Create New Pilot Note</Text>
            
            <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>TITLE</Text>
            <TextInput
              value={newNoteTitle}
              onChangeText={setNewNoteTitle}
              placeholder="e.g. Directive Principles"
              placeholderTextColor={colors.textTertiary}
              style={[styles.input, { color: colors.textPrimary, borderColor: colors.border, backgroundColor: colors.bg }]}
            />

            <Text style={[styles.inputLabel, { color: colors.textSecondary, marginTop: 12 }]}>SUBJECT</Text>
            <TextInput
              value={newNoteSubject}
              onChangeText={setNewNoteSubject}
              placeholder="e.g. Polity, Economy, Ethics"
              placeholderTextColor={colors.textTertiary}
              style={[styles.input, { color: colors.textPrimary, borderColor: colors.border, backgroundColor: colors.bg }]}
            />

            <View style={styles.modalButtons}>
              <TouchableOpacity onPress={() => setShowCreateModal(false)} style={[styles.modalBtn, { borderColor: colors.border, borderWidth: 1 }]}>
                <Text style={{ color: colors.textSecondary, fontWeight: '700' }}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={handleCreate} style={[styles.modalBtn, { backgroundColor: colors.primary }]}>
                <Text style={{ color: '#fff', fontWeight: '700' }}>Create</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  root: { flex: 1 },
  container: { flex: 1, flexDirection: 'row' },
  // Sidebar styles
  sidebar: { width: 230, borderRightWidth: 1, flexDirection: 'column', height: '100%' },
  sidebarHeader: { paddingHorizontal: 20, paddingVertical: 18, flexDirection: 'row', alignItems: 'center', gap: 10 },
  sidebarLogoIcon: { width: 28, height: 28, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  sidebarLogoText: { fontSize: 16, fontWeight: '900' },
  sidebarScroll: { flex: 1 },
  sidebarSectionHeader: { fontSize: 10, fontWeight: '800', letterSpacing: 0.8, paddingHorizontal: 20, marginTop: 18, marginBottom: 8 },
  sidebarSection: { paddingHorizontal: 12, gap: 2 },
  sidebarItem: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 12, paddingVertical: 10, borderRadius: 10 },
  sidebarItemActive: { fontWeight: '700' },
  sidebarItemText: { fontSize: 13, fontWeight: '700' },
  sidebarFooter: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 24, paddingVertical: 16, borderTopWidth: 1 },
  
  // Main Pane styles
  mainPane: { flex: 1, flexDirection: 'column' },
  topBreadcrumbRow: { height: 52, borderBottomWidth: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20 },
  breadcrumbText: { fontSize: 12, fontWeight: '800', letterSpacing: 0.5 },
  newBtn: { height: 32, paddingHorizontal: 14, borderRadius: 8, flexDirection: 'row', alignItems: 'center', gap: 6 },
  newBtnText: { color: '#fff', fontWeight: '800', fontSize: 12 },
  searchRow: { paddingHorizontal: 20, paddingTop: 14 },
  searchContainer: { height: 42, borderRadius: 10, borderWidth: 1, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12 },
  searchIcon: { marginRight: 8 },
  searchInput: { flex: 1, fontSize: 14, padding: 0 },
  scrollContent: { paddingVertical: 16, paddingBottom: 60 },
  greetingSection: { paddingHorizontal: 20, marginBottom: 18 },
  greeting: { fontSize: 22, fontWeight: '900', marginBottom: 4 },
  subGreeting: { fontSize: 13, fontWeight: '600' },
  section: { marginBottom: 24 },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, marginBottom: 12 },
  sectionTitle: { fontSize: 15, fontWeight: '900', letterSpacing: 0.3 },
  seeAllText: { fontSize: 12, fontWeight: '800' },
  horizontalScroll: { paddingLeft: 20, gap: 12, paddingBottom: 6 },
  continueCard: { width: 200, padding: 14, borderRadius: 14, borderWidth: 1, gap: 10 },
  subjectIconWrap: { width: 32, height: 32, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  timeAgo: { fontSize: 11, fontWeight: '600' },
  continueTitle: { fontSize: 14, fontWeight: '800', lineHeight: 18, height: 36 },
  continueSubject: { fontSize: 11, fontWeight: '600' },
  pinnedGrid: { paddingHorizontal: 20, flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  pinnedCard: { width: '48%', padding: 14, borderRadius: 14, borderWidth: 1 },
  pinnedCardTitle: { fontSize: 14, fontWeight: '800' },
  emptyCard: { marginHorizontal: 20, padding: 24, borderRadius: 14, borderWidth: 1, borderStyle: 'dashed', alignItems: 'center', justifyContent: 'center' },
  modalContent: { padding: 20, borderRadius: 20, borderWidth: 1, elevation: 5, width: '90%', alignSelf: 'center' },
  modalTitle: { fontSize: 18, fontWeight: '900', marginBottom: 16 },
  inputLabel: { fontSize: 10, fontWeight: '800', letterSpacing: 0.5, marginBottom: 6 },
  input: { height: 42, borderRadius: 10, borderWidth: 1, paddingHorizontal: 12, fontSize: 14, marginBottom: 12 },
  modalButtons: { flexDirection: 'row', justifyContent: 'flex-end', gap: 10, marginTop: 12 },
  modalBtn: { height: 40, paddingHorizontal: 18, borderRadius: 10, alignItems: 'center', justifyContent: 'center' }
});

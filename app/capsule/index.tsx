/**
 * Capsule Home (Subject Hub).
 *
 * Step 3 deliverable — replicates Screen 1 from the bible spec / screenshots:
 *   • Top bar with title, search, +New CTA
 *   • Left sidebar (Home / Pinned / Recent / Shared / Trash + Subject list)
 *   • Main content: Continue Studying / Pinned / Recent grids OR an empty
 *     state when the user has no subjects yet.
 *
 * In Step 4 the sidebar transforms into the dynamic expandable tree.
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, RefreshControl,
  ActivityIndicator, useWindowDimensions, Modal,
} from 'react-native';
import { Plus, X as CloseIcon, Sparkles } from 'lucide-react-native';
import { useRouter } from 'expo-router';
import { useTheme } from '../../src/context/ThemeContext';
import { useAuth } from '../../src/context/AuthContext';
import { PageWrapper } from '../../src/components/PageWrapper';
import { CapsuleSidebar, CapsuleSidebarSection } from '../../src/components/capsule/CapsuleSidebar';
import { CapsuleTopBar } from '../../src/components/capsule/CapsuleTopBar';
import { CapsuleNoteCard } from '../../src/components/capsule/CapsuleNoteCard';
import { CapsuleCreatePrompt } from '../../src/components/capsule/CapsuleCreatePrompt';
import {
  fetchAllCapsuleNodes, createCapsuleNode, pinCapsuleNode, buildCapsuleTree,
} from '../../src/repositories/capsuleRepo';
import { CapsuleNode, CAPSULE_SUBJECT_PALETTE } from '../../src/types/capsule';
import { supabase } from '../../src/lib/supabase';

const SIDEBAR_WIDTH = 280;
const TABLET_BREAKPOINT = 900;

interface NotebookSummary {
  node: CapsuleNode;
  subjectTitle: string;
  subjectColor: string;
  updatedAt: string;
  pageCount: number;
}

export default function CapsuleHome() {
  const { colors } = useTheme();
  const { session } = useAuth();
  const router = useRouter();
  const { width } = useWindowDimensions();
  const isTablet = width >= TABLET_BREAKPOINT;

  const [nodes, setNodes] = useState<CapsuleNode[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');
  const [layout, setLayout] = useState<'grid' | 'list'>('grid');
  const [activeSection, setActiveSection] = useState<CapsuleSidebarSection>('home');
  const [activeSubjectId, setActiveSubjectId] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [sidebarOpenMobile, setSidebarOpenMobile] = useState(false);
  const [notebookPages, setNotebookPages] = useState<Record<string, number>>({});

  const userId = session?.user?.id || '';

  const reload = useCallback(async () => {
    if (!userId) return;
    const list = await fetchAllCapsuleNodes(userId);
    setNodes(list);

    // Pre-fetch page counts for visible notebooks (lightweight)
    const notebookIds = list.filter((n) => n.type === 'notebook' && n.note_id).map((n) => n.note_id!) as string[];
    if (notebookIds.length) {
      const { data } = await supabase
        .from('user_notes')
        .select('id,content')
        .in('id', notebookIds);
      const counts: Record<string, number> = {};
      (data || []).forEach((row: any) => {
        try {
          const blocks = JSON.parse(row.content || '{}')?.blocks;
          counts[row.id] = Array.isArray(blocks) ? blocks.length : 0;
        } catch {
          counts[row.id] = 0;
        }
      });
      setNotebookPages(counts);
    }
  }, [userId]);

  useEffect(() => {
    let active = true;
    (async () => {
      setLoading(true);
      await reload();
      if (active) setLoading(false);
    })();
    return () => { active = false; };
  }, [reload]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await reload();
    setRefreshing(false);
  }, [reload]);

  /* ---------------- Derived data ---------------- */

  const tree = useMemo(() => buildCapsuleTree(nodes), [nodes]);
  const subjects = useMemo(() => nodes.filter((n) => n.type === 'subject'), [nodes]);
  const notebooks = useMemo(() => nodes.filter((n) => n.type === 'notebook'), [nodes]);

  const subjectIndex = useMemo(() => {
    const map = new Map<string, CapsuleNode>();
    nodes.forEach((n) => map.set(n.id, n));
    return map;
  }, [nodes]);

  const resolveSubject = useCallback((node: CapsuleNode): CapsuleNode | null => {
    let cur: CapsuleNode | undefined = node;
    while (cur && cur.type !== 'subject' && cur.parent_id) {
      cur = subjectIndex.get(cur.parent_id) as CapsuleNode | undefined;
    }
    return cur && cur.type === 'subject' ? cur : null;
  }, [subjectIndex]);

  const summaries: NotebookSummary[] = useMemo(() => {
    const enriched = notebooks.map((n) => {
      const subject = resolveSubject(n);
      const pageCount = n.note_id ? (notebookPages[n.note_id] || 0) : 0;
      return {
        node: n,
        subjectTitle: subject?.title || 'Capsule',
        subjectColor:
          (subject?.color as string) ||
          CAPSULE_SUBJECT_PALETTE[subject?.title || ''] ||
          CAPSULE_SUBJECT_PALETTE.default,
        updatedAt: n.updated_at || n.created_at || '',
        pageCount,
      } as NotebookSummary;
    });
    enriched.sort((a, b) => (b.updatedAt || '').localeCompare(a.updatedAt || ''));
    return enriched;
  }, [notebooks, notebookPages, resolveSubject]);

  const filteredSummaries = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return summaries;
    return summaries.filter(
      (s) => s.node.title.toLowerCase().includes(q) || s.subjectTitle.toLowerCase().includes(q)
    );
  }, [summaries, search]);

  const continueStudying = filteredSummaries.slice(0, 4);
  const pinnedNotes = useMemo(
    () => filteredSummaries.filter((s) => s.node.is_pinned).slice(0, 4),
    [filteredSummaries]
  );
  const recentNotes = filteredSummaries.slice(0, 9);

  /* ---------------- Actions ---------------- */

  const handleCreateSubject = async ({ title, color }: { title: string; color?: string }) => {
    if (!userId) return;
    const node = await createCapsuleNode({
      userId, type: 'subject', title, color: color || null, parentId: null,
    });
    if (node) setNodes((prev) => [...prev, node]);
    setCreateOpen(false);
  };

  const handleSelectSubject = (subjectId: string) => {
    setActiveSubjectId(subjectId);
    // Step 4 will navigate inside the same view; for now route to /capsule/subject/[id]
    router.push({ pathname: '/capsule/subject/[id]', params: { id: subjectId } } as any);
  };

  const handleSectionChange = (section: CapsuleSidebarSection) => {
    setActiveSection(section);
    setActiveSubjectId(null);
    setSidebarOpenMobile(false);
  };

  const handleTogglePin = async (notebookId: string, current: boolean) => {
    setNodes((prev) => prev.map((n) => (n.id === notebookId ? { ...n, is_pinned: !current } : n)));
    await pinCapsuleNode(notebookId, !current);
  };

  /* ---------------- Render ---------------- */

  if (!session) {
    return (
      <PageWrapper>
        <View style={styles.center}>
          <Text style={{ color: colors.textPrimary }}>Please log in to use Capsule.</Text>
        </View>
      </PageWrapper>
    );
  }

  const sidebarNode = (
    <CapsuleSidebar
      subjects={subjects}
      activeSection={activeSection}
      activeSubjectId={activeSubjectId}
      onSelectSection={handleSectionChange}
      onSelectSubject={handleSelectSubject}
      onAddSubject={() => setCreateOpen(true)}
    />
  );

  return (
    <PageWrapper>
      <View style={styles.root}>
        {/* Sidebar — inline on tablet, drawer on phone */}
        {isTablet ? (
          sidebarNode
        ) : (
          <Modal
            visible={sidebarOpenMobile}
            transparent
            animationType="slide"
            onRequestClose={() => setSidebarOpenMobile(false)}
          >
            <View style={styles.drawerBackdrop}>
              <View style={[styles.drawerWrap, { backgroundColor: colors.surface }]}>
                <View style={styles.drawerHead}>
                  <TouchableOpacity onPress={() => setSidebarOpenMobile(false)} style={styles.drawerClose}>
                    <CloseIcon color={colors.textTertiary} size={20} />
                  </TouchableOpacity>
                </View>
                {sidebarNode}
              </View>
              <TouchableOpacity
                style={StyleSheet.absoluteFill}
                onPress={() => setSidebarOpenMobile(false)}
                activeOpacity={1}
              />
            </View>
          </Modal>
        )}

        {/* Main content */}
        <View style={styles.main}>
          <CapsuleTopBar
            title="Capsule"
            searchValue={search}
            onSearchChange={setSearch}
            onNew={() => setCreateOpen(true)}
            newLabel="+ New"
            layout={layout}
            onToggleLayout={() => setLayout((l) => (l === 'grid' ? 'list' : 'grid'))}
            onMenuPress={() => setSidebarOpenMobile(true)}
            onBack={() => router.back()}
            showSidebarToggle={!isTablet}
          />

          <ScrollView
            style={styles.scroll}
            contentContainerStyle={styles.scrollContent}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
          >
            {loading ? (
              <View style={styles.center}>
                <ActivityIndicator color={colors.primary} />
              </View>
            ) : subjects.length === 0 ? (
              <EmptyState colors={colors} onCreate={() => setCreateOpen(true)} />
            ) : (
              <>
                <Section
                  title="Continue Studying"
                  items={continueStudying}
                  columns={isTablet ? 4 : 2}
                  emptyHint="Open a notebook to see it here"
                  onOpen={(n) => router.push({ pathname: '/capsule/glance/[id]', params: { id: n.id } } as any)}
                  onTogglePin={handleTogglePin}
                />

                <Section
                  title="Pinned Notes"
                  items={pinnedNotes}
                  columns={isTablet ? 2 : 1}
                  emptyHint="Pin notebooks with the ⭐ icon to keep them handy"
                  showStar
                  showPagesCount
                  onOpen={(n) => router.push({ pathname: '/capsule/glance/[id]', params: { id: n.id } } as any)}
                  onTogglePin={handleTogglePin}
                />

                <Section
                  title="Recent Notes"
                  items={recentNotes}
                  columns={isTablet ? 3 : 1}
                  emptyHint="Recently edited notebooks land here"
                  showStar
                  onOpen={(n) => router.push({ pathname: '/capsule/glance/[id]', params: { id: n.id } } as any)}
                  onTogglePin={handleTogglePin}
                />
              </>
            )}
          </ScrollView>
        </View>
      </View>

      <CapsuleCreatePrompt
        visible={createOpen}
        type="subject"
        onCancel={() => setCreateOpen(false)}
        onCreate={handleCreateSubject}
      />
    </PageWrapper>
  );
}

/* -------------------------------------------------------------------------- */
/* Helpers                                                                    */
/* -------------------------------------------------------------------------- */

const Section: React.FC<{
  title: string;
  items: NotebookSummary[];
  columns: number;
  emptyHint?: string;
  showStar?: boolean;
  showPagesCount?: boolean;
  onOpen: (n: CapsuleNode) => void;
  onTogglePin: (id: string, current: boolean) => void;
}> = ({ title, items, columns, emptyHint, showStar, showPagesCount, onOpen, onTogglePin }) => {
  const { colors } = useTheme();

  return (
    <View style={styles.section}>
      <View style={styles.sectionHead}>
        <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>{title}</Text>
        <TouchableOpacity><Text style={[styles.seeAll, { color: colors.primary }]}>See All ›</Text></TouchableOpacity>
      </View>

      {items.length === 0 ? (
        <Text style={[styles.emptyHint, { color: colors.textTertiary }]} testID={`capsule-empty-${title.replace(/\s/g,'-').toLowerCase()}`}>
          {emptyHint}
        </Text>
      ) : (
        <View style={[styles.grid, { gap: 12 }]}>
          {chunkInto(items, columns).map((row, i) => (
            <View key={i} style={[styles.gridRow, { gap: 12 }]}>
              {row.map((s) => (
                <CapsuleNoteCard
                  key={s.node.id}
                  testID={`capsule-card-${s.node.id}`}
                  title={s.node.title}
                  subject={s.subjectTitle}
                  color={s.subjectColor}
                  pinned={showStar ? !!s.node.is_pinned : undefined}
                  pagesCount={showPagesCount ? s.pageCount : undefined}
                  subtitle={formatTimestamp(s.updatedAt)}
                  iconKey={s.node.type === 'notebook' ? 'note' : 'folder'}
                  onPress={() => onOpen(s.node)}
                  onTogglePin={() => onTogglePin(s.node.id, !!s.node.is_pinned)}
                />
              ))}
              {row.length < columns &&
                Array.from({ length: columns - row.length }).map((_, j) => (
                  <View key={`spacer-${j}`} style={{ flex: 1 }} />
                ))}
            </View>
          ))}
        </View>
      )}
    </View>
  );
};

const EmptyState: React.FC<{ colors: any; onCreate: () => void }> = ({ colors, onCreate }) => (
  <View style={styles.emptyWrap}>
    <View style={[styles.emptyIcon, { backgroundColor: hex(colors.primary, 0.12) }]}>
      <Sparkles color={colors.primary} size={42} />
    </View>
    <Text style={[styles.emptyTitle, { color: colors.textPrimary }]}>Your Capsule is empty</Text>
    <Text style={[styles.emptyBody, { color: colors.textSecondary }]}>
      Create your first Subject — like Polity or Economy — to start building a structured,
      revisable knowledge tree of Topics → Subtopics → Notebooks.
    </Text>
    <TouchableOpacity
      testID="capsule-empty-create-subject"
      onPress={onCreate}
      style={[styles.cta, { backgroundColor: colors.primary }]}
    >
      <Plus color="#fff" size={16} strokeWidth={2.5} />
      <Text style={styles.ctaText}>Create your first subject</Text>
    </TouchableOpacity>
  </View>
);

function chunkInto<T>(arr: T[], n: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += n) out.push(arr.slice(i, i + n));
  return out;
}

function formatTimestamp(iso: string): string {
  if (!iso) return '';
  try {
    const d = new Date(iso);
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffH = diffMs / 3600_000;
    if (diffH < 24 && now.toDateString() === d.toDateString()) {
      return `Today, ${d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}`;
    }
    if (diffH < 48) return 'Yesterday';
    const diffD = Math.floor(diffH / 24);
    if (diffD < 7) return `${diffD} days ago`;
    return d.toLocaleDateString();
  } catch {
    return '';
  }
}

function hex(c: string, alpha: number): string {
  if (!c?.startsWith('#') || c.length !== 7) return c;
  const a = Math.round(alpha * 255).toString(16).padStart(2, '0');
  return `${c}${a}`;
}

/* -------------------------------------------------------------------------- */
/* Styles                                                                     */
/* -------------------------------------------------------------------------- */

const styles = StyleSheet.create({
  root: { flex: 1, flexDirection: 'row' },
  main: { flex: 1, flexDirection: 'column' },
  scroll: { flex: 1 },
  scrollContent: { paddingBottom: 80 },

  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },

  /* sections */
  section: { paddingHorizontal: 16, paddingTop: 20 },
  sectionHead: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  sectionTitle: { fontSize: 16, fontWeight: '700', flex: 1 },
  seeAll: { fontSize: 13, fontWeight: '500' },
  emptyHint: { fontSize: 12, marginTop: 4 },
  grid: {},
  gridRow: { flexDirection: 'row' },

  /* drawer */
  drawerBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)' },
  drawerWrap: { width: 280, height: '100%', flexDirection: 'column' },
  drawerHead: { height: 36, alignItems: 'flex-end', paddingHorizontal: 12, paddingTop: 8 },
  drawerClose: { padding: 4 },

  /* empty */
  emptyWrap: { alignItems: 'center', paddingHorizontal: 32, paddingTop: 56 },
  emptyIcon: { width: 84, height: 84, borderRadius: 24, alignItems: 'center', justifyContent: 'center', marginBottom: 20 },
  emptyTitle: { fontSize: 20, fontWeight: '700', marginBottom: 8, textAlign: 'center' },
  emptyBody: { fontSize: 14, lineHeight: 20, textAlign: 'center', marginBottom: 24 },
  cta: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingHorizontal: 20, height: 44, borderRadius: 12,
  },
  ctaText: { color: '#fff', fontSize: 14, fontWeight: '600' },
});

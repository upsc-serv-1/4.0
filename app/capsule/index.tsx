/**
 * Capsule Home — single-route Subject Hub with the dynamic expandable
 * sidebar (per bible spec). Right pane swaps between:
 *   • Dashboard (Continue Studying / Pinned / Recent)  — when no node selected
 *   • Notebook list                                    — when subject/topic/subtopic selected
 *   • (Glance/editor lives at /capsule/glance/[id] etc — Step 6+)
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, RefreshControl,
  ActivityIndicator, useWindowDimensions, Modal,
} from 'react-native';
import {
  Plus, X as CloseIcon, Sparkles, BookOpen, FileText, Star, MoreHorizontal,
  ChevronLeft, PanelLeftOpen, PanelLeftClose, Bell, Share2, Edit3,
} from 'lucide-react-native';
import { useRouter } from 'expo-router';
import { useTheme } from '../../src/context/ThemeContext';
import { useAuth } from '../../src/context/AuthContext';
import { PageWrapper } from '../../src/components/PageWrapper';
import { CapsuleSidebar, CapsuleSidebarSection } from '../../src/components/capsule/CapsuleSidebar';
import { CapsuleTopBar } from '../../src/components/capsule/CapsuleTopBar';
import { CapsuleNoteCard } from '../../src/components/capsule/CapsuleNoteCard';
import { CapsuleCreatePrompt } from '../../src/components/capsule/CapsuleCreatePrompt';
import { CapsuleBreadcrumb } from '../../src/components/capsule/CapsuleBreadcrumb';
import {
  fetchAllCapsuleNodes, createCapsuleNode, pinCapsuleNode, buildCapsuleTree,
  createNotebookRow, fetchNotebookContent, CapsuleTreeNode,
} from '../../src/repositories/capsuleRepo';
import {
  CapsuleNode, CapsuleNodeType, CAPSULE_SUBJECT_PALETTE,
} from '../../src/types/capsule';
import { supabase } from '../../src/lib/supabase';

const TABLET_BREAKPOINT = 900;

interface NotebookSummary {
  node: CapsuleNode;
  subjectTitle: string;
  subjectColor: string;
  updatedAt: string;
  pageCount: number;
}

const CHILD_TYPE: Record<CapsuleNodeType, CapsuleNodeType | null> = {
  subject:  'topic',
  topic:    'subtopic',
  subtopic: 'notebook',
  notebook: null,
};

const NEW_LABEL: Record<CapsuleNodeType, string> = {
  subject:  '+ New Topic',
  topic:    '+ New Subtopic',
  subtopic: '+ New Notebook',
  notebook: '+ New Notebook',
};

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

  /* hierarchy navigation state */
  const [activeSection, setActiveSection] = useState<CapsuleSidebarSection>('home');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [sidebarOpenMobile, setSidebarOpenMobile] = useState(false);

  /* create-node prompt */
  const [createState, setCreateState] = useState<{
    open: boolean; type: CapsuleNodeType; parentId: string | null;
  }>({ open: false, type: 'subject', parentId: null });

  const [notebookPages, setNotebookPages] = useState<Record<string, number>>({});
  const [glanceNoteId, setGlanceNoteId] = useState<string | null>(null);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  const userId = session?.user?.id || '';

  const reload = useCallback(async () => {
    if (!userId) return;
    const list = await fetchAllCapsuleNodes(userId);
    setNodes(list);

    const noteIds = list.filter((n) => n.type === 'notebook' && n.note_id).map((n) => n.note_id!) as string[];
    if (noteIds.length) {
      const { data } = await supabase.from('user_notes').select('id,content').in('id', noteIds);
      const counts: Record<string, number> = {};
      (data || []).forEach((row: any) => {
        try { counts[row.id] = JSON.parse(row.content || '{}')?.blocks?.length || 0; } catch { counts[row.id] = 0; }
      });
      setNotebookPages(counts);
    } else {
      setNotebookPages({});
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

  const nodeIndex = useMemo(() => {
    const m = new Map<string, CapsuleNode>();
    nodes.forEach((n) => m.set(n.id, n));
    return m;
  }, [nodes]);

  const treeIndex = useMemo(() => {
    const m = new Map<string, CapsuleTreeNode>();
    const walk = (arr: CapsuleTreeNode[]) => arr.forEach((n) => { m.set(n.id, n); walk(n.children); });
    walk(tree);
    return m;
  }, [tree]);

  const breadcrumbTrail: CapsuleNode[] = useMemo(() => {
    if (!selectedId) return [];
    const trail: CapsuleNode[] = [];
    let cur = nodeIndex.get(selectedId) || null;
    while (cur) {
      trail.unshift(cur);
      cur = cur.parent_id ? nodeIndex.get(cur.parent_id) || null : null;
    }
    return trail;
  }, [selectedId, nodeIndex]);

  const resolveSubject = useCallback((node: CapsuleNode): CapsuleNode | null => {
    let cur: CapsuleNode | undefined = node;
    while (cur && cur.type !== 'subject' && cur.parent_id) {
      cur = nodeIndex.get(cur.parent_id) as CapsuleNode | undefined;
    }
    return cur && cur.type === 'subject' ? cur : null;
  }, [nodeIndex]);

  const allNotebooks = useMemo(() => nodes.filter((n) => n.type === 'notebook'), [nodes]);
  const subjects = useMemo(() => nodes.filter((n) => n.type === 'subject'), [nodes]);

  const summarize = useCallback((notebook: CapsuleNode): NotebookSummary => {
    const subj = resolveSubject(notebook);
    return {
      node: notebook,
      subjectTitle: subj?.title || 'Capsule',
      subjectColor:
        (subj?.color as string) ||
        CAPSULE_SUBJECT_PALETTE[subj?.title || ''] ||
        CAPSULE_SUBJECT_PALETTE.default,
      updatedAt: notebook.updated_at || notebook.created_at || '',
      pageCount: notebook.note_id ? (notebookPages[notebook.note_id] || 0) : 0,
    };
  }, [resolveSubject, notebookPages]);

  const allSummaries = useMemo(
    () => allNotebooks.map(summarize).sort((a, b) => (b.updatedAt || '').localeCompare(a.updatedAt || '')),
    [allNotebooks, summarize]
  );

  const filteredAll = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return allSummaries;
    return allSummaries.filter(
      (s) => s.node.title.toLowerCase().includes(q) || s.subjectTitle.toLowerCase().includes(q)
    );
  }, [allSummaries, search]);

  /** Notebooks under the currently selected subtree. */
  const scopedSummaries: NotebookSummary[] = useMemo(() => {
    if (!selectedId) {
      switch (activeSection) {
        case 'pinned':  return filteredAll.filter((s) => s.node.is_pinned);
        case 'recent':  return filteredAll;
        case 'shared':  return [];
        case 'trash':   return [];
        default:        return filteredAll;
      }
    }
    const root = treeIndex.get(selectedId);
    if (!root) return [];
    const out: NotebookSummary[] = [];
    const walk = (n: CapsuleTreeNode) => {
      if (n.type === 'notebook') out.push(summarize(n));
      n.children.forEach(walk);
    };
    walk(root);
    const q = search.trim().toLowerCase();
    return q
      ? out.filter((s) => s.node.title.toLowerCase().includes(q))
      : out;
  }, [selectedId, treeIndex, summarize, activeSection, filteredAll, search]);

  /* ---------------- Actions ---------------- */

  const openCreate = (type: CapsuleNodeType, parentId: string | null) =>
    setCreateState({ open: true, type, parentId });

  const handleCreate = async ({ title, color }: { title: string; color?: string }) => {
    if (!userId) return;
    const { type, parentId } = createState;
    let noteId: string | null = null;
    if (type === 'notebook') {
      const subject = parentId ? resolveSubject(nodeIndex.get(parentId)!) : null;
      noteId = await createNotebookRow({
        userId, subject: subject?.title || 'Capsule', title,
      });
    }
    const node = await createCapsuleNode({
      userId, type, title,
      color: color || null,
      parentId: parentId || null,
      noteId,
    });
    if (node) {
      setNodes((prev) => [...prev, node]);
      // auto-expand the newly created parent if applicable
      if (parentId) setExpandedIds((prev) => new Set(prev).add(parentId));
      // auto-select the new node so user immediately sees the tree update
      setSelectedId(node.id);
    }
    setCreateState((s) => ({ ...s, open: false }));
  };

  const handleSelectNode = (n: CapsuleTreeNode) => {
    if (n.type === 'notebook' && n.note_id) {
      setGlanceNoteId(n.note_id);
      return;
    }
    setGlanceNoteId(null);
    setSelectedId(n.id);
    setSidebarOpenMobile(false);
  };

  const handleToggleExpand = (n: CapsuleTreeNode) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(n.id)) next.delete(n.id); else next.add(n.id);
      return next;
    });
  };

  const handleSectionChange = (section: CapsuleSidebarSection) => {
    setActiveSection(section);
    setSelectedId(null);
    setGlanceNoteId(null);
    setSidebarOpenMobile(false);
  };

  const handleTogglePin = async (notebookId: string, current: boolean) => {
    setNodes((prev) => prev.map((n) => (n.id === notebookId ? { ...n, is_pinned: !current } : n)));
    await pinCapsuleNode(notebookId, !current);
  };

  const handleNewBtn = () => {
    if (!selectedId) {
      openCreate('subject', null);
      return;
    }
    const cur = nodeIndex.get(selectedId);
    if (!cur) return openCreate('subject', null);
    const childType = CHILD_TYPE[cur.type];
    if (!childType) return; // notebook leaf
    openCreate(childType, cur.id);
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
      tree={tree}
      expandedIds={expandedIds}
      selectedId={selectedId}
      activeSection={activeSection}
      onSelectSection={handleSectionChange}
      onSelectNode={handleSelectNode}
      onToggleExpand={handleToggleExpand}
      onAddSubject={() => openCreate('subject', null)}
      onAddChild={(parent) => {
        const childType = CHILD_TYPE[parent.type];
        if (childType) openCreate(childType, parent.id);
      }}
    />
  );

  const selectedNode = selectedId ? nodeIndex.get(selectedId) : null;
  const titleForBar = selectedNode?.title || 'Capsule';
  const newLabel = selectedNode ? NEW_LABEL[selectedNode.type] : '+ New';
  const canCreateChild = !selectedNode || CHILD_TYPE[selectedNode.type] !== null;

  return (
    <PageWrapper>
      <View style={styles.root}>
        {/* Sidebar — inline on tablet, drawer on phone */}
        {isTablet ? (
          !sidebarCollapsed && sidebarNode
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
          {glanceNoteId ? (
            <InlineGlance
              noteId={glanceNoteId}
              sidebarCollapsed={sidebarCollapsed}
              onToggleSidebar={() => setSidebarCollapsed((s) => !s)}
              onClose={() => setGlanceNoteId(null)}
              onEdit={() => router.push({ pathname: '/capsule/editor/[id]', params: { id: glanceNoteId } } as any)}
            />
          ) : (
            <>
              <CapsuleTopBar
                title={titleForBar}
                searchValue={search}
                onSearchChange={setSearch}
                onNew={handleNewBtn}
                newLabel={canCreateChild ? newLabel : '+ New'}
                layout={layout}
                onToggleLayout={() => setLayout((l) => (l === 'grid' ? 'list' : 'grid'))}
                onMenuPress={() => setSidebarOpenMobile(true)}
                onBack={() => {
                  if (selectedId) {
                    const cur = nodeIndex.get(selectedId);
                    setSelectedId(cur?.parent_id ?? null);
                  } else {
                    router.back();
                  }
                }}
                showSidebarToggle={!isTablet}
              />

              {selectedId && (
                <CapsuleBreadcrumb
                  trail={breadcrumbTrail}
                  onJump={(i) => setSelectedId(breadcrumbTrail[i].id)}
                  onJumpRoot={() => setSelectedId(null)}
                />
              )}

              <ScrollView
                style={styles.scroll}
                contentContainerStyle={styles.scrollContent}
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
              >
                {loading ? (
                  <View style={styles.center}><ActivityIndicator color={colors.primary} /></View>
                ) : selectedId ? (
                  <NodeContent
                    summaries={scopedSummaries}
                    isTablet={isTablet}
                    onOpen={(n) => n.note_id && setGlanceNoteId(n.note_id)}
                    onTogglePin={handleTogglePin}
                    onCreate={handleNewBtn}
                    createLabel={canCreateChild ? newLabel : ''}
                    emptyHint={selectedNode?.type === 'notebook' ? 'Open this notebook from the tree' : 'No notebooks yet — create one'}
                  />
                ) : subjects.length === 0 ? (
                  <EmptyState colors={colors} onCreate={() => openCreate('subject', null)} />
                ) : (
                  <DashboardSections
                    summaries={filteredAll}
                    isTablet={isTablet}
                    onOpen={(n) => n.note_id && setGlanceNoteId(n.note_id)}
                    onTogglePin={handleTogglePin}
                  />
                )}
              </ScrollView>
            </>
          )}
        </View>
      </View>

      <CapsuleCreatePrompt
        visible={createState.open}
        type={createState.type}
        defaultColor={createState.type === 'subject' ? CAPSULE_SUBJECT_PALETTE.default : null}
        onCancel={() => setCreateState((s) => ({ ...s, open: false }))}
        onCreate={handleCreate}
      />
    </PageWrapper>
  );
}

/* -------------------------------------------------------------------------- */
/* Sections                                                                    */
/* -------------------------------------------------------------------------- */

const DashboardSections: React.FC<{
  summaries: NotebookSummary[];
  isTablet: boolean;
  onOpen: (n: CapsuleNode) => void;
  onTogglePin: (id: string, current: boolean) => void;
}> = ({ summaries, isTablet, onOpen, onTogglePin }) => (
  <>
    <Section
      title="Continue Studying" items={summaries.slice(0, isTablet ? 4 : 4)} columns={isTablet ? 4 : 2}
      emptyHint="Open a notebook to see it here"
      onOpen={onOpen} onTogglePin={onTogglePin}
    />
    <Section
      title="Pinned Notes" items={summaries.filter((s) => s.node.is_pinned).slice(0, 4)} columns={isTablet ? 2 : 1}
      emptyHint="Pin notebooks with the ⭐ icon to keep them handy"
      showStar showPagesCount onOpen={onOpen} onTogglePin={onTogglePin}
    />
    <Section
      title="Recent Notes" items={summaries.slice(0, 9)} columns={isTablet ? 3 : 1}
      emptyHint="Recently edited notebooks land here"
      showStar onOpen={onOpen} onTogglePin={onTogglePin}
    />
  </>
);

const NotebookListRow: React.FC<{
  title: string;
  subject: string;
  color: string;
  pinned?: boolean;
  updatedAt: string;
  onPress: () => void;
  onTogglePin: () => void;
}> = ({ title, subject, color, pinned, updatedAt, onPress, onTogglePin }) => {
  const { colors } = useTheme();
  return (
    <TouchableOpacity
      onPress={onPress}
      style={[listRowStyles.row, { borderBottomColor: colors.border }]}
    >
      <View style={[listRowStyles.iconBox, { backgroundColor: color + '22' }]}>
        <FileText size={20} color={color} />
      </View>

      <View style={listRowStyles.textCol}>
        <Text style={[listRowStyles.title, { color: colors.textPrimary }]} numberOfLines={1}>
          {title}
        </Text>
        <Text style={[listRowStyles.sub, { color: colors.textTertiary }]}>
          {subject} · {formatTimestamp(updatedAt)}
        </Text>
      </View>

      {pinned !== undefined && (
        <TouchableOpacity onPress={onTogglePin} style={listRowStyles.starBtn}>
          <Star
            size={16}
            color={pinned ? '#FFB800' : colors.border}
            fill={pinned ? '#FFB800' : 'transparent'}
          />
        </TouchableOpacity>
      )}

      <TouchableOpacity style={listRowStyles.moreBtn}>
        <MoreHorizontal size={18} color={colors.textTertiary} />
      </TouchableOpacity>
    </TouchableOpacity>
  );
};

const NodeContent: React.FC<{
  summaries: NotebookSummary[];
  isTablet: boolean;
  onOpen: (n: CapsuleNode) => void;
  onTogglePin: (id: string, current: boolean) => void;
  onCreate: () => void;
  createLabel: string;
  emptyHint: string;
}> = ({ summaries, isTablet, onOpen, onTogglePin, onCreate, createLabel, emptyHint }) => {
  const { colors } = useTheme();
  if (summaries.length === 0) {
    return (
      <View style={styles.emptyWrap}>
        <View style={[styles.emptyIcon, { backgroundColor: hex(colors.primary, 0.12) }]}>
          <BookOpen color={colors.primary} size={36} />
        </View>
        <Text style={[styles.emptyTitle, { color: colors.textPrimary }]}>{emptyHint}</Text>
        {!!createLabel && (
          <TouchableOpacity
            testID="capsule-node-empty-create"
            onPress={onCreate}
            style={[styles.cta, { backgroundColor: colors.primary }]}
          >
            <Plus color="#fff" size={16} strokeWidth={2.5} />
            <Text style={styles.ctaText}>{createLabel.replace(/^\+\s*/, '')}</Text>
          </TouchableOpacity>
        )}
      </View>
    );
  }
  return (
    <View style={[styles.section, { paddingTop: 12 }]}>
      <View style={{ flex: 1 }}>
        {summaries.map((s) => (
          <NotebookListRow
            key={s.node.id}
            title={s.node.title}
            subject={s.subjectTitle}
            color={s.subjectColor}
            pinned={!!s.node.is_pinned}
            updatedAt={s.updatedAt}
            onPress={() => onOpen(s.node)}
            onTogglePin={() => onTogglePin(s.node.id, !!s.node.is_pinned)}
          />
        ))}
      </View>
    </View>
  );
};

const Section: React.FC<{
  title: string; items: NotebookSummary[]; columns: number; emptyHint?: string;
  showStar?: boolean; showPagesCount?: boolean;
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
        <Text style={[styles.emptyHint, { color: colors.textTertiary }]}>{emptyHint}</Text>
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
                  iconKey="note"
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

/* -------------------------------------------------------------------------- */
/* Helpers                                                                     */
/* -------------------------------------------------------------------------- */

function chunkInto<T>(arr: T[], n: number): T[][] {
  if (n <= 0) return [arr];
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += n) out.push(arr.slice(i, i + n));
  return out;
}

function formatTimestamp(iso: string): string {
  if (!iso) return '';
  try {
    const d = new Date(iso);
    const now = new Date();
    const diffH = (now.getTime() - d.getTime()) / 3600_000;
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
/* Styles                                                                      */
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
  emptyTitle: { fontSize: 18, fontWeight: '700', marginBottom: 8, textAlign: 'center' },
  emptyBody: { fontSize: 14, lineHeight: 20, textAlign: 'center', marginBottom: 24 },
  cta: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingHorizontal: 20, height: 44, borderRadius: 12,
  },
  ctaText: { color: '#fff', fontSize: 14, fontWeight: '600' },
});

const listRowStyles = StyleSheet.create({
  row: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 20, paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    minHeight: 68,
  },
  iconBox: {
    width: 40, height: 40, borderRadius: 10,
    alignItems: 'center', justifyContent: 'center',
    marginRight: 14,
  },
  textCol: { flex: 1, gap: 3 },
  title: { fontSize: 15, fontWeight: '600' },
  sub: { fontSize: 12 },
  starBtn: { padding: 8 },
  moreBtn: { padding: 8 },
});

const BlockView: React.FC<{ block: any }> = ({ block }) => {
  const { colors } = useTheme();
  if (block.type === 'heading') {
    const fontSize = block.level === 1 ? 22 : 18;
    const marginTop = block.level === 1 ? 24 : 16;
    return (
      <Text style={{ fontSize, fontWeight: '700', color: colors.textPrimary, marginTop, marginBottom: 8 }}>
        {block.text}
      </Text>
    );
  }
  if (block.type === 'bullet') {
    return (
      <View style={{ flexDirection: 'row', gap: 8, marginVertical: 4 }}>
        <Text style={{ color: colors.textPrimary, fontSize: 15 }}>•</Text>
        <Text style={{ color: colors.textSecondary, fontSize: 15, flex: 1 }}>{block.text}</Text>
      </View>
    );
  }
  if (block.type === 'numbered') {
    return (
      <View style={{ flexDirection: 'row', gap: 8, marginVertical: 4 }}>
        <Text style={{ color: colors.textPrimary, fontSize: 15, fontWeight: '600' }}>1.</Text>
        <Text style={{ color: colors.textSecondary, fontSize: 15, flex: 1 }}>{block.text}</Text>
      </View>
    );
  }
  if (block.type === 'checklist') {
    return (
      <View style={{ flexDirection: 'row', gap: 8, marginVertical: 4, alignItems: 'center' }}>
        <View style={{ width: 16, height: 16, borderRadius: 4, borderWidth: 1.5, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' }}>
          {block.checked && <View style={{ width: 10, height: 10, borderRadius: 2, backgroundColor: colors.primary }} />}
        </View>
        <Text style={{ color: colors.textSecondary, fontSize: 15, flex: 1 }}>{block.text}</Text>
      </View>
    );
  }
  return (
    <Text style={{ color: colors.textSecondary, fontSize: 15, lineHeight: 22, marginVertical: 6 }}>
      {block.text}
    </Text>
  );
};

const InlineGlance: React.FC<{
  noteId: string;
  sidebarCollapsed: boolean;
  onToggleSidebar: () => void;
  onClose: () => void;
  onEdit: () => void;
}> = ({ noteId, sidebarCollapsed, onToggleSidebar, onClose, onEdit }) => {
  const { colors } = useTheme();
  const [content, setContent] = useState<any>(null);
  const [meta, setMeta] = useState<{ title: string; subject: string } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    (async () => {
      setLoading(true);
      const [c, { data: noteRow }] = await Promise.all([
        fetchNotebookContent(noteId),
        supabase.from('user_notes').select('title,subject').eq('id', noteId).maybeSingle(),
      ]);
      if (!active) return;
      setContent(c);
      setMeta({ title: noteRow?.title || 'Untitled', subject: noteRow?.subject || '' });
      setLoading(false);
    })();
    return () => { active = false; };
  }, [noteId]);

  return (
    <View style={{ flex: 1 }}>
      <View style={[glanceStyles.bar, { borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={onClose} style={glanceStyles.iconBtn}>
          <ChevronLeft color={colors.textPrimary} size={22} />
        </TouchableOpacity>
        <TouchableOpacity onPress={onToggleSidebar} style={glanceStyles.iconBtn}>
          {sidebarCollapsed ? <PanelLeftOpen color={colors.textPrimary} size={20} /> : <PanelLeftClose color={colors.textPrimary} size={20} />}
        </TouchableOpacity>
        <Text style={[glanceStyles.crumbText, { color: colors.textPrimary }]} numberOfLines={1}>
          {meta?.subject} › {meta?.title}
        </Text>
        <TouchableOpacity style={glanceStyles.iconBtn}><Bell size={18} color={colors.textTertiary} /></TouchableOpacity>
        <TouchableOpacity style={glanceStyles.iconBtn}><Share2 size={18} color={colors.textTertiary} /></TouchableOpacity>
        <TouchableOpacity
          onPress={onEdit}
          style={[glanceStyles.editBtn, { backgroundColor: colors.primary }]}
        >
          <Edit3 color="#fff" size={14} />
          <Text style={glanceStyles.editBtnText}>Edit</Text>
        </TouchableOpacity>
        <TouchableOpacity style={glanceStyles.iconBtn}><MoreHorizontal size={18} color={colors.textTertiary} /></TouchableOpacity>
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={glanceStyles.scrollContent}
      >
        {loading ? (
          <ActivityIndicator color={colors.primary} style={{ marginTop: 64 }} />
        ) : (
          <>
            <Text style={[glanceStyles.title, { color: colors.textPrimary }]}>
              {meta?.title}
            </Text>
            {(content?.blocks || []).map((b: any, idx: number) => <BlockView key={b.id || idx} block={b} />)}
            <Text style={[glanceStyles.eog, { color: colors.textTertiary }]}>
              — End of Glance —
            </Text>
          </>
        )}
      </ScrollView>
    </View>
  );
};

const glanceStyles = StyleSheet.create({
  bar: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 10, gap: 6,
    borderBottomWidth: StyleSheet.hairlineWidth,
    minHeight: 52,
  },
  iconBtn: { padding: 8, borderRadius: 8 },
  crumbText: { flex: 1, fontSize: 13, fontWeight: '500', paddingHorizontal: 8 },
  editBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 14, height: 34, borderRadius: 8,
  },
  editBtnText: { color: '#fff', fontSize: 13, fontWeight: '600' },
  scrollContent: {
    paddingHorizontal: 40, paddingTop: 32, paddingBottom: 80,
    maxWidth: 760, alignSelf: 'center', width: '100%',
  },
  title: { fontSize: 26, fontWeight: '700', marginBottom: 24 },
  eog: { textAlign: 'center', marginTop: 48, fontSize: 13, fontStyle: 'italic' },
});

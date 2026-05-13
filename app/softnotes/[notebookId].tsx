/**
 * Soft Notes — Notebook editor.
 *
 * Routes here at `/softnotes/[notebookId]`. Layout:
 *   ┌──────────────────────────────────────────┐
 *   │ Header (back, notebook name, +page, ⋯)   │
 *   ├──────┬───────────────────────────────────┤
 *   │ Page │                                   │
 *   │ list │           SoftCanvas              │
 *   │      │                                   │
 *   │      │      ┌──── SoftToolbar ────┐      │
 *   │      │      └─────────────────────┘      │
 *   └──────┴───────────────────────────────────┘
 *
 * Page list lives in a left rail on tablets and a horizontal scroller on phones.
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, Alert,
  ScrollView, useWindowDimensions, TextInput, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ChevronLeft, Plus, Trash2 } from 'lucide-react-native';
import { useTheme } from '../../src/context/ThemeContext';
import { useAuth } from '../../src/context/AuthContext';
import { SoftNotebookService, SoftPageService } from '../../src/softnotes/service';
import { Notebook, Page, SoftToolKind } from '../../src/softnotes/types';
import { SoftCanvas } from '../../src/softnotes/SoftCanvas';
import { SoftToolbar } from '../../src/softnotes/SoftToolbar';
import { useSoftPage } from '../../src/softnotes/useSoftPage';
import { SkeletonLoader } from '../../src/components/common/SkeletonLoader';

export default function SoftNotebookEditor() {
  const router = useRouter();
  const { colors } = useTheme();
  const { session } = useAuth();
  const userId = session?.user?.id;
  const { notebookId } = useLocalSearchParams<{ notebookId: string }>();
  const { width: winW, height: winH } = useWindowDimensions();
  const isTablet = winW >= 760;

  const [notebook, setNotebook] = useState<Notebook | null>(null);
  const [pages, setPages] = useState<Page[]>([]);
  const [activePageId, setActivePageId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [titleEditing, setTitleEditing] = useState(false);

  const [tool, setTool] = useState<SoftToolKind>('pen');
  const [color, setColor] = useState('#0f172a');
  const [strokeWidth, setStrokeWidth] = useState(2);

  const handleToolChange = useCallback((next: SoftToolKind) => {
    setTool(next);
    if (next === 'tape')        { setColor('#ffffff'); setStrokeWidth(28); }
    else if (next === 'pen')    { setColor('#0f172a'); setStrokeWidth(2); }
    else if (next === 'highlighter') { setColor('#fde68a'); setStrokeWidth(14); }
  }, []);

  const loadNotebookAndPages = useCallback(async () => {
    if (!notebookId) return;
    setLoading(true);
    let nb: Notebook | null = null;
    if (userId) {
      const list = await SoftNotebookService.list(userId);
      nb = list.find((n) => n.id === notebookId) || null;
    }
    setNotebook(nb);
    const ps = await SoftPageService.list(notebookId);
    setPages(ps);
    setActivePageId((cur) => cur && ps.some((p) => p.id === cur) ? cur : (ps[0]?.id || null));
    setLoading(false);
  }, [notebookId, userId]);

  useEffect(() => { loadNotebookAndPages(); }, [loadNotebookAndPages]);

  const activePage = useMemo(() => pages.find((p) => p.id === activePageId) || null, [pages, activePageId]);
  const pageState = useSoftPage(activePageId);

  const addPage = async () => {
    if (!notebookId) return;
    const order = pages.length;
    const p = await SoftPageService.create(notebookId, order);
    if (p) {
      setPages((prev) => [...prev, p]);
      setActivePageId(p.id);
    }
  };

  const deletePage = (pageId: string) => {
    if (pages.length <= 1) {
      Alert.alert('Cannot delete', 'A notebook must have at least one page.');
      return;
    }
    Alert.alert('Delete page?', 'All ink and text on this page will be permanently lost.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive', onPress: async () => {
          await SoftPageService.remove(pageId);
          const next = pages.filter((p) => p.id !== pageId);
          setPages(next);
          if (activePageId === pageId) setActivePageId(next[0]?.id || null);
        },
      },
    ]);
  };

  const saveTitle = async (newName: string) => {
    if (!notebook) return;
    const trimmed = newName.trim() || notebook.name;
    setNotebook({ ...notebook, name: trimmed });
    setTitleEditing(false);
    await SoftNotebookService.update(notebook.id, { name: trimmed });
  };

  if (loading) {
    return (
      <SafeAreaView style={[styles.root, { backgroundColor: colors.bg }]}>
        <SkeletonLoader type="list" count={5} colors={colors} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.root, { backgroundColor: colors.bg }]}>
      {/* Header */}
      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.iconBtn} data-testid="soft-editor-back">
          <ChevronLeft size={24} color={colors.textPrimary} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={[styles.eyebrow, { color: colors.primary }]}>NOTEBOOK</Text>
          {titleEditing ? (
            <TextInput
              defaultValue={notebook?.name || ''}
              autoFocus
              onBlur={(e) => saveTitle(e.nativeEvent.text)}
              onSubmitEditing={(e) => saveTitle(e.nativeEvent.text)}
              style={[styles.title, { color: colors.textPrimary, padding: 0 }]}
              data-testid="soft-editor-title-input"
            />
          ) : (
            <TouchableOpacity onPress={() => setTitleEditing(true)} data-testid="soft-editor-title">
              <Text style={[styles.title, { color: colors.textPrimary }]}>{notebook?.name || 'Notebook'}</Text>
            </TouchableOpacity>
          )}
        </View>
        <TouchableOpacity onPress={addPage} style={[styles.headerBtn, { backgroundColor: colors.primary }]} data-testid="soft-add-page">
          <Plus size={16} color={colors.buttonText} />
          <Text style={[styles.headerBtnTxt, { color: colors.buttonText }]}>Page</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.body}>
        {/* Page list rail / strip */}
        {isTablet ? (
          <ScrollView style={[styles.pageRail, { borderRightColor: colors.border, backgroundColor: colors.surface }]}>
            {pages.map((p, idx) => (
              <PageThumb
                key={p.id}
                index={idx}
                active={p.id === activePageId}
                onSelect={() => setActivePageId(p.id)}
                onDelete={() => deletePage(p.id)}
              />
            ))}
          </ScrollView>
        ) : (
          <ScrollView horizontal style={[styles.pageStrip, { borderBottomColor: colors.border, backgroundColor: colors.surface }]} showsHorizontalScrollIndicator={false}>
            {pages.map((p, idx) => (
              <PageThumb
                key={p.id}
                index={idx}
                active={p.id === activePageId}
                onSelect={() => setActivePageId(p.id)}
                onDelete={() => deletePage(p.id)}
                horizontal
              />
            ))}
          </ScrollView>
        )}

        {/* Canvas area */}
        <View style={styles.canvasArea} onLayout={() => { /* layout-driven sizes below */ }}>
          {activePage ? (
            pageState.loading ? (
              <View style={styles.loadingWrap}><ActivityIndicator color={colors.primary} /></View>
            ) : (
              <>
                <ScrollView
                  style={{ flex: 1 }}
                  contentContainerStyle={{ alignItems: 'center', padding: isTablet ? 24 : 12 }}
                  maximumZoomScale={1}
                  minimumZoomScale={1}
                  scrollEnabled
                >
                  <View style={[styles.pageCard, { borderColor: colors.border }]}>
                    <SoftCanvas
                      page={activePage}
                      strokes={pageState.strokes}
                      tool={tool}
                      color={color}
                      width={strokeWidth}
                      viewportWidth={activePage.width}
                      viewportHeight={activePage.height}
                      onAddStroke={pageState.addStroke}
                      onRemoveStrokes={pageState.removeStrokes}
                    />
                  </View>
                </ScrollView>
                <View style={styles.toolbarDock} pointerEvents="box-none">
                  <SoftToolbar
                    tool={tool}
                    color={color}
                    width={strokeWidth}
                    onToolChange={handleToolChange}
                    onColorChange={setColor}
                    onWidthChange={setStrokeWidth}
                    onUndo={pageState.undo}
                    canUndo={pageState.canUndo}
                    onRedo={pageState.redo}
                    canRedo={pageState.canRedo}
                  />
                </View>
              </>
            )
          ) : (
            <View style={styles.loadingWrap}>
              <Text style={{ color: colors.textTertiary }}>No page selected</Text>
            </View>
          )}
        </View>
      </View>
    </SafeAreaView>
  );
}

// ============================================================================
// PageThumb
// ============================================================================
function PageThumb({ index, active, onSelect, onDelete, horizontal }: {
  index: number; active: boolean; onSelect: () => void; onDelete: () => void; horizontal?: boolean;
}) {
  const { colors } = useTheme();
  return (
    <TouchableOpacity onPress={onSelect} style={[
      styles.pageThumb,
      horizontal && styles.pageThumbH,
      { borderColor: active ? colors.primary : colors.border, backgroundColor: '#ffffff' },
    ]} data-testid={`soft-page-thumb-${index}`}>
      <Text style={[styles.pageThumbNum, { color: active ? colors.primary : colors.textTertiary }]}>{index + 1}</Text>
      {active && (
        <TouchableOpacity onPress={onDelete} style={styles.pageThumbDel} data-testid={`soft-page-del-${index}`}>
          <Trash2 size={11} color="#ef4444" />
        </TouchableOpacity>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingHorizontal: 16, paddingVertical: 10, borderBottomWidth: 1,
  },
  iconBtn: { padding: 4 },
  eyebrow: { fontSize: 9, fontWeight: '900', letterSpacing: 1 },
  title: { fontSize: 18, fontWeight: '900', marginTop: 1 },
  headerBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10 },
  headerBtnTxt: { fontSize: 12, fontWeight: '900' },
  body: { flex: 1, flexDirection: 'row' },
  pageRail: { width: 96, borderRightWidth: 1, padding: 8, gap: 8 },
  pageStrip: { height: 76, borderBottomWidth: 1, paddingHorizontal: 8, gap: 8 },
  canvasArea: { flex: 1, position: 'relative' },
  pageCard: {
    borderWidth: 1,
    borderRadius: 4,
    overflow: 'hidden',
    ...Platform.select({ ios: { shadowOpacity: 0.08, shadowRadius: 16, shadowOffset: { width: 0, height: 6 } }, android: { elevation: 3 } }),
  },
  toolbarDock: {
    position: 'absolute', left: 0, right: 0, bottom: 16,
    alignItems: 'center',
  },
  loadingWrap: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  pageThumb: {
    width: 80, aspectRatio: 0.75,
    borderWidth: 2, borderRadius: 6,
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 8,
    position: 'relative',
  },
  pageThumbH: { marginBottom: 0, marginRight: 8, marginVertical: 8, height: 60, width: 48 },
  pageThumbNum: { fontSize: 13, fontWeight: '900' },
  pageThumbDel: {
    position: 'absolute', top: -6, right: -6,
    width: 20, height: 20, borderRadius: 10,
    backgroundColor: '#fff', borderWidth: 1, borderColor: '#fecaca',
    alignItems: 'center', justifyContent: 'center',
  },
});

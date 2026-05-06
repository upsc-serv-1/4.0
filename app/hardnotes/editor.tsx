/**
 * /hardnotes/editor — Unified Hardnotes editor with three lenses:
 *
 *   🔍 Glance — bullet cards, inline edit, inline highlight, checklist toggle
 *   📖 Focus  — parchment serif reader (Zen)
 *   ✏️ Ink   — bullet cards + per-bullet Skia overlays for pen / highlighter / eraser
 *
 * Routing params:
 *   noteId    string  required  — the user_notes.id to load
 *   title     string  optional  — suggestion for header title
 *   lens      string  optional  — start in this lens ('glance' | 'focus' | 'ink')
 *   baseLayer JSON    optional  — { markdown, source } pushed from quiz capture
 */
import React, { useEffect, useMemo, useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView, TextInput,
  ActivityIndicator, KeyboardAvoidingView, Platform, useWindowDimensions, Alert,
} from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
} from 'react-native-reanimated';
import { router, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  ChevronLeft, MoreVertical, Plus, Heading1, ListChecks, Save, FileDown,
  Sparkles, BookOpen, AlertCircle,
} from 'lucide-react-native';
import { useTheme } from '../../src/context/ThemeContext';
import { useHardnoteDoc, Point } from '../../src/components/hardnotes/useHardnoteDoc';
import { LensSwitcher, Lens } from '../../src/components/hardnotes/LensSwitcher';
import { InkToolbar } from '../../src/components/hardnotes/InkToolbar';
import { InkBulletCard } from '../../src/components/hardnotes/InkBulletCard';
import { ToolKind } from '../../src/components/hardnotes/strokes';
import { UnifiedExportSheet } from '../../src/components/export/UnifiedExportSheet';
import type { ExportPayload, ExportNoteBlock } from '../../src/lib/unifiedExportEngine';

export default function HardnoteEditor() {
  const { colors } = useTheme();
  const params = useLocalSearchParams<{
    noteId?: string; title?: string; lens?: string; baseLayer?: string;
  }>();
  const noteId = Array.isArray(params.noteId) ? params.noteId[0] : params.noteId;
  const headerTitle = Array.isArray(params.title) ? params.title[0] : params.title;
  const requestedLens = (Array.isArray(params.lens) ? params.lens[0] : params.lens) as Lens | undefined;
  const baseLayerRaw = Array.isArray(params.baseLayer) ? params.baseLayer[0] : params.baseLayer;

  const { width: winW } = useWindowDimensions();

  const doc = useHardnoteDoc(noteId);
  const [lens, setLens] = useState<Lens>(requestedLens || 'glance');
  const contentWidth = lens === 'focus'
    ? Math.max(320, winW - 48)
    : Math.min(winW - 32, 740);

  // Ink toolbar state
  const [inkTool, setInkTool] = useState<ToolKind>('pen');
  const [inkColor, setInkColor] = useState<string>('#0f172a');
  const [inkWidth, setInkWidth] = useState<number>(2);
  const [textModeActive, setTextModeActive] = useState(false);

  const toolbarX = useSharedValue(0);
  const toolbarY = useSharedValue(0);
  const toolbarStartX = useSharedValue(0);
  const toolbarStartY = useSharedValue(0);

  const toolbarDragGesture = useMemo(
    () => Gesture.Pan()
      .onBegin(() => {
        toolbarStartX.value = toolbarX.value;
        toolbarStartY.value = toolbarY.value;
      })
      .onUpdate((e) => {
        toolbarX.value = toolbarStartX.value + e.translationX;
        toolbarY.value = toolbarStartY.value + e.translationY;
      }),
    [toolbarStartX, toolbarStartY, toolbarX, toolbarY],
  );

  const toolbarAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: toolbarX.value }, { translateY: toolbarY.value }],
  }));

  const [exportOpen, setExportOpen] = useState(false);
  const [includeHighlights, setIncludeHighlights] = useState(true);

  useEffect(() => {
    if (lens !== 'ink' && textModeActive) {
      setTextModeActive(false);
    }
  }, [lens, textModeActive]);

  // If launched from quiz capture with a baseLayer payload AND the note is empty,
  // seed it as a locked reference so the user immediately sees their context.
  useEffect(() => {
    if (doc.loading) return;
    if (!baseLayerRaw) return;
    if (doc.points.length > 0) return;
    try {
      const parsed = JSON.parse(baseLayerRaw);
      const md = parsed?.markdown || parsed?.text;
      if (!md) return;
      doc.insertPoint(null, {
        text: String(md),
        locked: true,
        source: parsed?.source || 'quiz_explanation',
      });
    } catch {
      // ignore
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [doc.loading]);

  const exportPayload: ExportPayload = useMemo(() => {
    const blocks: ExportNoteBlock[] = [];
    blocks.push({ id: `nb-${noteId || 'this'}`, type: 'microTopicHeading', text: doc.title || 'Hardnote' });
    doc.points.forEach((p, idx) => {
      if (p.type === 'heading') {
        blocks.push({ id: p.id, type: 'microTopicHeading', text: p.text || `Heading ${idx + 1}` });
      } else {
        const shouldHighlight = includeHighlights && !!p.color;
        blocks.push({
          id: p.id,
          type: shouldHighlight ? 'highlight' : 'point',
          text: p.text,
          color: shouldHighlight ? p.color : undefined,
          sourceLabel: p.source,
        });
      }
    });
    return { kind: 'notes', blocks };
  }, [doc.points, doc.title, includeHighlights, noteId]);

  if (!noteId) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }} edges={['top']}>
        <View style={styles.center}>
          <AlertCircle size={36} color={colors.textTertiary} />
          <Text style={{ color: colors.textPrimary, fontWeight: '900', marginTop: 12 }}>Missing note id</Text>
        </View>
      </SafeAreaView>
    );
  }

  const insertHeading = () => {
    const id = doc.insertPoint(null, { type: 'heading', text: '' });
    setLens('glance');
    return id;
  };
  const insertChecklist = () => {
    doc.insertPoint(null, { type: 'checklist', text: '' });
    setLens('glance');
  };
  const insertPoint = () => {
    doc.insertPoint(null, { type: 'point', text: '' });
    setLens('glance');
  };

  const lensBg = lens === 'focus' ? '#fdf6e3' : colors.bg;

  const handleBack = async () => {
    await doc.flushSave();
    router.back();
  };

  const openExportSheet = () => {
    Alert.alert(
      'Export Hardnote',
      'Include color highlights?',
      [
        {
          text: 'Yes, with highlights',
          onPress: () => {
            setIncludeHighlights(true);
            setExportOpen(true);
          },
        },
        {
          text: 'Clean (no highlights)',
          onPress: () => {
            setIncludeHighlights(false);
            setExportOpen(true);
          },
        },
        { text: 'Cancel', style: 'cancel' },
      ],
    );
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: lensBg }} edges={['top']} data-testid="hn-editor-root">
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior="height"
        keyboardVerticalOffset={Platform.OS === 'ios' ? 88 : 0}
      >
        {/* Header */}
        <View style={[styles.header, { borderBottomColor: colors.border, backgroundColor: lensBg }]}>
          <TouchableOpacity onPress={handleBack} style={styles.iconBtn} data-testid="hn-editor-back">
            <ChevronLeft size={24} color={colors.textPrimary} />
          </TouchableOpacity>
          <View style={{ flex: 1, paddingHorizontal: 4 }}>
            <Text style={[styles.eyebrow, { color: colors.primary }]}>HARDNOTE</Text>
            <TextInput
              value={doc.title}
              onChangeText={doc.setTitle}
              placeholder={headerTitle || 'Untitled note'}
              placeholderTextColor={colors.textTertiary}
              style={[
                styles.titleInput,
                {
                  color: lens === 'focus' ? '#3f2d16' : colors.textPrimary,
                  fontFamily: lens === 'focus' ? (Platform.OS === 'ios' ? 'Georgia' : 'serif') : undefined,
                },
              ]}
              data-testid="hn-editor-title"
            />
          </View>
          {doc.saving && (
            <View style={styles.saveDot} data-testid="hn-editor-saving">
              <ActivityIndicator size="small" color={colors.primary} />
            </View>
          )}
          <TouchableOpacity onPress={openExportSheet} style={styles.iconBtn} data-testid="hn-editor-export">
            <FileDown size={20} color={colors.textPrimary} />
          </TouchableOpacity>
        </View>

        {/* Lens switcher */}
        <View style={[styles.lensRow, { backgroundColor: lensBg }]}>
          <LensSwitcher value={lens} onChange={setLens} />
          <View style={{ flex: 1 }} />
          {lens === 'glance' && (
            <View style={styles.glanceQuickAdd}>
              <QuickAdd icon={<Heading1 size={13} color={colors.textSecondary} />} label="H" onPress={insertHeading} testID="hn-add-heading" />
              <QuickAdd icon={<ListChecks size={13} color={colors.textSecondary} />} label="✓" onPress={insertChecklist} testID="hn-add-checklist" />
              <QuickAdd icon={<Plus size={13} color={colors.textSecondary} />} label="•" onPress={insertPoint} testID="hn-add-point" />
            </View>
          )}
        </View>

        {/* Content */}
        {doc.loading ? (
          <View style={styles.center}>
            <ActivityIndicator color={colors.primary} />
          </View>
        ) : (
          <ScrollView
            style={{ flex: 1 }}
            contentContainerStyle={[
              { paddingBottom: lens === 'ink' ? 140 : 80 },
              lens === 'focus' && { width: '100%', paddingTop: 12, paddingHorizontal: 24 },
            ]}
            keyboardDismissMode="interactive"
            automaticallyAdjustKeyboardInsets
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            {/* Focus mode meta */}
            {lens === 'focus' && (
              <View style={styles.focusMeta}>
                <Sparkles size={11} color="#a16207" />
                <Text style={styles.focusMetaText}>
                  Focus mode · {doc.points.length} point{doc.points.length === 1 ? '' : 's'}
                </Text>
              </View>
            )}

            {doc.points.length === 0 ? (
              <View style={styles.emptyState}>
                <BookOpen size={48} color={colors.border} />
                <Text style={[styles.emptyTitle, { color: colors.textPrimary }]}>This note is empty</Text>
                <Text style={[styles.emptySub, { color: colors.textTertiary }]}>
                  Tap the buttons above to add a heading, point, or checklist.
                </Text>
              </View>
            ) : (
              doc.points.map((p) => (
                <InkBulletCard
                  key={p.id}
                  point={p}
                  lens={lens}
                  contentWidth={contentWidth}
                  inkTool={inkTool}
                  inkColor={inkColor}
                  inkWidth={inkWidth}
                  onUpdate={(patch) => doc.updatePoint(p.id, patch)}
                  onAddStroke={(s) => doc.addStroke(p.id, s)}
                  onRemoveStrokes={(ids) => doc.removeStrokes(p.id, ids)}
                  onDelete={() =>
                    Alert.alert(
                      'Delete this point?',
                      'This removes the text and any pencil annotations on it.',
                      [
                        { text: 'Cancel', style: 'cancel' },
                        { text: 'Delete', style: 'destructive', onPress: () => doc.removePoint(p.id) },
                      ]
                    )
                  }
                  onToggleLock={() => doc.toggleLock(p.id)}
                  onAddBelow={() => doc.insertPoint(p.id, { type: 'point', text: '' })}
                  textModeActive={lens === 'ink' && textModeActive}
                />
              ))
            )}
          </ScrollView>
        )}

        {/* Floating ink toolbar */}
        {lens === 'ink' && (
          <GestureDetector gesture={toolbarDragGesture}>
            <Animated.View style={[styles.inkDock, toolbarAnimatedStyle]} pointerEvents="box-none">
              <InkToolbar
                tool={inkTool}
                color={inkColor}
                width={inkWidth}
                onToolChange={setInkTool}
                onColorChange={setInkColor}
                onWidthChange={setInkWidth}
                onUndo={doc.undoStroke}
                canUndo={doc.canUndoStroke}
                onTextMode={() => setTextModeActive((prev) => !prev)}
                isTextMode={textModeActive}
              />
            </Animated.View>
          </GestureDetector>
        )}
      </KeyboardAvoidingView>

      <UnifiedExportSheet
        visible={exportOpen}
        onClose={() => setExportOpen(false)}
        payload={exportPayload}
        title={doc.title || 'Hardnote'}
        initialOptions={{
          title: doc.title || 'Hardnote',
          moduleName: 'Hardnotes',
          theme: 'modern',
          paperStyle: 'plain',
          fontFamily: 'sans',
          fontSize: 6,
          showTOC: false,
          headerText: 'Dr. UPSC · Hardnotes',
          footerText: doc.title || 'Hardnote',
        }}
        hideSections={['content', 'answer', 'sort', 'filters']}
      />
    </SafeAreaView>
  );
}

function QuickAdd({ icon, label, onPress, testID }: any) {
  const { colors } = useTheme();
  return (
    <TouchableOpacity
      onPress={onPress}
      data-testid={testID}
      style={[styles.quickAdd, { backgroundColor: colors.surface, borderColor: colors.border }]}
    >
      {icon}
      <Text style={[styles.quickAddText, { color: colors.textSecondary }]}>{label}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: 4,
  },
  iconBtn: { width: 38, height: 38, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  eyebrow: { fontSize: 9, fontWeight: '900', letterSpacing: 1.4, marginBottom: 1 },
  titleInput: { fontSize: 20, fontWeight: '900', letterSpacing: -0.4, padding: 0 },
  saveDot: { width: 30, height: 30, alignItems: 'center', justifyContent: 'center' },

  lensRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 8,
  },
  glanceQuickAdd: { flexDirection: 'row', gap: 6 },
  quickAdd: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    height: 30,
    borderRadius: 9,
    borderWidth: 1,
  },
  quickAddText: { fontSize: 11, fontWeight: '800' },

  inkDock: {
    position: 'absolute',
    bottom: 26,
    left: 0, right: 0,
    alignItems: 'center',
  },

  focusMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 16,
    paddingVertical: 6,
  },
  focusMetaText: { fontSize: 10, fontWeight: '900', letterSpacing: 0.8, color: '#a16207', textTransform: 'uppercase' },

  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },
  emptyState: { alignItems: 'center', paddingVertical: 80, paddingHorizontal: 32 },
  emptyTitle: { fontSize: 18, fontWeight: '900', marginTop: 16 },
  emptySub: { fontSize: 13, fontWeight: '600', marginTop: 6, textAlign: 'center', lineHeight: 19 },
});

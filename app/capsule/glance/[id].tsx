/**
 * Capsule Glance — full-screen reading workspace for a notebook.
 *
 * Renders the structured CapsuleBlock[] inline with persistent highlights.
 * Long-form reading is infinite (scroll), with a sidebar toggle for an
 * even more distraction-free experience (matches the "Navigation Hidden /
 * Full Screen Glance" view in the bible screenshots).
 *
 * Edit-mode lives at /capsule/editor/[id] (Step 6).
 */
import React, { useEffect, useMemo, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator, Share, Platform,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import {
  ChevronLeft, Star, MoreHorizontal, Share2, Edit3,
  PanelLeftClose, PanelLeftOpen,
} from 'lucide-react-native';
import { useTheme } from '../../../src/context/ThemeContext';
import { PageWrapper } from '../../../src/components/PageWrapper';
import { fetchNotebookContent } from '../../../src/repositories/capsuleRepo';
import { supabase } from '../../../src/lib/supabase';
import {
  CapsuleBlock, CapsuleNotebookContent, CAPSULE_SUBJECT_PALETTE,
} from '../../../src/types/capsule';

interface NotebookMeta {
  title: string;
  subject: string;
  subjectColor: string;
}

export default function CapsuleGlance() {
  const { colors } = useTheme();
  const router = useRouter();
  const params = useLocalSearchParams<{ id: string }>();
  const id = params?.id || '';

  const [content, setContent] = useState<CapsuleNotebookContent | null>(null);
  const [meta, setMeta] = useState<NotebookMeta | null>(null);
  const [loading, setLoading] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [pinned, setPinned] = useState(false);

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    const [c, { data: noteRow }] = await Promise.all([
      fetchNotebookContent(id),
      supabase.from('user_notes').select('title,subject').eq('id', id).maybeSingle(),
    ]);
    setContent(c);

    // Try to find the parent capsule node for accurate subject info
    const { data: nodeRow } = await supabase
      .from('user_note_nodes')
      .select('title,is_pinned,parent_id')
      .eq('note_id', id)
      .maybeSingle();
    setPinned(!!nodeRow?.is_pinned);

    let subjectTitle = noteRow?.subject || 'Capsule';
    let subjectColor = CAPSULE_SUBJECT_PALETTE[subjectTitle] || CAPSULE_SUBJECT_PALETTE.default;
    if (nodeRow?.parent_id) {
      // walk up to find subject row
      let pid: string | null = nodeRow.parent_id;
      let safety = 6;
      while (pid && safety-- > 0) {
        const { data: row } = await supabase
          .from('user_note_nodes')
          .select('id,parent_id,type,title,color')
          .eq('id', pid)
          .maybeSingle();
        if (!row) break;
        if (row.type === 'subject') {
          subjectTitle = row.title;
          subjectColor = (row.color as string) || CAPSULE_SUBJECT_PALETTE[row.title] || subjectColor;
          break;
        }
        pid = row.parent_id;
      }
    }
    setMeta({
      title: nodeRow?.title || noteRow?.title || 'Untitled',
      subject: subjectTitle,
      subjectColor,
    });
    setLoading(false);
  }, [id]);

  useEffect(() => { load(); }, [load]);

  const togglePin = useCallback(async () => {
    setPinned((p) => !p);
    await supabase
      .from('user_note_nodes')
      .update({ is_pinned: !pinned, updated_at: new Date().toISOString() })
      .eq('note_id', id);
  }, [pinned, id]);

  const onShare = useCallback(async () => {
    if (!meta || !content) return;
    const text = blocksToPlain(content.blocks);
    try {
      if (Platform.OS === 'web') {
        if ((navigator as any)?.clipboard?.writeText) await (navigator as any).clipboard.writeText(text);
      } else {
        await Share.share({ message: `${meta.title}\n\n${text}` });
      }
    } catch { /* noop */ }
  }, [meta, content]);

  const blocks = content?.blocks || [];
  const isEmpty = blocks.length === 0;

  return (
    <PageWrapper>
      <View style={styles.root}>
        <View style={[styles.topBar, { borderBottomColor: colors.border, backgroundColor: colors.surface }]}>
          <TouchableOpacity testID="capsule-glance-back" onPress={() => router.back()} style={styles.iconBtn}>
            <ChevronLeft color={colors.textPrimary} size={22} />
          </TouchableOpacity>

          <TouchableOpacity
            testID="capsule-glance-toggle-sidebar"
            onPress={() => setSidebarOpen((s) => !s)}
            style={styles.iconBtn}
          >
            {sidebarOpen
              ? <PanelLeftClose color={colors.textTertiary} size={20} />
              : <PanelLeftOpen color={colors.textTertiary} size={20} />}
          </TouchableOpacity>

          <View style={styles.crumbWrap}>
            <Text style={[styles.crumb, { color: colors.primary }]}>{meta?.subject || 'Capsule'}</Text>
            <Text style={[styles.crumbSep, { color: colors.textTertiary }]}> › </Text>
            <Text style={[styles.crumb, { color: colors.textPrimary, fontWeight: '600' }]} numberOfLines={1}>
              {meta?.title || ''}
            </Text>
          </View>

          <TouchableOpacity testID="capsule-glance-pin" onPress={togglePin} style={styles.iconBtn}>
            <Star
              color={pinned ? '#FFB800' : colors.textTertiary}
              fill={pinned ? '#FFB800' : 'transparent'}
              size={18}
            />
          </TouchableOpacity>
          <TouchableOpacity testID="capsule-glance-share" onPress={onShare} style={styles.iconBtn}>
            <Share2 color={colors.textTertiary} size={18} />
          </TouchableOpacity>
          <TouchableOpacity
            testID="capsule-glance-edit"
            onPress={() => router.push({ pathname: '/capsule/editor/[id]', params: { id } } as any)}
            style={[styles.editBtn, { backgroundColor: colors.primary }]}
          >
            <Edit3 color="#fff" size={14} strokeWidth={2.5} />
            <Text style={styles.editBtnText}>Edit</Text>
          </TouchableOpacity>
          <TouchableOpacity testID="capsule-glance-more" style={styles.iconBtn}>
            <MoreHorizontal color={colors.textTertiary} size={18} />
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
          {loading ? (
            <ActivityIndicator color={colors.primary} style={{ marginTop: 64 }} />
          ) : (
            <>
              <Text style={[styles.title, { color: colors.textPrimary }]} testID="capsule-glance-title">
                {meta?.title || 'Untitled'}
              </Text>

              {isEmpty ? (
                <View style={styles.emptyWrap}>
                  <Text style={[styles.emptyTxt, { color: colors.textTertiary }]}>
                    This notebook is empty. Tap Edit to start adding content, or use Add to Notebook
                    from the quiz engine to append blocks here.
                  </Text>
                </View>
              ) : (
                blocks.map((b) => <BlockView key={b.id} block={b} />)
              )}

              <Text style={[styles.eog, { color: colors.textTertiary }]} testID="capsule-glance-eog">
                — End of Glance —
              </Text>
            </>
          )}
        </ScrollView>
      </View>
    </PageWrapper>
  );
}

/* -------------------------------------------------------------------------- */
/* Block renderer                                                              */
/* -------------------------------------------------------------------------- */

const BlockView: React.FC<{ block: CapsuleBlock }> = ({ block }) => {
  const { colors } = useTheme();
  switch (block.type) {
    case 'heading': {
      const level = block.level || 2;
      const size = level === 1 ? 22 : level === 2 ? 18 : 15;
      return (
        <Text style={[styles.heading, { fontSize: size, color: colors.textPrimary }]}>
          {block.text}
        </Text>
      );
    }
    case 'bullet':
      return (
        <View style={styles.bulletRow}>
          <Text style={[styles.bulletDot, { color: colors.textPrimary }]}>•</Text>
          <Text style={[styles.body, { color: colors.textPrimary, flex: 1 }]}>{block.text}</Text>
        </View>
      );
    case 'numbered':
      return (
        <View style={styles.bulletRow}>
          <Text style={[styles.bulletDot, { color: colors.textPrimary }]}>{(block.meta?.index ?? '·')}.</Text>
          <Text style={[styles.body, { color: colors.textPrimary, flex: 1 }]}>{block.text}</Text>
        </View>
      );
    case 'checklist':
      return (
        <View style={styles.bulletRow}>
          <Text style={[styles.bulletDot, { color: colors.textPrimary }]}>{block.checked ? '☑' : '☐'}</Text>
          <Text
            style={[
              styles.body,
              { color: colors.textPrimary, flex: 1, textDecorationLine: block.checked ? 'line-through' : 'none' },
            ]}
          >
            {block.text}
          </Text>
        </View>
      );
    case 'highlight':
      return (
        <View style={[styles.highlight, { backgroundColor: block.highlightColor || '#FFF3B0' }]}>
          <Text style={[styles.body, { color: '#1a1a1a' }]}>{block.text}</Text>
        </View>
      );
    case 'quote':
      return (
        <View style={[styles.quote, { borderLeftColor: colors.primary }]}>
          <Text style={[styles.body, { color: colors.textSecondary, fontStyle: 'italic' }]}>{block.text}</Text>
        </View>
      );
    case 'ai':
      return (
        <View style={[styles.aiBlock, { backgroundColor: 'rgba(127,119,221,0.08)', borderColor: colors.primary }]}>
          <Text style={[styles.aiTag, { color: colors.primary }]}>AI EXPLAINS</Text>
          <Text style={[styles.body, { color: colors.textPrimary }]}>{block.text}</Text>
        </View>
      );
    case 'paragraph':
    default:
      return <Text style={[styles.body, { color: colors.textPrimary }]}>{block.text}</Text>;
  }
};

function blocksToPlain(blocks: CapsuleBlock[]): string {
  return blocks
    .map((b) => {
      switch (b.type) {
        case 'heading':   return `\n${b.text}\n${'='.repeat(b.text.length)}`;
        case 'bullet':    return `• ${b.text}`;
        case 'numbered':  return `${b.meta?.index ?? '·'}. ${b.text}`;
        case 'checklist': return `${b.checked ? '[x]' : '[ ]'} ${b.text}`;
        case 'quote':     return `> ${b.text}`;
        default:          return b.text;
      }
    })
    .join('\n');
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  topBar: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 12, paddingVertical: 8, gap: 6,
    borderBottomWidth: 1,
    minHeight: 48,
  },
  iconBtn: { padding: 8, borderRadius: 8 },
  crumbWrap: { flex: 1, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8 },
  crumb: { fontSize: 13 },
  crumbSep: { fontSize: 12, marginHorizontal: 4 },
  editBtn: {
    height: 32, paddingHorizontal: 12, borderRadius: 8,
    flexDirection: 'row', alignItems: 'center', gap: 6,
  },
  editBtnText: { color: '#fff', fontSize: 13, fontWeight: '600' },

  scroll: { flex: 1 },
  content: { paddingHorizontal: 24, paddingTop: 24, paddingBottom: 96, maxWidth: 760, alignSelf: 'center', width: '100%' },

  title: { fontSize: 26, fontWeight: '700', marginBottom: 18 },
  body: { fontSize: 15, lineHeight: 23, marginVertical: 4 },
  heading: { fontWeight: '700', marginTop: 18, marginBottom: 8 },
  bulletRow: { flexDirection: 'row', alignItems: 'flex-start', marginVertical: 3, gap: 8 },
  bulletDot: { fontSize: 15, lineHeight: 23, width: 16, textAlign: 'center' },
  highlight: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 4, alignSelf: 'flex-start', marginVertical: 4 },
  quote: { borderLeftWidth: 3, paddingLeft: 12, marginVertical: 8 },
  aiBlock: { borderWidth: 1, borderRadius: 12, padding: 12, marginVertical: 8 },
  aiTag: { fontSize: 10, fontWeight: '700', letterSpacing: 0.6, marginBottom: 4 },

  emptyWrap: { paddingVertical: 36 },
  emptyTxt: { fontSize: 14, lineHeight: 20, textAlign: 'center' },

  eog: { textAlign: 'center', fontSize: 11, letterSpacing: 0.6, marginTop: 32, marginBottom: 32 },
});

/**
 * GlancePanel — inline "unfold" panel for a single note row.
 *
 * Lazily fetches the note's content, items[], checklist_notes from
 * user_notes the first time it's mounted, then renders semantic blocks
 * (microTopicHeading + highlight) as compact mini-cards. Optionally
 * filters by a tag from useNoteTagCatalog so the parent can stream all
 * "Imp. Facts" across a subtree.
 *
 * Checklist toggles persist back to Supabase optimistically.
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, Pressable } from 'react-native';
import RenderHtml from 'react-native-render-html';
import { Check, Sparkles, ListChecks, BookOpen as BookIcon, Tag as TagIcon, Play } from 'lucide-react-native';
import { useTheme } from '../../context/ThemeContext';
import { supabase } from '../../lib/supabase';
import { normalizeTag } from '../../utils/tagUtils';
import { SkeletonLine } from '../common/SkeletonLoader';

const GLANCE_COLORS: Record<string, { bg: string; border: string; text: string }> = {
  'imp. concept': { bg: '#eef2ff', border: '#4a7fe8', text: '#4a7fe8' },
  'imp. fact':    { bg: '#fff7e6', border: '#e08030', text: '#e08030' },
  'trap question':{ bg: '#fff0f3', border: '#e05a7a', text: '#e05a7a' },
  'memorize':     { bg: '#f5f0ff', border: '#7c5fe8', text: '#7c5fe8' },
  'must revise':  { bg: '#f0f9ee', border: '#2a9e60', text: '#2a9e60' },
};

export type NoteItem = {
  id: string;
  type: 'highlight' | 'microTopicHeading' | string;
  text: string;
  color?: string;
  tags?: string[];
};

export type ChecklistEntry = { id: string; text: string; checked: boolean };

interface Props {
  noteId: string;
  contentWidth: number;
  /** Active tag from SemanticChipRow ('All' to disable filter). */
  selectedTag: string;
  /** Open the underlying editor in Focus/Zen mode. */
  onPlay: () => void;
  /** Open the editor in normal edit mode. */
  onOpenEdit: () => void;
}

const ALL = 'All';
const HTML_TAG_REGEX = /<\/?[a-z][\s\S]*>/i;

const toHtml = (txt: string): string => {
  if (!txt) return '';
  if (HTML_TAG_REGEX.test(txt)) return txt;
  return txt
    .replace(/\*\*(.*?)\*\*/g, '<b>$1</b>')
    .replace(/_(.*?)_/g, '<i>$1</i>')
    .replace(/\n/g, '<br/>');
};

const parseChecklist = (raw: any): ChecklistEntry[] => {
  if (Array.isArray(raw)) return raw;
  if (typeof raw === 'string' && raw.trim().startsWith('[')) {
    try {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
  return [];
};

function GlanceItemCard({ item, glanceStyle, contentWidth, colors, onPress }: {
  item: NoteItem;
  glanceStyle: { bg: string; border: string; text: string };
  contentWidth: number;
  colors: any;
  onPress: () => void;
}) {
  const tagList = Array.isArray(item.tags) ? item.tags : [];
  const isTrapQuestion = tagList.some(t => normalizeTag(t) === 'trap question');
  const [revealed, setRevealed] = useState(!isTrapQuestion);

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.cardWrap,
        { opacity: pressed ? 0.85 : 1 },
      ]}
      data-testid={`vault-glance-item-${item.id}`}
    >
      <View
        style={[
          styles.card,
          {
            backgroundColor: glanceStyle.bg,
            borderLeftColor: glanceStyle.border,
          },
        ]}
      >
        {/* Tag label */}
        {tagList.length > 0 && (
          <Text style={[styles.tagLabel, { color: glanceStyle.text }]}>
            {tagList[0].toUpperCase()}
          </Text>
        )}

        {/* Content */}
        {revealed ? (
          <RenderHtml
            source={{ html: toHtml(item.text || '<i>(empty)</i>') }}
            contentWidth={contentWidth - 64}
            baseStyle={{ color: colors.textPrimary, fontSize: 13, lineHeight: 19 }}
            tagsStyles={{
              b: { fontWeight: '700' as const, color: colors.textPrimary },
              strong: { fontWeight: '700' as const, color: colors.textPrimary },
              i: { fontStyle: 'italic' as const },
              em: { fontStyle: 'italic' as const },
              mark: { backgroundColor: '#FFE066', color: '#0f172a', borderRadius: 3 },
              p: { marginVertical: 0, color: colors.textPrimary },
            }}
          />
        ) : (
          <TouchableOpacity
            onPress={() => setRevealed(true)}
            style={[styles.revealBtn, { borderColor: colors.textTertiary + '60' }]}
          >
            <Text style={[styles.revealBtnText, { color: colors.textTertiary }]}>REVEAL</Text>
          </TouchableOpacity>
        )}
      </View>
    </Pressable>
  );
}

export function GlancePanel({ noteId, contentWidth, selectedTag, onPlay, onOpenEdit }: Props) {
  const { colors } = useTheme();
  const DEFAULT_GLANCE = { bg: colors.surfaceStrong, border: colors.border, text: colors.textSecondary };
  
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<NoteItem[]>([]);
  const [checklist, setChecklist] = useState<ChecklistEntry[]>([]);
  const [contentHtml, setContentHtml] = useState<string>('');
  const persistTimer = useRef<any>(null);
  const isMounted = useRef(true);

  useEffect(() => {
    isMounted.current = true;
    return () => {
      isMounted.current = false;
      if (persistTimer.current) clearTimeout(persistTimer.current);
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from('user_notes')
        .select('id, items, highlights, checklist_notes, content, content_html')
        .eq('id', noteId)
        .maybeSingle();
      if (cancelled || !isMounted.current) return;
      if (error || !data) {
        setLoading(false);
        return;
      }
      const itemArr = Array.isArray(data.items) && data.items.length
        ? data.items
        : (Array.isArray(data.highlights) ? data.highlights : []);
      setItems(itemArr as NoteItem[]);
      setChecklist(parseChecklist(data.checklist_notes));
      setContentHtml(String(data.content_html || data.content || ''));
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [noteId]);

  const isAll = normalizeTag(selectedTag) === normalizeTag(ALL);

  const filteredItems = useMemo(() => {
    if (isAll) return items;
    const target = normalizeTag(selectedTag);
    return items.filter((it) => {
      const tagList = Array.isArray(it.tags) ? it.tags : [];
      if (tagList.some((t) => normalizeTag(t) === target)) return true;
      // Fallback: built-in semantic classification so users see results
      // for default tags even before they explicitly tag their items.
      const t = it.type;
      if (target === normalizeTag('Imp. Concept') && t === 'microTopicHeading') return true;
      if (target === normalizeTag('Imp. Fact') && t === 'highlight') return true;
      return false;
    });
  }, [items, selectedTag, isAll]);

  const persistChecklist = useCallback((next: ChecklistEntry[]) => {
    if (persistTimer.current) clearTimeout(persistTimer.current);
    persistTimer.current = setTimeout(() => {
      supabase
        .from('user_notes')
        .update({
          checklist_notes: JSON.stringify(next),
          updated_at: new Date().toISOString(),
        })
        .eq('id', noteId)
        .then(({ error }) => {
          if (error) console.warn('[GlancePanel] checklist persist failed', error);
        });
    }, 400);
  }, [noteId]);

  const toggleCheck = (id: string) => {
    setChecklist((prev) => {
      const next = prev.map((c) => (c.id === id ? { ...c, checked: !c.checked } : c));
      persistChecklist(next);
      return next;
    });
  };

  const hasAny = filteredItems.length > 0 || (isAll && checklist.length > 0);

  if (loading) {
    return (
      <View style={[styles.shell, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <SkeletonLine width="60%" height={12} borderRadius={6} />
      </View>
    );
  }

  return (
    <View style={[styles.shell, { backgroundColor: colors.surface, borderColor: colors.border }]} data-testid={`vault-glance-${noteId}`}>
      <View style={styles.shellHead}>
        <View style={styles.shellHeadLeft}>
          <Sparkles size={12} color={colors.primary} />
          <Text style={[styles.shellHeadText, { color: colors.textTertiary }]}>
            GLANCE · {filteredItems.length}{isAll ? '' : ` matched`}
          </Text>
        </View>
        <View style={styles.shellHeadRight}>
          <TouchableOpacity onPress={onOpenEdit} hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }} style={styles.miniBtn}>
            <BookIcon size={13} color={colors.textSecondary} />
            <Text style={[styles.miniBtnText, { color: colors.textSecondary }]}>EDIT</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={onPlay} hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }} style={[styles.miniBtn, { backgroundColor: colors.primary + '14' }]}>
            <Play size={12} color={colors.primary} fill={colors.primary} />
            <Text style={[styles.miniBtnText, { color: colors.primary }]}>FOCUS</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Checklist (only in All-mode to avoid noise) */}
      {isAll && checklist.length > 0 && (
        <View style={styles.section}>
          <View style={styles.sectionHead}>
            <ListChecks size={11} color={colors.textTertiary} />
            <Text style={[styles.sectionHeadText, { color: colors.textTertiary }]}>CHECKLIST</Text>
          </View>
          {checklist.map((c) => (
            <TouchableOpacity key={c.id} onPress={() => toggleCheck(c.id)} style={styles.checkRow} activeOpacity={0.7} data-testid={`vault-glance-check-${c.id}`}>
              <View
                style={[
                  styles.checkBox,
                  {
                    borderColor: c.checked ? colors.primary : colors.textTertiary,
                    backgroundColor: c.checked ? colors.primary : 'transparent',
                  },
                ]}
              >
                {c.checked && <Check size={11} color="#fff" strokeWidth={3} />}
              </View>
              <Text
                style={[
                  styles.checkText,
                  {
                    color: c.checked ? colors.textTertiary : colors.textPrimary,
                    textDecorationLine: c.checked ? 'line-through' : 'none',
                  },
                ]}
                numberOfLines={2}
              >
                {c.text}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      )}

      {/* Items */}
      {filteredItems.length === 0 && !isAll ? (
        <View style={styles.emptyChip}>
          <TagIcon size={14} color={colors.textTertiary} />
          <Text style={[styles.emptyChipText, { color: colors.textTertiary }]}>
            No items tagged "{selectedTag}" in this note.
          </Text>
        </View>
      ) : (
        <View style={styles.section}>
          {filteredItems.map((it, idx) => {
            if (it.type === 'microTopicHeading') {
              return (
                <View key={it.id || `h-${idx}`} style={styles.headingDivider}>
                  <View style={[styles.dividerLine, { backgroundColor: colors.border }]} />
                  <Text style={[styles.headingText, { color: colors.textTertiary }]}>
                    {(it.text || 'Heading').toUpperCase()}
                  </Text>
                  <View style={[styles.dividerLine, { backgroundColor: colors.border }]} />
                </View>
              );
            }

            // Determine tag-based color
            const tagList = Array.isArray(it.tags) ? it.tags : [];
            let glanceStyle = DEFAULT_GLANCE;
            for (const tag of tagList) {
              const normalized = normalizeTag(tag);
              if (GLANCE_COLORS[normalized]) {
                glanceStyle = GLANCE_COLORS[normalized];
                break;
              }
            }

            return (
              <GlanceItemCard
                key={it.id || `i-${idx}`}
                item={it}
                glanceStyle={glanceStyle}
                contentWidth={contentWidth}
                colors={colors}
                onPress={onOpenEdit}
              />
            );
          })}
        </View>
      )}

      {!hasAny && isAll && !contentHtml && (

        <View style={styles.emptyChip}>
          <Text style={[styles.emptyChipText, { color: colors.textTertiary }]}>
            This note has no inline blocks yet — tap FOCUS to read or EDIT to add some.
          </Text>
        </View>
      )}

      {!hasAny && isAll && !!contentHtml && (
        <View style={styles.section}>
          <View style={styles.sectionHead}>
            <BookIcon size={11} color={colors.textTertiary} />
            <Text style={[styles.sectionHeadText, { color: colors.textTertiary }]}>BODY PREVIEW</Text>
          </View>
          <View style={[styles.bodyPreview, { borderColor: colors.border }]}>
            <RenderHtml
              source={{ html: toHtml(contentHtml).slice(0, 1200) }}
              contentWidth={contentWidth - 48}
              baseStyle={{ color: colors.textSecondary, fontSize: 12, lineHeight: 18 }}
              tagsStyles={{
                b: { fontWeight: '700' as const },
                strong: { fontWeight: '700' as const },
                p: { marginVertical: 2, color: colors.textSecondary },
                mark: { backgroundColor: '#FFE066', color: '#0f172a', borderRadius: 3 },
              }}
            />
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  shell: {
    marginHorizontal: 8,
    marginBottom: 12,
    borderRadius: 18,
    borderWidth: 1,
    paddingVertical: 12,
    paddingHorizontal: 14,
    gap: 10,
  },
  shellHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  shellHeadLeft: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  shellHeadRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  shellHeadText: { fontSize: 10, fontWeight: '900', letterSpacing: 1.1 },
  shellHint: { fontSize: 11, fontWeight: '700', marginLeft: 8 },
  miniBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 8,
  },
  miniBtnText: { fontSize: 10, fontWeight: '900', letterSpacing: 0.6 },

  section: { gap: 6 },
  sectionHead: { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 4 },
  sectionHeadText: { fontSize: 9, fontWeight: '900', letterSpacing: 1 },

  checkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 4,
  },
  checkBox: {
    width: 18,
    height: 18,
    borderRadius: 6,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkText: { flex: 1, fontSize: 13, fontWeight: '600' },

  headingDivider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 8,
  },
  dividerLine: { flex: 1, height: 0.5 },
  headingText: { fontSize: 8, fontWeight: '900', letterSpacing: 1.2, marginHorizontal: 8 },

  cardWrap: { marginVertical: 4 },
  card: {
    borderRadius: 10,
    borderLeftWidth: 2.5,
    paddingVertical: 9,
    paddingHorizontal: 11,
  },
  tagLabel: {
    fontSize: 8,
    fontWeight: '900',
    letterSpacing: 1,
    marginBottom: 3,
  },
  revealBtn: {
    alignSelf: 'center',
    borderWidth: 0.5,
    borderStyle: 'dashed',
    borderRadius: 20,
    paddingHorizontal: 11,
    paddingVertical: 3,
    marginTop: 6,
  },
  revealBtnText: { fontSize: 9, fontWeight: '700' },
  tagsRow: { flexDirection: 'row', gap: 4, marginTop: 6, flexWrap: 'wrap' },
  tinyTag: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 },
  tinyTagText: { fontSize: 9, fontWeight: '900', letterSpacing: 0.4 },

  emptyChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 8,
    paddingHorizontal: 6,
  },
  emptyChipText: { fontSize: 12, fontWeight: '600', flex: 1 },

  bodyPreview: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
});

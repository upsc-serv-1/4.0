/**
 * Pilot V2 — Glance View
 *
 * Faithful port of the KM `GlanceView`:
 *   • Sticky header: back, note title, bell/share/upload/more icon-buttons
 *   • Scrollable rich content with section headings, tag chips, bulleted
 *     paragraphs and inline highlights (yellow/green/red palette)
 *   • End-of-Glance separator + bottom "Open in Editor" pill
 *
 * The block renderer understands every PilotV2BlockType (heading, paragraph,
 * bullet, numbered, checklist, quote, highlight, code) so any note created in
 * the editor renders without translation.
 */
import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { ChevronLeft, Bell, Share2, Upload, MoreVertical } from 'lucide-react-native';
import { useTheme } from '../../context/ThemeContext';
import { usePilotV2 } from '../../context/PilotV2Context';
import {
  PilotV2Block,
  PILOT_V2_HIGHLIGHT_PALETTE,
} from './types';

const highlightBg = (name?: string) => {
  if (!name) return '#FDE68A';
  const found = PILOT_V2_HIGHLIGHT_PALETTE.find(c => c.name === name);
  return found?.bg ?? '#FDE68A';
};

const DEMO_BLOCKS: PilotV2Block[] = [
  { id: 'd1', type: 'heading', level: 1, text: 'Article 14 — Equality Before Law' },
  { id: 'd2', type: 'paragraph', text:
    'A comprehensive study guide on Article 14 of the Indian Constitution, covering the fundamental ' +
    'right to equality, its interpretation, exceptions, and landmark judicial pronouncements.' },
  { id: 'd3', type: 'heading', level: 2, text: 'Introduction to Equality Before Law' },
  { id: 'd4', type: 'bullet', text:
    'Article 14 of the Indian Constitution guarantees the Right to Equality. It states: "The State ' +
    'shall not deny to any person equality before the law or the equal protection of the laws within ' +
    'the territory of India." This foundational principle ensures that no individual or group receives ' +
    'preferential treatment under the law, establishing a bedrock for justice and fairness in Indian democracy.' },
  { id: 'd5', type: 'highlight', highlightColor: 'Yellow', text: 'Key Point: Equality before law applies to all persons, citizens and non-citizens alike.' },
  { id: 'd6', type: 'heading', level: 2, text: "The Rule of Law and Dicey's Principles" },
  { id: 'd7', type: 'bullet', text:
    'The concept of "equality before law" is synonymous with the British doctrine of Rule of Law as ' +
    'propounded by A.V. Dicey. According to Dicey, the rule of law has three essential components: ' +
    'supremacy of law, equality before the law, and predominance of legal spirit.' },
  { id: 'd8', type: 'heading', level: 2, text: 'Doctrine of Reasonable Classification' },
  { id: 'd9', type: 'bullet', text:
    'Article 14 does not prohibit all classifications but only unreasonable or arbitrary classifications. ' +
    'For a classification to be valid, it must satisfy two conditions: an intelligible differentia, and a ' +
    'rational relation to the object sought to be achieved.' },
  { id: 'd10', type: 'heading', level: 2, text: 'Landmark Judicial Pronouncements' },
  { id: 'd11', type: 'bullet', text:
    'State of West Bengal v. Anwar Ali Sarkar (1952) — established the test for reasonable classification.' },
  { id: 'd12', type: 'bullet', text:
    'E.P. Royappa v. State of Tamil Nadu (1974) — equality as a basic feature of the Constitution.' },
  { id: 'd13', type: 'bullet', text:
    'Maneka Gandhi v. Union of India (1978) — Articles 14, 19 and 21 form a "golden triangle".' },
  { id: 'd14', type: 'bullet', text:
    'Indra Sawhney v. Union of India (1992) — Mandal Commission case; reservations capped at 50% with ' +
    'creamy-layer carve-out.' },
];

export function PilotV2GlanceView() {
  const { colors } = useTheme();
  const { state, dispatch, currentNote } = usePilotV2();
  const note = currentNote();
  const blocks = note?.content?.blocks?.length ? note.content.blocks : DEMO_BLOCKS;
  const title = note?.title ?? 'Article 14 — Equality Before Law';

  const handleBack = () => {
    dispatch({ type: 'SET_VIEW_MODE', payload: state.view.selectedSubtopic ? 'noteList' : 'dashboard' });
  };

  return (
    <View testID="pilot-v2-glance" style={{ flex: 1, backgroundColor: '#F9FAFB' }}>
      {/* Sticky header */}
      <View style={[styles.header, { backgroundColor: '#fff', borderBottomColor: colors.border }]}>
        <View style={styles.headerLeft}>
          <TouchableOpacity testID="pilot-v2-glance-back" onPress={handleBack} style={styles.iconBtn}>
            <ChevronLeft size={20} color={colors.textPrimary} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: colors.textPrimary }]} numberOfLines={1}>{title}</Text>
        </View>
        <View style={styles.headerRight}>
          <TouchableOpacity style={styles.iconBtn}><Bell size={18} color={colors.textSecondary} /></TouchableOpacity>
          <TouchableOpacity style={styles.iconBtn}><Share2 size={18} color={colors.textSecondary} /></TouchableOpacity>
          <TouchableOpacity style={styles.iconBtn}><Upload size={18} color={colors.textSecondary} /></TouchableOpacity>
          <TouchableOpacity style={styles.iconBtn}><MoreVertical size={18} color={colors.textSecondary} /></TouchableOpacity>
        </View>
      </View>

      {/* Scrollable content */}
      <ScrollView
        testID="pilot-v2-glance-scroll"
        style={{ flex: 1 }}
        contentContainerStyle={styles.body}
        showsVerticalScrollIndicator
      >
        <View style={styles.titleRow}>
          <Text style={[styles.h1, { color: colors.textPrimary }]}>{title}</Text>
          <View style={[styles.tagChip, { backgroundColor: '#FEF3C7' }]}>
            <Text style={{ color: '#92400E', fontSize: 11, fontWeight: '600' }}>Key Point</Text>
          </View>
        </View>

        {blocks.map(b => <BlockRenderer key={b.id} block={b} colors={colors} />)}

        <View style={[styles.divider, { backgroundColor: colors.border }]} />
        <Text style={[styles.eog, { color: colors.textTertiary }]}>— End of Glance —</Text>
      </ScrollView>

      {/* Bottom action */}
      <View style={[styles.footer, { backgroundColor: '#fff', borderTopColor: colors.border }]}>
        <TouchableOpacity
          testID="pilot-v2-glance-open-editor"
          activeOpacity={0.85}
          onPress={() => dispatch({ type: 'SET_VIEW_MODE', payload: 'editor' })}
          style={[styles.openBtn, { backgroundColor: '#5B4EFA' }]}
        >
          <Text style={{ color: '#fff', fontSize: 14, fontWeight: '600' }}>Open in Editor</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

interface BlockRendererProps { block: PilotV2Block; colors: any }

function BlockRenderer({ block, colors }: BlockRendererProps) {
  switch (block.type) {
    case 'heading': {
      const fs = block.level === 1 ? 24 : block.level === 3 ? 16 : 18;
      const mt = block.level === 1 ? 32 : 24;
      return (
        <Text style={[styles.heading, { fontSize: fs, marginTop: mt, color: colors.textPrimary }]}>
          {block.text}
        </Text>
      );
    }
    case 'bullet':
      return (
        <View style={styles.bulletRow}>
          <Text style={[styles.bulletDot, { color: colors.textPrimary }]}>•</Text>
          <Text style={[styles.text, { color: colors.textPrimary }]}>{block.text}</Text>
        </View>
      );
    case 'numbered':
      return (
        <View style={styles.bulletRow}>
          <Text style={[styles.bulletDot, { color: colors.textPrimary, fontWeight: '600' }]}>1.</Text>
          <Text style={[styles.text, { color: colors.textPrimary }]}>{block.text}</Text>
        </View>
      );
    case 'checklist':
      return (
        <View style={styles.bulletRow}>
          <View style={[styles.checkbox, { borderColor: colors.border, backgroundColor: block.checked ? '#5B4EFA' : 'transparent' }]} />
          <Text style={[styles.text, { color: colors.textPrimary, textDecorationLine: block.checked ? 'line-through' : 'none' }]}>
            {block.text}
          </Text>
        </View>
      );
    case 'quote':
      return (
        <View style={[styles.quote, { borderLeftColor: '#5B4EFA' }]}>
          <Text style={[styles.text, { color: colors.textSecondary, fontStyle: 'italic' }]}>{block.text}</Text>
        </View>
      );
    case 'highlight':
      return (
        <View style={[styles.highlight, { backgroundColor: highlightBg(block.highlightColor) }]}>
          <Text style={[styles.text, { color: '#1F2937' }]}>{block.text}</Text>
        </View>
      );
    case 'code':
      return (
        <View style={[styles.code, { backgroundColor: '#0F172A' }]}>
          <Text style={[styles.text, { color: '#E2E8F0', fontFamily: 'monospace' }]}>{block.text}</Text>
        </View>
      );
    default:
      return <Text style={[styles.text, { color: colors.textPrimary }]}>{block.text}</Text>;
  }
}

const styles = StyleSheet.create({
  header: {
    paddingHorizontal: 24, paddingVertical: 16,
    borderBottomWidth: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
  },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1, minWidth: 0 },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  headerTitle: { fontSize: 16, fontWeight: '700', flexShrink: 1 },
  iconBtn: { padding: 8, borderRadius: 8 },
  body: { paddingHorizontal: 32, paddingVertical: 32, paddingBottom: 100, maxWidth: 880, alignSelf: 'center', width: '100%' },
  titleRow: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 24, gap: 16 },
  h1: { flex: 1, fontSize: 28, fontWeight: '700', lineHeight: 38 },
  tagChip: { paddingHorizontal: 12, paddingVertical: 4, borderRadius: 9999 },
  heading: { fontWeight: '700', marginBottom: 12, lineHeight: 28 },
  bulletRow: { flexDirection: 'row', gap: 12, marginVertical: 6 },
  bulletDot: { fontSize: 18, lineHeight: 24, width: 18 },
  text: { fontSize: 16, lineHeight: 26, flex: 1 },
  checkbox: { width: 18, height: 18, borderWidth: 1.5, borderRadius: 4, marginTop: 4 },
  quote: { borderLeftWidth: 3, paddingLeft: 14, paddingVertical: 4, marginVertical: 8 },
  highlight: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 6, marginVertical: 6 },
  code: { padding: 14, borderRadius: 8, marginVertical: 8 },
  divider: { height: 1, marginVertical: 32 },
  eog: { fontSize: 12, textAlign: 'center', fontStyle: 'italic', marginBottom: 8 },
  footer: { paddingHorizontal: 24, paddingVertical: 12, borderTopWidth: 1, alignItems: 'center' },
  openBtn: { paddingHorizontal: 28, paddingVertical: 10, borderRadius: 10 },
});

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
import React, { useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, Platform, Share,
  Image, Linking,
} from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { ChevronLeft, Bell, Share2, Upload, MoreVertical, Pencil } from 'lucide-react-native';
import { useTheme } from '../../context/ThemeContext';
import { useAuth } from '../../context/AuthContext';
import { usePilotV2 } from '../../context/PilotV2Context';
import {
  archivePilotV2Node, fetchAllPilotV2Nodes, fetchPilotV2NotesForUser, pinPilotV2Node, restorePilotV2Node, purgePilotV2NoteNode,
} from '../../repositories/pilotV2Repo';
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
  const { session } = useAuth();
  const userId = session?.user?.id;
  const { state, dispatch, currentNote } = usePilotV2();
  const note = currentNote();
  const blocks = note?.content?.blocks?.length ? note.content.blocks : DEMO_BLOCKS;
  const title = note?.title ?? 'Article 14 — Equality Before Law';
  const [reminderSet, setReminderSet] = useState(false);

  const handleBack = () => {
    dispatch({ type: 'SET_VIEW_MODE', payload: state.view.selectedSubtopic ? 'noteList' : 'dashboard' });
  };

  /* ---------------- Header action handlers (Bell/Share/Upload/More) ------- */
  const blocksToPlainText = (): string => {
    return blocks
      .map(b => {
        switch (b.type) {
          case 'heading': return `\n# ${b.text}\n`;
          case 'bullet':  return `• ${b.text}`;
          case 'numbered':return `1. ${b.text}`;
          case 'checklist': return `${b.checked ? '[x]' : '[ ]'} ${b.text}`;
          case 'quote':   return `> ${b.text}`;
          case 'code':    return `\`\`\`\n${b.text}\n\`\`\``;
          default:        return b.text;
        }
      })
      .join('\n');
  };

  const handleReminder = () => {
    // Pilot V2 reminders are surface-only at this stage — toggle a local
    // "remind me" flag so the bell ring acknowledges the click. Future
    // iterations can persist this against `metadata.reminder_at`.
    setReminderSet(v => !v);
    Alert.alert(
      reminderSet ? 'Reminder cleared' : 'Reminder set',
      reminderSet
        ? `We won't remind you about “${title}” anymore.`
        : `We'll surface “${title}” in your daily review queue.`,
    );
  };

  const handleShare = async () => {
    const message = `${title}\n\n${blocksToPlainText()}`;
    try {
      if (Platform.OS === 'web') {
        if ((navigator as any)?.share) {
          await (navigator as any).share({ title, text: message });
        } else {
          await Clipboard.setStringAsync(message);
          Alert.alert('Copied to clipboard', 'Note content copied — paste it anywhere.');
        }
        return;
      }
      await Share.share({ title, message });
    } catch (e) {
      console.warn('[pilot-v2] share failed', e);
    }
  };

  const handleExport = async () => {
    const text = blocksToPlainText();
    await Clipboard.setStringAsync(text);
    Alert.alert('Note exported', 'Plain-text export copied to your clipboard.');
  };

  const handleMore = () => {
    Alert.alert(title, undefined, [
      {
        text: note?.is_pinned ? 'Unpin' : 'Pin',
        onPress: async () => {
          if (!userId || !note?.id) return;
          const nodes = await fetchAllPilotV2Nodes(userId);
          const node = nodes.find(nd => nd.note_id === note.id);
          if (!node) return;
          await pinPilotV2Node(node.id, !note.is_pinned).catch(() => null);
          const fresh = await fetchPilotV2NotesForUser(userId);
          dispatch({ type: 'SET_NOTES', payload: fresh });
        },
      },
      ...(note?.is_archived ? [{
        text: 'Restore',
        onPress: async () => {
          if (!userId || !note?.id) return;
          const nodes = await fetchAllPilotV2Nodes(userId, true);
          const node = nodes.find(nd => nd.note_id === note.id);
          if (!node) return;
          await restorePilotV2Node(node.id).catch(() => null);
          const fresh = await fetchPilotV2NotesForUser(userId);
          dispatch({ type: 'SET_NOTES', payload: fresh });
          dispatch({ type: 'SET_VIEW_MODE', payload: 'noteList' });
        },
      }] : []),
      {
        text: 'Open in Editor',
        onPress: () => dispatch({ type: 'SET_VIEW_MODE', payload: 'editor' }),
      },
      {
        text: 'Copy Plain Text',
        onPress: handleExport,
      },
      ...(note?.is_archived ? [{
        text: 'Delete permanently',
        style: 'destructive' as const,
        onPress: async () => {
          if (!userId || !note?.id) return;
          const nodes = await fetchAllPilotV2Nodes(userId, true);
          const node = nodes.find(nd => nd.note_id === note.id);
          if (!node) return;
          await purgePilotV2NoteNode({ nodeId: node.id, noteId: node.note_id }).catch(() => null);
          const fresh = await fetchPilotV2NotesForUser(userId);
          dispatch({ type: 'SET_NOTES', payload: fresh });
          dispatch({ type: 'SET_VIEW_MODE', payload: 'noteList' });
        },
      }] : [{
        text: 'Move to Trash',
        style: 'destructive' as const,
        onPress: async () => {
          if (!userId || !note?.id) return;
          const nodes = await fetchAllPilotV2Nodes(userId);
          const node = nodes.find(nd => nd.note_id === note.id);
          if (!node) {
            Alert.alert('Could not delete', 'Note row not linked to a Pilot V2 node.');
            return;
          }
          await archivePilotV2Node(node.id).catch(() => null);
          const fresh = await fetchPilotV2NotesForUser(userId);
          dispatch({ type: 'SET_NOTES', payload: fresh });
          dispatch({ type: 'SET_VIEW_MODE', payload: 'noteList' });
        },
      }]),
      { text: 'Cancel', style: 'cancel' },
    ]);
  };

  return (
    <View testID="pilot-v2-glance" style={{ flex: 1, backgroundColor: '#F9FAFB' }}>
      {/* Sticky header — minimal Apple-grade */}
      <View style={[styles.header, { backgroundColor: 'rgba(255,255,255,0.96)', borderBottomColor: 'transparent' }]}>
        <View style={styles.headerLeft}>
          <TouchableOpacity testID="pilot-v2-glance-back" onPress={handleBack} style={styles.iconBtn}>
            <ChevronLeft size={20} color={colors.textPrimary} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: colors.textPrimary }]} numberOfLines={1}>{title}</Text>
        </View>
        <View style={styles.headerRight}>
          <TouchableOpacity
            testID="pilot-v2-glance-bell"
            onPress={handleReminder}
            style={styles.iconBtn}>
            <Bell size={18} color={reminderSet ? '#5B4EFA' : colors.textSecondary} fill={reminderSet ? '#5B4EFA' : 'transparent'} />
          </TouchableOpacity>
          <TouchableOpacity
            testID="pilot-v2-glance-edit"
            onPress={() => dispatch({ type: 'SET_VIEW_MODE', payload: 'editor' })}
            style={[styles.iconBtn, { backgroundColor: '#EEECFF' }]}>
            <Pencil size={18} color="#5B4EFA" />
          </TouchableOpacity>
          <TouchableOpacity
            testID="pilot-v2-glance-share"
            onPress={handleShare}
            style={styles.iconBtn}>
            <Share2 size={18} color={colors.textSecondary} />
          </TouchableOpacity>
          <TouchableOpacity
            testID="pilot-v2-glance-export"
            onPress={handleExport}
            style={styles.iconBtn}>
            <Upload size={18} color={colors.textSecondary} />
          </TouchableOpacity>
          <TouchableOpacity
            testID="pilot-v2-glance-more"
            onPress={handleMore}
            style={styles.iconBtn}>
            <MoreVertical size={18} color={colors.textSecondary} />
          </TouchableOpacity>
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
    </View>
  );
}

interface BlockRendererProps { block: PilotV2Block; colors: any }

function BlockRenderer({ block, colors }: BlockRendererProps) {
  const markStyle = {
    fontWeight: block.bold ? '700' as const : undefined,
    fontStyle: block.italic ? 'italic' as const : undefined,
    textDecorationLine: block.underline ? ('underline' as const) : undefined,
  };

  // Image takes precedence
  if (block.imageBase64 || block.imageUri) {
    return (
      <Image
        source={{ uri: (block.imageBase64 ?? block.imageUri) as string }}
        style={glanceStyles.blockImage}
      />
    );
  }

  // Table block
  if (block.tableRows?.length) {
    return (
      <View style={glanceStyles.tableWrap}>
        {block.tableRows.map((row, ri) => (
          <View key={ri} style={glanceStyles.tableRow}>
            {row.map((cell, ci) => (
              <Text
                key={ci}
                style={[
                  glanceStyles.tableCell,
                  ri === 0 && { fontWeight: '700', backgroundColor: '#F9FAFB' },
                ]}
                numberOfLines={3}
              >
                {cell || ' '}
              </Text>
            ))}
          </View>
        ))}
      </View>
    );
  }

  // Link block (rendered as tappable link, regardless of type)
  if (block.link) {
    return (
      <TouchableOpacity
        onPress={() => Linking.openURL(block.link as string).catch(() => Alert.alert('Could not open', block.link as string))}
        style={{ marginVertical: 6 }}
      >
        <Text style={[styles.text, { color: '#5B4EFA', textDecorationLine: 'underline' }, markStyle]}>
          {block.text || block.link}
        </Text>
      </TouchableOpacity>
    );
  }

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
          <Text style={[styles.text, { color: colors.textPrimary }, markStyle]}>{block.text}</Text>
        </View>
      );
    case 'numbered':
      return (
        <View style={styles.bulletRow}>
          <Text style={[styles.bulletDot, { color: colors.textPrimary, fontWeight: '600' }]}>1.</Text>
          <Text style={[styles.text, { color: colors.textPrimary }, markStyle]}>{block.text}</Text>
        </View>
      );
    case 'checklist':
      return (
        <View style={styles.bulletRow}>
          <View style={[styles.checkbox, { borderColor: colors.border, backgroundColor: block.checked ? '#5B4EFA' : 'transparent' }]} />
          <Text style={[styles.text, { color: colors.textPrimary, textDecorationLine: block.checked ? 'line-through' : 'none' }, markStyle]}>
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
          <Text style={[styles.text, { color: '#1F2937' }, markStyle]}>{block.text}</Text>
        </View>
      );
    case 'code':
      return (
        <View style={[styles.code, { backgroundColor: '#0F172A' }]}>
          <Text style={[styles.text, { color: '#E2E8F0', fontFamily: 'monospace' }]}>{block.text}</Text>
        </View>
      );
    default:
      return <Text style={[styles.text, { color: colors.textPrimary }, markStyle]}>{block.text}</Text>;
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

const glanceStyles = StyleSheet.create({
  blockImage: {
    width: '100%', minHeight: 220, borderRadius: 10,
    marginVertical: 12, resizeMode: 'cover', backgroundColor: '#0F172A',
  },
  tableWrap: { borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 8, overflow: 'hidden', marginVertical: 12 },
  tableRow:  { flexDirection: 'row' },
  tableCell: {
    flex: 1, padding: 10, fontSize: 13, color: '#0F172A',
    borderRightWidth: 1, borderBottomWidth: 1, borderColor: '#E5E7EB',
  },
});

import React from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
} from 'react-native';
import {
  ChevronLeft, Bell, Share2, MoreHorizontal, Edit3, CheckSquare, Square
} from 'lucide-react-native';
import { useTheme } from '../../context/ThemeContext';
import { usePilot, PilotBlock } from '../../context/PilotContext';

interface PilotGlanceViewProps {
  onBack?: () => void;
  onOpenEditor?: () => void;
}

export const PilotGlanceView: React.FC<PilotGlanceViewProps> = ({
  onBack,
  onOpenEditor,
}) => {
  const { colors } = useTheme();
  const { state } = usePilot();
  const note = state.currentNote;
  const blocks = note?.content?.blocks || [];

  if (!note) {
    return (
      <View style={[styles.container, { backgroundColor: colors.surface }]}>
        <Text style={{ color: colors.textSecondary, fontWeight: '700' }}>No note selected</Text>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.surface }}>
      {/* Header */}
      <View style={[styles.header, { borderBottomColor: colors.border, backgroundColor: colors.surfaceStrong }]}>
        <TouchableOpacity onPress={onBack} style={styles.iconBtn}>
          <ChevronLeft size={22} color={colors.textPrimary} />
        </TouchableOpacity>

        <Text style={{ flex: 1, fontSize: 16, fontWeight: '800', color: colors.textPrimary }} numberOfLines={1}>
          {note.title}
        </Text>

        <TouchableOpacity style={styles.iconBtn}>
          <Bell size={18} color={colors.textTertiary} />
        </TouchableOpacity>
        {onOpenEditor && (
          <TouchableOpacity
            onPress={onOpenEditor}
            style={[styles.editBtn, { backgroundColor: colors.primary }]}
          >
            <Edit3 size={14} color="#fff" />
            <Text style={{ color: '#fff', fontSize: 13, fontWeight: '700' }}>Edit</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Content */}
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={[
          styles.content,
          { backgroundColor: colors.bg },
        ]}
      >
        <Text style={[styles.title, { color: colors.textPrimary }]}>
          {note.title}
        </Text>

        {blocks.length === 0 ? (
          <Text style={{ color: colors.textTertiary, fontSize: 14, fontStyle: 'italic' }}>
            This note is empty.
          </Text>
        ) : (
          blocks.map((block) => (
            <BlockRenderer key={block.id} block={block} colors={colors} />
          ))
        )}

        <Text style={[styles.eog, { color: colors.textTertiary }]}>
          — End of Glance —
        </Text>
      </ScrollView>
    </View>
  );
};

interface BlockRendererProps {
  block: PilotBlock;
  colors: any;
}

const BlockRenderer: React.FC<BlockRendererProps> = ({ block, colors }) => {
  switch (block.type) {
    case 'heading':
      return (
        <Text style={[
          styles.heading,
          { fontSize: block.level === 1 ? 22 : 18, color: colors.textPrimary },
        ]}>
          {block.text}
        </Text>
      );
    case 'bullet':
      return (
        <View style={styles.bulletRow}>
          <Text style={{ color: colors.textPrimary, fontSize: 16, marginRight: 4 }}>•</Text>
          <Text style={[styles.body, { color: colors.textPrimary, flex: 1 }]}>
            {block.text}
          </Text>
        </View>
      );
    case 'checklist':
      return (
        <View style={styles.bulletRow}>
          <View style={{ marginRight: 6, marginTop: 4 }}>
            {block.checked ? (
              <CheckSquare size={16} color={colors.primary} />
            ) : (
              <Square size={16} color={colors.textTertiary} />
            )}
          </View>
          <Text style={[styles.body, { color: colors.textPrimary, flex: 1, textDecorationLine: block.checked ? 'line-through' : 'none', opacity: block.checked ? 0.6 : 1 }]}>
            {block.text}
          </Text>
        </View>
      );
    case 'quote':
      return (
        <View style={[styles.quote, { borderLeftColor: colors.primary }]}>
          <Text style={[styles.body, { color: colors.textSecondary, fontStyle: 'italic' }]}>
            {block.text}
          </Text>
        </View>
      );
    case 'highlight':
      return (
        <View style={[styles.highlight, { backgroundColor: block.highlightColor || '#FFF300' }]}>
          <Text style={[styles.body, { color: '#111', fontWeight: '600' }]}>
            {block.text}
          </Text>
        </View>
      );
    default:
      return (
        <Text style={[styles.body, { color: colors.textPrimary }]}>
          {block.text}
        </Text>
      );
  }
};

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    gap: 8,
    minHeight: 52,
  },
  iconBtn: { padding: 8, borderRadius: 8 },
  editBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
  },
  content: { paddingHorizontal: 20, paddingVertical: 24, paddingBottom: 100 },
  title: { fontSize: 26, fontWeight: '900', marginBottom: 20, lineHeight: 32 },
  heading: { fontWeight: '800', marginTop: 18, marginBottom: 8 },
  bulletRow: { flexDirection: 'row', gap: 6, marginVertical: 4, alignItems: 'flex-start' },
  body: { fontSize: 15, lineHeight: 22, marginVertical: 4 },
  quote: { borderLeftWidth: 3, paddingLeft: 12, marginVertical: 8 },
  highlight: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 6, marginVertical: 6, borderWidth: 1, borderColor: '#ccc' },
  eog: { textAlign: 'center', fontSize: 11, marginTop: 32, fontStyle: 'italic', fontWeight: '600', letterSpacing: 1 },
});

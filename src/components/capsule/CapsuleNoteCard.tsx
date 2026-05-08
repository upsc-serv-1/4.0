/**
 * Capsule note/notebook card — used in Continue Studying / Pinned / Recent
 * sections. Mirrors the bible spec exactly:
 *   - subject-coloured icon chip (top)
 *   - title (14px / 600)
 *   - subject subtitle (12px / 400)
 *   - timestamp (11px) OR pages count
 *   - optional ⭐ star top-right
 */
import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Star, FileText, BookOpen, ClipboardList, Folder } from 'lucide-react-native';
import { useTheme } from '../../context/ThemeContext';
import { CAPSULE_SUBJECT_PALETTE } from '../../types/capsule';

interface Props {
  title: string;
  subject?: string | null;
  subtitle?: string;
  pinned?: boolean;
  pagesCount?: number;
  iconKey?: 'note' | 'notebook' | 'checklist' | 'folder';
  color?: string | null;
  onPress?: () => void;
  onTogglePin?: () => void;
  testID?: string;
}

export const CapsuleNoteCard: React.FC<Props> = ({
  title, subject, subtitle, pinned, pagesCount, iconKey = 'note', color, onPress, onTogglePin, testID,
}) => {
  const { colors } = useTheme();
  const tint = color || (subject && CAPSULE_SUBJECT_PALETTE[subject]) || CAPSULE_SUBJECT_PALETTE.default;

  const Icon = ICONS[iconKey] || FileText;

  return (
    <TouchableOpacity
      testID={testID}
      activeOpacity={0.85}
      onPress={onPress}
      style={[styles.card, { backgroundColor: colors.surfaceStrong, borderColor: colors.border }]}
    >
      <View style={[styles.iconBox, { backgroundColor: tint }]}>
        <Icon color="#fff" size={18} strokeWidth={2.2} />
      </View>

      {pinned !== undefined && (
        <TouchableOpacity
          testID={testID ? `${testID}-pin` : undefined}
          onPress={onTogglePin}
          hitSlop={8}
          style={styles.starBtn}
        >
          <Star
            color={pinned ? '#FFB800' : colors.textTertiary}
            fill={pinned ? '#FFB800' : 'transparent'}
            size={16}
          />
        </TouchableOpacity>
      )}

      <View style={styles.text}>
        <Text style={[styles.title, { color: colors.textPrimary }]} numberOfLines={2}>
          {title}
        </Text>
        <Text style={[styles.subject, { color: colors.textTertiary }]} numberOfLines={1}>
          {subject || ' '}{pagesCount ? ` • ${pagesCount} ${pagesCount === 1 ? 'page' : 'pages'}` : ''}
        </Text>
        {subtitle ? (
          <Text style={[styles.timestamp, { color: colors.textTertiary }]} numberOfLines={1}>
            {subtitle}
          </Text>
        ) : null}
      </View>
    </TouchableOpacity>
  );
};

const ICONS: Record<NonNullable<Props['iconKey']>, any> = {
  note: FileText,
  notebook: BookOpen,
  checklist: ClipboardList,
  folder: Folder,
};

const styles = StyleSheet.create({
  card: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    minHeight: 120,
    flex: 1,
    justifyContent: 'space-between',
  },
  iconBox: {
    width: 36, height: 36, borderRadius: 8, alignItems: 'center', justifyContent: 'center',
  },
  starBtn: {
    position: 'absolute', top: 8, right: 8, padding: 4,
  },
  text: { marginTop: 12 },
  title: { fontSize: 14, fontWeight: '600' },
  subject: { fontSize: 12, marginTop: 4 },
  timestamp: { fontSize: 11, marginTop: 4 },
});

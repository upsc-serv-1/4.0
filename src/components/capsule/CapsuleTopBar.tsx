/**
 * Capsule top bar — search + grid toggle + +New CTA matching the bible.
 */
import React from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Platform } from 'react-native';
import { Search as SearchIcon, LayoutGrid, List as ListIcon, Plus, Menu, Bell, ChevronLeft } from 'lucide-react-native';
import { useTheme } from '../../context/ThemeContext';

interface Props {
  title: string;
  searchValue: string;
  onSearchChange: (v: string) => void;
  searchPlaceholder?: string;
  onNew: () => void;
  newLabel?: string;
  layout?: 'grid' | 'list';
  onToggleLayout?: () => void;
  onMenuPress?: () => void;
  onBack?: () => void;
  showSidebarToggle?: boolean;
}

export const CapsuleTopBar: React.FC<Props> = ({
  title, searchValue, onSearchChange, searchPlaceholder = 'Search notes, topics, keywords...',
  onNew, newLabel = '+ New', layout = 'grid', onToggleLayout, onMenuPress, onBack, showSidebarToggle,
}) => {
  const { colors } = useTheme();
  return (
    <View style={[styles.wrap, { backgroundColor: colors.surface, borderBottomColor: colors.border }]} testID="capsule-topbar">
      <View style={styles.row}>
        {onBack ? (
          <TouchableOpacity testID="capsule-topbar-back" onPress={onBack} style={styles.iconBtn}>
            <ChevronLeft color={colors.textPrimary} size={22} />
          </TouchableOpacity>
        ) : showSidebarToggle ? (
          <TouchableOpacity testID="capsule-topbar-menu" onPress={onMenuPress} style={styles.iconBtn}>
            <Menu color={colors.textTertiary} size={22} />
          </TouchableOpacity>
        ) : null}

        <Text style={[styles.title, { color: colors.textPrimary }]} numberOfLines={1}>{title}</Text>

        <View style={{ flex: 1 }} />

        <TouchableOpacity style={styles.iconBtn} accessibilityLabel="Notifications">
          <Bell color={colors.textTertiary} size={20} />
        </TouchableOpacity>
      </View>

      <View style={[styles.searchRow]}>
        <View style={[styles.searchBox, { backgroundColor: colors.surfaceStrong, borderColor: colors.border }]}>
          <SearchIcon color={colors.textTertiary} size={16} />
          <TextInput
            testID="capsule-search-input"
            value={searchValue}
            onChangeText={onSearchChange}
            placeholder={searchPlaceholder}
            placeholderTextColor={colors.textTertiary}
            style={[styles.searchInput, { color: colors.textPrimary }]}
            returnKeyType="search"
          />
        </View>

        {onToggleLayout && (
          <TouchableOpacity testID="capsule-layout-toggle" onPress={onToggleLayout} style={styles.iconBtn}>
            {layout === 'grid'
              ? <ListIcon color={colors.textTertiary} size={20} />
              : <LayoutGrid color={colors.textTertiary} size={20} />}
          </TouchableOpacity>
        )}

        <TouchableOpacity
          testID="capsule-new-btn"
          onPress={onNew}
          activeOpacity={0.85}
          style={[styles.newBtn, { backgroundColor: colors.primary }]}
        >
          <Plus color="#fff" size={16} strokeWidth={2.5} />
          <Text style={styles.newBtnText}>{newLabel.replace(/^\+\s*/, '')}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  wrap: { borderBottomWidth: 1, paddingHorizontal: 16, paddingTop: 8, paddingBottom: 12 },
  row: { flexDirection: 'row', alignItems: 'center', height: 48, gap: 4 },
  iconBtn: { padding: 8, borderRadius: 8 },
  title: { fontSize: 18, fontWeight: '700' },
  searchRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4 },
  searchBox: {
    flex: 1, height: 40, borderRadius: 10, borderWidth: 1, paddingHorizontal: 12,
    flexDirection: 'row', alignItems: 'center', gap: 8,
  },
  searchInput: {
    flex: 1, fontSize: 14, padding: 0,
    ...(Platform.OS === 'web' ? { outlineStyle: 'none' as any } : null),
  },
  newBtn: {
    height: 40, paddingHorizontal: 14, borderRadius: 10, flexDirection: 'row',
    alignItems: 'center', gap: 6,
  },
  newBtnText: { color: '#fff', fontSize: 14, fontWeight: '600' },
});

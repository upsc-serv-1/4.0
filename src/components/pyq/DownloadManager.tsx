/**
 * DownloadManager — Sticky semi-modal drawer (NOT closed by outside-tap).
 *
 * • Tap outside ⇒ loses focus only (drawer stays).
 * • ❌ Close button explicitly removes drawer (history is preserved).
 * • ⬇️ Minimize collapses to a floating chip you can re-open.
 * • Renders progress + history + Open/Share actions.
 *
 * Pair with `DownloadManagerProvider`. Use `useDownloadManager()` from anywhere to
 * enqueue `start()` / `update()` / `complete()` / `fail()`.
 */
import React from 'react';
import { ActivityIndicator, Modal, Pressable, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import * as Sharing from 'expo-sharing';
import { CheckCircle2, ChevronDown, Download, FileText, Folder, Minus, Trash2, X } from 'lucide-react-native';
import { useTheme } from '../../context/ThemeContext';
import { DLItem, useDownloadManager } from '../../context/DownloadManagerContext';

const STATUS_COLORS: Record<DLItem['status'], string> = {
  preparing: '#f59e0b',
  downloading: '#2563eb',
  completed: '#10b981',
  failed: '#ef4444',
};

const Row: React.FC<{ item: DLItem; onRemove: () => void }> = ({ item, onRemove }) => {
  const { colors } = useTheme();
  const dot = STATUS_COLORS[item.status];

  const openFile = async () => {
    if (!item.uri) return;
    try {
      if (await Sharing.isAvailableAsync()) {
        // Fire-and-forget share with generous timeout for large PDFs
        const shareWithTimeout = Promise.race([
          Sharing.shareAsync(item.uri, { mimeType: item.mime || 'application/pdf' }),
          new Promise<void>((resolve) => setTimeout(resolve, 20000)), // 20 second timeout
        ]);
        shareWithTimeout.catch(() => {
          console.warn('[DownloadManager] Share operation timed out or was dismissed (non-fatal)');
        });
      }
    } catch (e) {
      console.error('[DownloadManager] Share error:', e);
    }
  };

  return (
    <View style={[styles.row, { borderColor: colors.border }]}> 
      <View style={[styles.statusDot, { backgroundColor: dot }]} />
      <FileText size={18} color={colors.textSecondary} />
      <View style={{ flex: 1, marginLeft: 8 }}>
        <Text style={[styles.label, { color: colors.textPrimary }]} numberOfLines={1}>{item.label}</Text>
        <Text style={[styles.sub, { color: colors.textTertiary }]}>
          {item.status === 'preparing' && 'Preparing your export…'}
          {item.status === 'downloading' && `Downloading… ${Math.round(item.progress * 100)}%`}
          {item.status === 'completed' && 'Ready · Tap to open or share'}
          {item.status === 'failed' && (item.error || 'Failed')}
        </Text>
        {item.status === 'downloading' && (
          <View style={[styles.progressTrack, { backgroundColor: colors.border }]}> 
            <View style={[styles.progressFill, { width: `${Math.max(2, item.progress * 100)}%`, backgroundColor: dot }]} />
          </View>
        )}
      </View>

      {item.status === 'completed' && (
        <TouchableOpacity testID={`dl-open-${item.id}`} onPress={openFile} style={[styles.iconBtn, { backgroundColor: colors.surfaceStrong }]}>
          <Folder size={16} color={colors.primary} />
        </TouchableOpacity>
      )}
      {(item.status === 'preparing' || item.status === 'downloading') && (
        <ActivityIndicator size="small" color={dot} />
      )}
      {item.status === 'completed' && <CheckCircle2 size={18} color={dot} />}

      <TouchableOpacity testID={`dl-remove-${item.id}`} onPress={onRemove} style={[styles.iconBtn, { backgroundColor: colors.surfaceStrong, marginLeft: 6 }]}>
        <Trash2 size={14} color={colors.textTertiary} />
      </TouchableOpacity>
    </View>
  );
};

export const DownloadManager: React.FC = () => {
  const { colors } = useTheme();
  const dl = useDownloadManager();

  if (!dl.visible || dl.items.length === 0) {
    // minimized chip
    if (dl.minimized && dl.items.length > 0) {
      return (
        <TouchableOpacity
          testID="dl-restore-chip"
          onPress={dl.restore}
          style={[styles.miniChip, { backgroundColor: colors.primary }]}
        >
          <Download size={14} color="#fff" />
          <Text style={styles.miniText}>{dl.items.filter(i => i.status !== 'completed').length || dl.items.length} files</Text>
        </TouchableOpacity>
      );
    }
    return null;
  }

  return (
    <Modal transparent visible={dl.visible && !dl.minimized} animationType="slide" onRequestClose={dl.minimize}>
      {/* Outer pressable does NOT close. It only blurs the focus. */}
      <Pressable style={styles.overlay} onPress={() => { /* lose focus only */ }}>
        <Pressable style={[styles.sheet, { backgroundColor: colors.surface, borderColor: colors.border }]} onPress={(e) => e.stopPropagation()}>
          <View style={styles.header}>
            <Text style={[styles.title, { color: colors.textPrimary }]}>Downloads</Text>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <TouchableOpacity testID="dl-minimize" onPress={dl.minimize} style={[styles.headerBtn, { backgroundColor: colors.surfaceStrong, borderColor: colors.border }]}>
                <Minus size={16} color={colors.textSecondary} />
              </TouchableOpacity>
              <TouchableOpacity testID="dl-close" onPress={dl.close} style={[styles.headerBtn, { backgroundColor: colors.surfaceStrong, borderColor: colors.border }]}>
                <X size={16} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>
          </View>

          <ScrollView style={{ maxHeight: 380 }} contentContainerStyle={{ paddingBottom: 12 }}>
            {dl.items.map((it) => (
              <Row key={it.id} item={it} onRemove={() => dl.remove(it.id)} />
            ))}
          </ScrollView>

          <View style={styles.footer}>
            <TouchableOpacity testID="dl-clear-all" onPress={dl.clearAll}>
              <Text style={[styles.clearText, { color: colors.textTertiary }]}>Clear history</Text>
            </TouchableOpacity>
            <TouchableOpacity testID="dl-collapse" onPress={dl.minimize} style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
              <ChevronDown size={14} color={colors.textTertiary} />
              <Text style={[styles.clearText, { color: colors.textTertiary }]}>Minimize</Text>
            </TouchableOpacity>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.35)', justifyContent: 'flex-end' },
  sheet: { borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 16, borderTopWidth: 1, borderLeftWidth: 1, borderRightWidth: 1 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  title: { fontSize: 18, fontWeight: '900' },
  headerBtn: { width: 36, height: 36, borderRadius: 10, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, paddingHorizontal: 8, borderRadius: 12, borderWidth: 1, marginBottom: 8 },
  statusDot: { width: 8, height: 8, borderRadius: 4, marginRight: 10 },
  label: { fontWeight: '800', fontSize: 14 },
  sub: { fontSize: 11, fontWeight: '600', marginTop: 2 },
  iconBtn: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  progressTrack: { height: 4, borderRadius: 2, marginTop: 6, overflow: 'hidden' },
  progressFill: { height: 4, borderRadius: 2 },
  footer: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingTop: 8 },
  clearText: { fontSize: 12, fontWeight: '700', letterSpacing: 0.4, textTransform: 'uppercase' },
  miniChip: { position: 'absolute', right: 16, bottom: 90, flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 8, paddingHorizontal: 12, borderRadius: 24, elevation: 4, shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 6, shadowOffset: { width: 0, height: 2 } },
  miniText: { color: '#fff', fontWeight: '800', fontSize: 12 },
});

export default DownloadManager;

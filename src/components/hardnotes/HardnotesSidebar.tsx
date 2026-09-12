/**
 * HardnotesSidebar — left pane of the Hardnotes hub.
 * Collapsible tree built from user_note_nodes. Emits (nodeId | null) to parent
 * when the user taps a folder (or the Home root).
 */
import React, { useMemo, useRef, useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet, TextInput, Alert } from 'react-native';
import { ChevronRight, ChevronDown, Folder, FolderOpen, Home, Plus, Search } from 'lucide-react-native';
import { useTheme } from '../../context/ThemeContext';
import { HardNode, HardnotesService, isFolder } from '../../services/HardnotesService';

interface Props {
  userId: string;
  nodes: HardNode[];
  selectedFolderId: string | null;
  onSelectFolder: (folderId: string | null) => void;
  onNodesChanged: () => void;
  width: number;
}

export function HardnotesSidebar({ userId, nodes, selectedFolderId, onSelectFolder, onNodesChanged, width }: Props) {
  const { colors } = useTheme();
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [query, setQuery] = useState('');
  const [creating, setCreating] = useState<{ parentId: string | null } | null>(null);
  const [newName, setNewName] = useState('');
  const committingRef = useRef(false);

  const tree = useMemo(() => HardnotesService.buildTree(nodes), [nodes]);

  const matchQuery = (title: string) => !query.trim() || title.toLowerCase().includes(query.trim().toLowerCase());

  const toggle = (id: string) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const commitNewFolder = async () => {
    if (committingRef.current) return;
    committingRef.current = true;

    const title = newName.trim();
    const parentId = creating?.parentId ?? null;

    setCreating(null);
    setNewName('');

    if (!title) {
      committingRef.current = false;
      return;
    }

    try {
      await HardnotesService.createFolder(userId, title, parentId);
      onNodesChanged();
    } catch (e: any) {
      Alert.alert('Could not create folder', e?.message || '');
    } finally {
      committingRef.current = false;
    }
  };

  const renderFolder = (n: HardNode, depth: number) => {
    if (!isFolder(n)) return null;
    const kids = (tree.get(n.id) || []).filter((k) => isFolder(k));
    const isOpen = expanded.has(n.id);
    const isSelected = selectedFolderId === n.id;
    const showSelf = matchQuery(n.title);

    // If query doesn't match this folder but matches a descendant, still render it open.
    const descendantMatches =
      query.trim().length > 0 && nodes.some((m) => m.parent_id && ancestorIncludes(nodes, m.id, n.id) && matchQuery(m.title));
    const visible = showSelf || descendantMatches;
    if (!visible) return null;

    return (
      <View key={n.id} style={styles.treeNodeWrap}>
        {depth > 0 && (
          <View
            pointerEvents="none"
            style={[
              styles.treeVertical,
              {
                left: 12 + (depth - 1) * 16 + 7,
                backgroundColor: colors.border,
              },
            ]}
          />
        )}
        {depth > 0 && (
          <View
            pointerEvents="none"
            style={[
              styles.treeHorizontal,
              {
                left: 12 + (depth - 1) * 16 + 7,
                backgroundColor: colors.border,
              },
            ]}
          />
        )}

        <TouchableOpacity
          activeOpacity={0.7}
          onPress={() => {
            onSelectFolder(n.id);
            if (kids.length > 0) toggle(n.id);
          }}
          onLongPress={() => {
            setCreating({ parentId: n.id });
            setExpanded((prev) => new Set(prev).add(n.id));
          }}
          delayLongPress={350}
          style={[
            styles.row,
            { paddingLeft: 12 + depth * 16 },
            isSelected && { backgroundColor: colors.primary + '18', borderLeftColor: colors.primary },
            !isSelected && { borderLeftColor: 'transparent' },
          ]}
          data-testid={`hn-sidebar-folder-${n.id}`}
        >
          <View style={styles.chev}>
            {kids.length > 0 ? (
              isOpen ? (
                <ChevronDown size={14} color={colors.textTertiary} />
              ) : (
                <ChevronRight size={14} color={colors.textTertiary} />
              )
            ) : (
              <View style={{ width: 14 }} />
            )}
          </View>
          {isOpen ? (
            <FolderOpen size={16} color={isSelected ? colors.primary : '#f59e0b'} />
          ) : (
            <Folder size={16} color={isSelected ? colors.primary : '#f59e0b'} />
          )}
          <Text
            numberOfLines={1}
            style={[
              styles.rowLabel,
              { color: isSelected ? colors.primary : colors.textPrimary, fontWeight: isSelected ? '900' : '700' },
            ]}
          >
            {n.title}
          </Text>
        </TouchableOpacity>

        {isOpen && kids.map((k) => renderFolder(k, depth + 1))}
        {isOpen && creating?.parentId === n.id && (
          <View style={[styles.newFolderRow, { paddingLeft: 12 + (depth + 1) * 16 }] }>
            <TextInput
              value={newName}
              onChangeText={setNewName}
              placeholder="Folder name"
              placeholderTextColor={colors.textTertiary}
              autoFocus
              onSubmitEditing={() => {
                void commitNewFolder();
              }}
              onBlur={() => {
                setTimeout(() => {
                  void commitNewFolder();
                }, 150);
              }}
              style={[styles.newFolderInput, { color: colors.textPrimary, borderColor: colors.border }]}
              data-testid="hn-sidebar-new-folder-input"
            />
          </View>
        )}
      </View>
    );
  };

  const rootFolders = (tree.get(null) || []).filter((n) => isFolder(n));

  return (
    <View style={[styles.container, { width, backgroundColor: colors.surface, borderRightColor: colors.border }]}> 
      <View style={styles.header}>
        <Text style={[styles.brand, { color: colors.textPrimary }]}>Hardnotes</Text>
        <Text style={[styles.brandSub, { color: colors.textTertiary }]}>UPSC Study Library</Text>
      </View>

      <View style={[styles.searchBox, { backgroundColor: colors.bg, borderColor: colors.border }]}> 
        <Search size={14} color={colors.textTertiary} />
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="Search folders…"
          placeholderTextColor={colors.textTertiary}
          style={[styles.searchInput, { color: colors.textPrimary }]}
          data-testid="hn-sidebar-search"
        />
      </View>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingVertical: 8 }} showsVerticalScrollIndicator={false}>
        <TouchableOpacity
          onPress={() => onSelectFolder(null)}
          style={[
            styles.row,
            { paddingLeft: 12 },
            selectedFolderId === null && { backgroundColor: colors.primary + '18', borderLeftColor: colors.primary },
            selectedFolderId !== null && { borderLeftColor: 'transparent' },
          ]}
          data-testid="hn-sidebar-home-root"
        >
          <View style={styles.chev}><View style={{ width: 14 }} /></View>
          <Home size={16} color={selectedFolderId === null ? colors.primary : colors.textSecondary} />
          <Text
            style={[
              styles.rowLabel,
              { color: selectedFolderId === null ? colors.primary : colors.textPrimary, fontWeight: selectedFolderId === null ? '900' : '700' },
            ]}
          >
            All Notes
          </Text>
        </TouchableOpacity>

        {rootFolders.map((n) => renderFolder(n, 0))}

        {creating?.parentId === null && (
          <View style={[styles.newFolderRow, { paddingLeft: 24 }]}> 
            <TextInput
              value={newName}
              onChangeText={setNewName}
              placeholder="Folder name"
              placeholderTextColor={colors.textTertiary}
              autoFocus
              onSubmitEditing={() => {
                void commitNewFolder();
              }}
              onBlur={() => {
                setTimeout(() => {
                  void commitNewFolder();
                }, 150);
              }}
              style={[styles.newFolderInput, { color: colors.textPrimary, borderColor: colors.border }]}
              data-testid="hn-sidebar-new-root-input"
            />
          </View>
        )}
      </ScrollView>

      <TouchableOpacity
        onPress={() => setCreating({ parentId: selectedFolderId })}
        style={[styles.addFolderBtn, { borderTopColor: colors.border, backgroundColor: colors.surface }]}
        data-testid="hn-sidebar-add-folder"
      >
        <Plus size={14} color={colors.primary} />
        <Text style={{ color: colors.primary, fontSize: 12, fontWeight: '800', letterSpacing: 0.4 }}>
          New Folder {selectedFolderId ? 'Here' : 'at Root'}
        </Text>
      </TouchableOpacity>
    </View>
  );
}

// Helper — check if `targetId` has `ancestorId` as any ancestor.
function ancestorIncludes(nodes: HardNode[], targetId: string, ancestorId: string): boolean {
  const byId = new Map(nodes.map((n) => [n.id, n]));
  let cursor = byId.get(targetId);
  while (cursor?.parent_id) {
    if (cursor.parent_id === ancestorId) return true;
    cursor = byId.get(cursor.parent_id);
  }
  return false;
}

const styles = StyleSheet.create({
  container: { height: '100%', borderRightWidth: 1 },
  header: { paddingHorizontal: 20, paddingTop: 20, paddingBottom: 12 },
  brand: { fontSize: 22, fontWeight: '900', letterSpacing: -0.5 },
  brandSub: { fontSize: 10, fontWeight: '800', letterSpacing: 1.2, marginTop: 2, textTransform: 'uppercase' },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginHorizontal: 16,
    marginBottom: 8,
    paddingHorizontal: 12,
    height: 38,
    borderRadius: 12,
    borderWidth: 1,
  },
  searchInput: { flex: 1, fontSize: 13, fontWeight: '600' },
  treeNodeWrap: { position: 'relative' },
  treeVertical: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: 1,
  },
  treeHorizontal: {
    position: 'absolute',
    top: '50%',
    width: 9,
    height: 1,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 9,
    paddingRight: 12,
    borderLeftWidth: 3,
  },
  chev: { width: 14, alignItems: 'center' },
  rowLabel: { fontSize: 13, flex: 1 },
  newFolderRow: { paddingRight: 12, paddingVertical: 6 },
  newFolderInput: { height: 32, borderWidth: 1, borderRadius: 8, paddingHorizontal: 10, fontSize: 13 },
  addFolderBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 14,
    borderTopWidth: 1,
  },
});

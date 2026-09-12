/**
 * PilotV2HierarchyPicker
 * 
 * A premium flashcard-style hierarchical directory picker component.
 * Extracted and enhanced from PilotV2SaveSheet to handle:
 * 1. "save" mode (targeting notebooks for flashcard appending)
 * 2. "move" mode (picking destination folders for moving Topics, Subtopics, and Notes)
 */
import React, { useState, useMemo, useEffect } from 'react';
import {
  Modal, View, Text, TouchableOpacity, ScrollView, TextInput,
  ActivityIndicator, Alert, StyleSheet
} from 'react-native';
import { X, Plus, Folder, FileText, CheckCircle2, ChevronRight, ChevronDown } from 'lucide-react-native';
import { PilotV2Node } from './types';
import { createPilotV2Node } from '../../repositories/pilotV2Repo';

export interface PilotV2HierarchyPickerProps {
  visible: boolean;
  allNodes: PilotV2Node[];
  userId: string;
  colors: any;
  onClose: () => void;
  onRefresh?: () => void;

  // Modes
  mode?: 'save' | 'move';
  
  // SAVE MODE SPECIFIC
  currentSubject?: string;
  currentTopic?: string;
  currentSubtopic?: string;
  currentNotebook?: string;
  onSelectSaveTarget?: (subject: string, topic: string, subtopic: string, notebook: string) => void;

  // MOVE MODE SPECIFIC
  sourceNode?: {
    id: string;
    type: 'topic' | 'subtopic' | 'note';
    label: string;
    currentParentLabel?: string;
  } | null;
  onConfirmMove?: (targetNodeId: string) => Promise<void>;
}

export const PilotV2HierarchyPicker: React.FC<PilotV2HierarchyPickerProps> = ({
  visible, allNodes, userId, colors, onClose, onRefresh,
  mode = 'save',
  currentSubject, currentTopic, currentSubtopic, currentNotebook, onSelectSaveTarget,
  sourceNode, onConfirmMove
}) => {
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [createTarget, setCreateTarget] = useState<{ parentId: string | null; label: string } | null>(null);
  const [newName, setNewName] = useState('');
  const [creating, setCreating] = useState(false);
  const [moving, setMoving] = useState(false);

  // Resolve the actual database ID of the source node to EXCLUDE it from being picked
  const physicalSourceNodeId = useMemo(() => {
    if (mode !== 'move' || !sourceNode) return null;
    const match = allNodes.find(n => {
      if (sourceNode.type === 'note') return n.note_id === sourceNode.id;
      return n.title.toLowerCase() === sourceNode.label.toLowerCase() && n.type === sourceNode.type;
    });
    return match?.id || null;
  }, [mode, sourceNode, allNodes]);

  // Validation helper to determine if a node type can be picked as destination
  const canSelectNode = (type: string, nodeId: string) => {
    if (mode === 'save') {
      return type === 'note';
    }
    if (mode === 'move' && sourceNode) {
      // Prevent selecting self!
      if (nodeId === physicalSourceNodeId) return false;

      // Topic target -> Subject
      if (sourceNode.type === 'topic') return type === 'subject';
      // Subtopic target -> Topic
      if (sourceNode.type === 'subtopic') return type === 'topic';
      // Note target -> Topic or Subtopic
      if (sourceNode.type === 'note') return type === 'topic' || type === 'subtopic';
    }
    return false;
  };

  // Build tree: find subject/topic/subtopic/note nodes and nest them
  // Deduplicate at every level by title
  const visibleNodes = useMemo(() => {
    const seen = new Set<string>();
    const childrenMap = new Map<string, PilotV2Node[]>();
    const roots: PilotV2Node[] = [];

    // Sort and iterate
    allNodes.forEach(n => {
      // Exclude source node if we are moving a directory to avoid cyclic dependencies
      if (mode === 'move' && physicalSourceNodeId && n.id === physicalSourceNodeId) {
        return; 
      }
      if (!n.parent_id) {
        if (!seen.has(`root:${n.title}`)) {
          seen.add(`root:${n.title}`);
          roots.push(n);
        }
      } else {
        const key = `${n.parent_id}:${n.title}`;
        if (!seen.has(key)) {
          seen.add(key);
          if (!childrenMap.has(n.parent_id)) childrenMap.set(n.parent_id, []);
          childrenMap.get(n.parent_id)!.push(n);
        }
      }
    });

    // Flatten with expansion state
    const result: (PilotV2Node & { depth: number; hasKids: boolean })[] = [];
    const walk = (nodes: PilotV2Node[], depth: number) => {
      nodes.sort((a, b) => a.title.localeCompare(b.title)).forEach(node => {
        const kids = childrenMap.get(node.id) || [];
        const hasKids = kids.length > 0;
        result.push({ ...node, depth, hasKids });
        if (expanded.has(node.id) && hasKids) {
          walk(kids, depth + 1);
        }
      });
    };
    walk(roots, 0);
    return result;
  }, [allNodes, expanded, mode, physicalSourceNodeId]);

  // Highlight current notebook in save mode upon initialization
  useEffect(() => {
    if (visible && mode === 'save' && currentNotebook) {
      const nbNode = allNodes.find(n => n.type === 'note' && n.title === currentNotebook);
      if (nbNode) setSelectedId(nbNode.id);
    } else if (visible && mode === 'move') {
      setSelectedId(null); // Clear previous move selections
    }
  }, [visible, mode, currentNotebook, allNodes]);

  const toggle = (id: string) => {
    setExpanded(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const handleSelect = (node: PilotV2Node & { depth: number }) => {
    const selectable = canSelectNode(node.type, node.id);

    if (selectable) {
      if (mode === 'save') {
        // Walk up hierarchy for save paths
        const byId = new Map(allNodes.map(n => [n.id, n]));
        let cur: PilotV2Node | undefined = node;
        let nb = node.title;
        let sub = '';
        let top = '';
        let subj = '';
        while (cur) {
          if (cur.type === 'subtopic') sub = cur.title;
          else if (cur.type === 'topic') top = cur.title;
          else if (cur.type === 'subject') subj = cur.title;
          cur = cur.parent_id ? byId.get(cur.parent_id) : undefined;
        }
        onSelectSaveTarget?.(subj, top, sub, nb);
        onClose();
      } else {
        // Move mode: Highlight for footer confirmation
        setSelectedId(node.id);
      }
    } else {
      // Clicking a non-selectable parent node toggles expansion
      toggle(node.id);
    }
  };

  const handleMoveCommit = async () => {
    if (!selectedId || !onConfirmMove) return;
    setMoving(true);
    try {
      await onConfirmMove(selectedId);
    } finally {
      setMoving(false);
    }
  };

  const renderIcon = (type: string) => {
    switch (type) {
      case 'subject': return <Folder size={20} color="#8B5CF6" />;
      case 'topic': return <Folder size={20} color="#3B82F6" />;
      case 'subtopic': return <Folder size={20} color="#10B981" />;
      case 'note': return <FileText size={20} color="#10B981" />;
      default: return <FileText size={20} color={colors.textTertiary} />;
    }
  };

  const handleCreateItem = async () => {
    if (!createTarget || !newName.trim()) return;
    setCreating(true);
    try {
      const parentNode = createTarget.parentId ? allNodes.find(n => n.id === createTarget.parentId) : null;
      const type: 'subject' | 'topic' | 'subtopic' | 'note' =
        !parentNode ? 'subject' :
        parentNode.type === 'subject' ? 'topic' :
        parentNode.type === 'topic' ? 'subtopic' :
        'note';
      
      const created = await createPilotV2Node({
        userId,
        type,
        title: newName.trim(),
        parentId: createTarget.parentId,
      });
      if (created) {
        if (createTarget.parentId) toggle(createTarget.parentId);
        setNewName(''); setCreateTarget(null);
        onRefresh?.();
      }
    } catch (e) {
      Alert.alert('Error', 'Could not create item.');
    } finally {
      setCreating(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end', alignItems: 'center', paddingBottom: 20 }}>
        <View style={{ borderRadius: 40, padding: 20, paddingBottom: 30, width: '94%', maxWidth: 500, height: '80%', overflow: 'hidden', backgroundColor: colors.surface }}>
          
          {/* Header */}
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
            <View style={{ width: 40 }} />
            <View style={{ alignItems: 'center' }}>
              <Text style={{ fontSize: 18, fontWeight: '900', color: colors.textPrimary }}>
                {mode === 'move' ? `Move ${sourceNode?.type || 'Item'}` : 'Choose Notebook'}
              </Text>
              {mode === 'move' && sourceNode && (
                <Text style={{ fontSize: 12, color: colors.textTertiary, marginTop: 2 }} numberOfLines={1}>
                  "{sourceNode.label}"
                </Text>
              )}
            </View>
            <TouchableOpacity onPress={onClose} style={{ width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.border + '40' }}>
              <X size={20} color={colors.textPrimary} />
            </TouchableOpacity>
          </View>

          {/* Dynamic validation hint for move mode */}
          {mode === 'move' && sourceNode && (
            <View style={{ paddingHorizontal: 12, paddingVertical: 8, borderRadius: 12, backgroundColor: colors.surfaceStrong, borderWidth: 1, borderColor: colors.border, marginBottom: 16 }}>
              <Text style={{ fontSize: 12, fontWeight: '600', color: colors.textSecondary, textAlign: 'center' }}>
                Tap a target {sourceNode.type === 'topic' ? 'Subject' : sourceNode.type === 'subtopic' ? 'Topic' : 'Topic or Subtopic'} below
              </Text>
            </View>
          )}

          {/* Inline creation input */}
          {createTarget && (
            <View style={{ flexDirection: 'row', gap: 8, marginBottom: 10, paddingHorizontal: 10 }}>
              <TextInput
                value={newName} onChangeText={setNewName}
                placeholder={`New ${createTarget.label} name...`}
                placeholderTextColor={colors.textTertiary} autoFocus
                style={{ flex: 1, height: 46, borderRadius: 12, borderWidth: 1, paddingHorizontal: 12, fontSize: 14, color: colors.textPrimary, borderColor: colors.border }}
              />
              <TouchableOpacity onPress={handleCreateItem} disabled={creating || !newName.trim()}
                style={{ height: 46, borderRadius: 12, paddingHorizontal: 14, backgroundColor: '#5B4EFA', alignItems: 'center', justifyContent: 'center', opacity: creating ? 0.6 : 1 }}>
                {creating ? <ActivityIndicator size="small" color="#fff" /> : <Text style={{ color: '#fff', fontWeight: '900', fontSize: 14 }}>Create</Text>}
              </TouchableOpacity>
              <TouchableOpacity onPress={() => { setCreateTarget(null); setNewName(''); }}
                style={{ height: 46, borderRadius: 12, paddingHorizontal: 14, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' }}>
                <Text style={{ color: colors.textPrimary, fontWeight: '700', fontSize: 14 }}>Cancel</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Scrollable List */}
          <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false}>
            <View style={{ paddingBottom: 20 }}>
              {visibleNodes.map(node => {
                const isSelected = selectedId === node.id;
                const hasKids = node.hasKids;
                const depth = node.depth || 0;
                const indent = depth * 24;

                const selectable = canSelectNode(node.type, node.id);
                const isDisabled = mode === 'move' && !selectable && node.type === 'note';

                // Add folder label permissions
                const addLabel = node.type === 'subject' ? 'Topic' :
                  node.type === 'topic' ? 'Subtopic' :
                  node.type === 'subtopic' ? 'Notebook' : null;

                return (
                  <View key={node.id} style={{ flexDirection: 'row', alignItems: 'stretch', opacity: isDisabled ? 0.4 : 1 }}>
                    <TouchableOpacity
                      onPress={() => handleSelect(node)}
                      activeOpacity={0.7}
                      disabled={isDisabled}
                      style={{
                        flex: 1, flexDirection: 'row', alignItems: 'center', paddingVertical: 14,
                        borderBottomWidth: 1, borderBottomColor: colors.border + '40',
                        paddingLeft: 8 + indent,
                        backgroundColor: isSelected ? '#EEECFF' : 'transparent',
                        borderRadius: isSelected ? 12 : 0,
                      }}
                    >
                      <View style={{ width: 28, height: 40, alignItems: 'center', justifyContent: 'center', marginRight: 4 }}>
                        {hasKids ? (
                          <TouchableOpacity onPress={(e) => { e.stopPropagation(); toggle(node.id); }} style={{ padding: 6 }}>
                            {expanded.has(node.id)
                              ? <ChevronDown size={18} color={colors.textTertiary} />
                              : <ChevronRight size={18} color={colors.textTertiary} />
                            }
                          </TouchableOpacity>
                        ) : <View style={{ width: 18 }} />}
                      </View>
                      <View style={{ width: 32, height: 36, alignItems: 'center', justifyContent: 'center', marginRight: 8 }}>
                        {renderIcon(node.type)}
                      </View>
                      <Text style={{ 
                        fontSize: 15, 
                        fontWeight: (isSelected || node.type === 'note') ? '700' : '600', 
                        color: isSelected ? '#5B4EFA' : (selectable && mode === 'move') ? colors.primary : colors.textPrimary, 
                        flex: 1 
                      }} numberOfLines={1}>
                        {node.title}
                      </Text>
                      {isSelected && <CheckCircle2 size={20} color="#5B4EFA" />}
                      {(!isSelected && selectable && mode === 'move') && (
                        <View style={{ width: 18, height: 18, borderRadius: 9, borderWidth: 2, borderColor: colors.primary + '60', marginRight: 8 }} />
                      )}
                    </TouchableOpacity>

                    {/* Add Child node inline only if mode isn't Move for clearer UI */}
                    {mode !== 'move' && addLabel && (
                      <TouchableOpacity
                        onPress={() => setCreateTarget({ parentId: node.id, label: addLabel || 'Item' })}
                        style={{
                          width: 40, alignItems: 'center', justifyContent: 'center',
                          borderBottomWidth: 1, borderBottomColor: colors.border + '40',
                        }}
                        hitSlop={{ top: 8, bottom: 8, left: 4, right: 8 }}
                      >
                        <View style={{ width: 24, height: 24, borderRadius: 12, backgroundColor: '#5B4EFA', alignItems: 'center', justifyContent: 'center' }}>
                          <Plus size={14} color="#fff" />
                        </View>
                      </TouchableOpacity>
                    )}
                  </View>
                );
              })}
            </View>
          </ScrollView>

          {/* Footer Actions */}
          <View style={{ marginTop: 16, paddingHorizontal: 8 }}>
            {mode === 'move' ? (
              <View style={{ flexDirection: 'row', gap: 12 }}>
                <TouchableOpacity onPress={onClose} disabled={moving}
                  style={{ flex: 1, height: 48, borderRadius: 14, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' }}>
                  <Text style={{ color: colors.textSecondary, fontWeight: '700' }}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity 
                  onPress={handleMoveCommit} 
                  disabled={!selectedId || moving}
                  style={{ 
                    flex: 1.6, height: 48, borderRadius: 14, backgroundColor: '#5B4EFA', 
                    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
                    opacity: (!selectedId || moving) ? 0.6 : 1 
                  }}
                >
                  {moving ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <>
                      <CheckCircle2 size={16} color="#fff" />
                      <Text style={{ color: '#fff', fontWeight: '800', fontSize: 15 }}>Move Here</Text>
                    </>
                  )}
                </TouchableOpacity>
              </View>
            ) : (
              <View style={{ flexDirection: 'row', gap: 8 }}>
                <TouchableOpacity onPress={() => setCreateTarget({ parentId: null, label: 'Subject' })}
                  style={{ flex: 1, paddingVertical: 12, borderRadius: 12, backgroundColor: '#EEECFF', borderWidth: 1, borderColor: '#5B4EFA', alignItems: 'center' }}>
                  <Text style={{ color: '#5B4EFA', fontWeight: '800', fontSize: 13 }}>+ Subject</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => {
                  const expandedArr = Array.from(expanded);
                  const lastExpanded = expandedArr.length > 0 ? expandedArr[expandedArr.length - 1] : null;
                  setCreateTarget({ parentId: lastExpanded, label: lastExpanded ? 'Item' : 'Subject' });
                }}
                  style={{ flex: 1, paddingVertical: 12, borderRadius: 12, backgroundColor: '#EEECFF', borderWidth: 1, borderColor: '#5B4EFA', alignItems: 'center' }}>
                  <Text style={{ color: '#5B4EFA', fontWeight: '800', fontSize: 13 }}>+ New Item</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>

        </View>
      </View>
    </Modal>
  );
};

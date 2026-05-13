import React, { useState, useEffect } from 'react';
import { Alert } from 'react-native';
import { useTheme } from '../../context/ThemeContext';
import { useAuth } from '../../context/AuthContext';
import { fetchAllPilotV2Nodes, updatePilotV2NodeParent } from '../../repositories/pilotV2Repo';
import { PilotV2Node } from './types';
import { PilotV2HierarchyPicker } from './PilotV2HierarchyPicker';

export interface NodeToMove {
  id: string;
  type: 'topic' | 'subtopic' | 'note';
  label: string;
  currentParentLabel?: string;
  noteId?: string; 
}

interface Props {
  visible: boolean;
  node: NodeToMove | null;
  onClose: () => void;
  onSuccess: () => void;
}

export function PilotV2MoveModal({ visible, node, onClose, onSuccess }: Props) {
  const { colors } = useTheme();
  const { session } = useAuth();
  const userId = session?.user?.id;

  const [allNodes, setAllNodes] = useState<PilotV2Node[]>([]);

  const loadNodes = async () => {
    if (!userId) return;
    try {
      const nodes = await fetchAllPilotV2Nodes(userId);
      setAllNodes(nodes);
    } catch (err) {
      console.error('[MoveModal] fetch nodes failed', err);
    }
  };

  useEffect(() => {
    if (visible && userId) {
      loadNodes();
    }
  }, [visible, userId]);

  const handleConfirmMove = async (targetNodeId: string) => {
    if (!userId || !node || !targetNodeId) return;

    try {
      // 1. Resolve the physical source node database ID (it might not exist for static folders)
      let sourceNodeId = allNodes.find(n => {
        if (node.type === 'note') return n.note_id === node.id;
        return n.title.toLowerCase() === node.label.toLowerCase() && n.type === node.type;
      })?.id;

      // 2. Self-healing provisioning for standard syllabus entries
      if (!sourceNodeId) {
        if (node.type === 'topic') {
          const { ensurePilotV2TopicNode } = await import('../../repositories/pilotV2Repo');
          const subjLabel = node.currentParentLabel || 'General';
          const created = await ensurePilotV2TopicNode(userId, subjLabel, node.label);
          sourceNodeId = created?.id;
        } else if (node.type === 'subtopic') {
          const { ensurePilotV2SubtopicNode } = await import('../../repositories/pilotV2Repo');
          const parentTopicLabel = node.currentParentLabel || 'General';
          const created = await ensurePilotV2SubtopicNode(userId, 'General', parentTopicLabel, node.label);
          sourceNodeId = created?.id;
        }
      }

      if (!sourceNodeId) {
        Alert.alert('Error', 'Could not resolve source folder. Please create an item inside it first.');
        return;
      }

      // 3. Fire SQL parent reassignment
      const success = await updatePilotV2NodeParent(sourceNodeId, targetNodeId);
      if (success) {
        onSuccess();
        onClose();
      } else {
        Alert.alert('Failed', 'The server could not complete the move. Please check your connection.');
      }
    } catch (err) {
      Alert.alert('Error', `Failed to move node: ${(err as Error).message}`);
    }
  };

  if (!visible || !node || !userId) return null;

  return (
    <PilotV2HierarchyPicker
      mode="move"
      visible={visible}
      allNodes={allNodes}
      userId={userId}
      colors={colors}
      sourceNode={node}
      onConfirmMove={handleConfirmMove}
      onClose={onClose}
      onRefresh={loadNodes}
    />
  );
}

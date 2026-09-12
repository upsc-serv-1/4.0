import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { X, Check } from 'lucide-react-native';
import { useTheme } from '../../context/ThemeContext';
import { PilotV2Block } from './types';

interface BlockSelectorProps {
  visible: boolean;
  blocks: PilotV2Block[];
  onSelect: (selectedBlocks: PilotV2Block[]) => void;
  onCancel: () => void;
  maxBlocks?: number;
  noteTitle?: string;
}

export function BlockSelector({
  visible,
  blocks,
  onSelect,
  onCancel,
  maxBlocks = 4,
  noteTitle = 'Note',
}: BlockSelectorProps) {
  const { colors } = useTheme();
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const handleToggle = (blockId: string) => {
    const newSelected = new Set(selected);
    if (newSelected.has(blockId)) {
      newSelected.delete(blockId);
    } else if (newSelected.size < maxBlocks) {
      newSelected.add(blockId);
    }
    setSelected(newSelected);
  };

  const handleConfirm = () => {
    const selectedBlocks = blocks.filter((b) => selected.has(b.id));
    onSelect(selectedBlocks);
    setSelected(new Set()); // Reset for next time
  };

  const getBlockPreview = (block: PilotV2Block): string => {
    if (block.imageUri || block.imageBase64) {
      return '📷 Image';
    }
    return block.text?.substring(0, 50) || 'Empty block';
  };

  const getBlockTypeLabel = (type: string): string => {
    switch (type) {
      case 'heading':
        return '📌';
      case 'paragraph':
        return '📝';
      case 'bullet':
        return '•';
      case 'numbered':
        return '1.';
      case 'checklist':
        return '☑';
      case 'quote':
        return '❝';
      case 'code':
        return '</>';
      default:
        return '○';
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide">
      <SafeAreaView style={[s.container, { backgroundColor: colors.bg }]}>
        {/* Header */}
        <View style={[s.header, { borderBottomColor: colors.border }]}>
          <Text style={[s.title, { color: colors.textPrimary }]}>
            Select blocks for flashcard
          </Text>
          <TouchableOpacity onPress={onCancel} style={s.closeBtn}>
            <X size={24} color={colors.textPrimary} />
          </TouchableOpacity>
        </View>

        {/* Block List */}
        <ScrollView
          style={s.list}
          contentContainerStyle={s.listContent}
          showsVerticalScrollIndicator={false}
        >
          {blocks.length === 0 ? (
            <View style={s.emptyState}>
              <Text style={[s.emptyText, { color: colors.textTertiary }]}>
                No blocks in this note
              </Text>
            </View>
          ) : (
            blocks.map((block, index) => {
              const isSelected = selected.has(block.id);
              const canSelect =
                isSelected || selected.size < maxBlocks;

              return (
                <TouchableOpacity
                  key={block.id}
                  onPress={() => handleToggle(block.id)}
                  disabled={!canSelect}
                  style={[
                    s.blockItem,
                    {
                      backgroundColor: isSelected
                        ? colors.primary + '15'
                        : colors.surface,
                      borderColor: isSelected
                        ? colors.primary
                        : colors.border,
                      opacity: canSelect ? 1 : 0.5,
                    },
                  ]}
                  activeOpacity={canSelect ? 0.7 : 1}
                >
                  <View style={s.blockContent}>
                    <View style={s.blockHeader}>
                      <Text style={[s.blockType, { color: colors.textTertiary }]}>
                        {getBlockTypeLabel(block.type)} {block.type}
                      </Text>
                      {index > 0 && (
                        <Text style={[s.blockIndex, { color: colors.textTertiary }]}>
                          Block {index + 1}
                        </Text>
                      )}
                    </View>
                    <Text
                      style={[s.blockPreview, { color: colors.textSecondary }]}
                      numberOfLines={2}
                    >
                      {getBlockPreview(block)}
                    </Text>
                  </View>
                  <View
                    style={[
                      s.checkbox,
                      {
                        borderColor: isSelected
                          ? colors.primary
                          : colors.border,
                        backgroundColor: isSelected
                          ? colors.primary
                          : 'transparent',
                      },
                    ]}
                  >
                    {isSelected && (
                      <Check size={16} color="#fff" strokeWidth={3} />
                    )}
                  </View>
                </TouchableOpacity>
              );
            })
          )}
        </ScrollView>

        {/* Footer */}
        <View
          style={[
            s.footer,
            {
              backgroundColor: colors.surface,
              borderTopColor: colors.border,
            },
          ]}
        >
          <View style={s.footerContent}>
            <View>
              <Text
                style={[s.counterLabel, { color: colors.textTertiary }]}
              >
                Selected
              </Text>
              <Text style={[s.counter, { color: colors.primary }]}>
                {selected.size} / {maxBlocks}
              </Text>
            </View>

            <View style={s.footerButtons}>
              <TouchableOpacity
                onPress={onCancel}
                style={[s.cancelBtn, { borderColor: colors.border }]}
              >
                <Text style={[s.cancelBtnText, { color: colors.textPrimary }]}>
                  Cancel
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={handleConfirm}
                disabled={selected.size === 0}
                style={[
                  s.confirmBtn,
                  {
                    backgroundColor: colors.primary,
                    opacity: selected.size === 0 ? 0.5 : 1,
                  },
                ]}
              >
                <Text style={s.confirmBtnText}>Create Flashcard</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </SafeAreaView>
    </Modal>
  );
}

const s = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    flex: 1,
  },
  closeBtn: {
    padding: 8,
    marginRight: -8,
  },
  list: {
    flex: 1,
  },
  listContent: {
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  blockItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 12,
    marginVertical: 6,
    borderRadius: 8,
    borderWidth: 1.5,
  },
  blockContent: {
    flex: 1,
    marginRight: 12,
  },
  blockHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  blockType: {
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
    marginRight: 8,
  },
  blockIndex: {
    fontSize: 11,
    fontStyle: 'italic',
  },
  blockPreview: {
    fontSize: 13,
    lineHeight: 18,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
  },
  emptyText: {
    fontSize: 14,
    fontStyle: 'italic',
  },
  footer: {
    borderTopWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  footerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  counterLabel: {
    fontSize: 12,
    marginBottom: 4,
  },
  counter: {
    fontSize: 20,
    fontWeight: '700',
  },
  footerButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  cancelBtn: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1.5,
  },
  cancelBtnText: {
    fontSize: 14,
    fontWeight: '600',
  },
  confirmBtn: {
    paddingHorizontal: 24,
    paddingVertical: 10,
    borderRadius: 8,
  },
  confirmBtnText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
});

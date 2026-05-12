import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  ScrollView,
  ActivityIndicator,
  SafeAreaView,
} from 'react-native';
import { X, Check, Zap } from 'lucide-react-native';
import { useTheme } from '../../context/ThemeContext';
import { PilotV2Block } from './types';

interface BlockContextSelectorProps {
  visible: boolean;
  blocks: PilotV2Block[];
  onSelect: (selectedBlocks: PilotV2Block[], mode: 'single' | 'multiple' | 'section' | 'all') => void;
  onCancel: () => void;
  noteTitle?: string;
  currentSectionId?: string;
}

export function BlockContextSelector({
  visible,
  blocks,
  onSelect,
  onCancel,
  noteTitle = 'Note',
  currentSectionId,
}: BlockContextSelectorProps) {
  const { colors } = useTheme();
  const [selectionMode, setSelectionMode] = useState<'single' | 'multiple' | 'section' | 'all'>('multiple');
  const [selectedBlocks, setSelectedBlocks] = useState<Set<string>>(new Set());

  const handleToggle = (blockId: string) => {
    const newSelected = new Set(selectedBlocks);
    if (newSelected.has(blockId)) {
      newSelected.delete(blockId);
    } else {
      if (selectionMode === 'single') {
        newSelected.clear();
      }
      newSelected.add(blockId);
    }
    setSelectedBlocks(newSelected);
  };

  const handleSelectAll = () => {
    setSelectedBlocks(new Set(blocks.map(b => b.id)));
  };

  const handleSelectSection = () => {
    if (!currentSectionId) return;
    const sectionBlocks = blocks.filter(b => b.sectionId === currentSectionId);
    setSelectedBlocks(new Set(sectionBlocks.map(b => b.id)));
  };

  const handleConfirm = () => {
    const selected = blocks.filter(b => selectedBlocks.has(b.id));
    
    if (selected.length === 0) {
      alert('Please select at least one block');
      return;
    }

    onSelect(selected, selectionMode);
    setSelectedBlocks(new Set());
  };

  const getBlockPreview = (block: PilotV2Block): string => {
    const text = block.content || block.title || '';
    return text.length > 60 ? text.substring(0, 60) + '...' : text;
  };

  const modeOptions: { key: 'single' | 'multiple' | 'section' | 'all'; label: string; description: string }[] = [
    {
      key: 'single',
      label: 'Single Block',
      description: 'Use one block as context for AI',
    },
    {
      key: 'multiple',
      label: 'Multiple Blocks',
      description: 'Hand-pick specific blocks (1-10)',
    },
    {
      key: 'section',
      label: 'Current Section',
      description: 'All blocks in current section',
    },
    {
      key: 'all',
      label: 'Entire Note',
      description: 'Full note as context',
    },
  ];

  const getSectionBlocks = (): PilotV2Block[] => {
    if (!currentSectionId) return [];
    return blocks.filter(b => b.sectionId === currentSectionId);
  };

  const isSectionMode = selectionMode === 'section';
  const isAllMode = selectionMode === 'all';
  const isMultipleMode = selectionMode === 'multiple';

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onCancel}>
      <SafeAreaView style={[s.container, { backgroundColor: colors.surface }]}>
        {/* Header */}
        <View style={[s.header, { borderBottomColor: colors.border }]}>
          <View style={{ flex: 1 }}>
            <Text style={[s.title, { color: colors.textPrimary }]}>AI Context</Text>
            <Text style={[s.subtitle, { color: colors.textTertiary }]}>{noteTitle}</Text>
          </View>
          <TouchableOpacity onPress={onCancel}>
            <X size={24} color={colors.textPrimary} />
          </TouchableOpacity>
        </View>

        <ScrollView contentContainerStyle={s.content} showsVerticalScrollIndicator={false}>
          {/* Selection Mode Options */}
          <View style={s.section}>
            <Text style={[s.sectionLabel, { color: colors.textTertiary }]}>SELECT CONTEXT TYPE</Text>
            <View style={s.modeGrid}>
              {modeOptions.map(option => (
                <TouchableOpacity
                  key={option.key}
                  onPress={() => {
                    setSelectionMode(option.key);
                    setSelectedBlocks(new Set());
                    if (option.key === 'all') {
                      handleSelectAll();
                    } else if (option.key === 'section') {
                      handleSelectSection();
                    }
                  }}
                  style={[
                    s.modeCard,
                    {
                      borderColor: selectionMode === option.key ? colors.primary : colors.border,
                      backgroundColor:
                        selectionMode === option.key ? colors.primary + '10' : colors.surfaceStrong,
                      borderWidth: 2,
                    },
                  ]}
                >
                  <View style={{ flex: 1 }}>
                    <Text
                      style={[
                        s.modeLabel,
                        { color: selectionMode === option.key ? colors.primary : colors.textPrimary },
                      ]}
                    >
                      {option.label}
                    </Text>
                    <Text style={[s.modeDesc, { color: colors.textTertiary }]}>
                      {option.description}
                    </Text>
                  </View>
                  {selectionMode === option.key && (
                    <Check size={20} color={colors.primary} style={{ marginLeft: 8 }} />
                  )}
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Block Selection (for multiple mode) */}
          {isMultipleMode && (
            <View style={s.section}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                <Text style={[s.sectionLabel, { color: colors.textTertiary }]}>
                  SELECT BLOCKS ({selectedBlocks.size})
                </Text>
                {selectedBlocks.size > 0 && (
                  <TouchableOpacity
                    onPress={() => setSelectedBlocks(new Set())}
                    style={{ padding: 4 }}
                  >
                    <Text style={{ fontSize: 12, color: colors.primary, fontWeight: '600' }}>
                      CLEAR
                    </Text>
                  </TouchableOpacity>
                )}
              </View>

              <View style={s.blocksList}>
                {blocks.map(block => (
                  <TouchableOpacity
                    key={block.id}
                    onPress={() => handleToggle(block.id)}
                    style={[
                      s.blockItem,
                      {
                        backgroundColor: selectedBlocks.has(block.id)
                          ? colors.primary + '15'
                          : colors.surfaceStrong,
                        borderColor: selectedBlocks.has(block.id)
                          ? colors.primary
                          : colors.border,
                        borderWidth: selectedBlocks.has(block.id) ? 2 : 1,
                      },
                    ]}
                  >
                    <View style={{ flex: 1 }}>
                      <View style={s.blockMeta}>
                        <Text style={[s.blockType, { color: colors.textTertiary }]}>
                          {block.type === 'heading' ? '📌' : block.type === 'text' ? '📝' : '•'}
                        </Text>
                        {block.sectionId && (
                          <Text style={[s.blockSection, { color: colors.textTertiary }]}>
                            {blocks.find(b => b.id === block.sectionId)?.title || 'Section'}
                          </Text>
                        )}
                      </View>
                      <Text
                        style={[s.blockPreview, { color: colors.textPrimary }]}
                        numberOfLines={2}
                      >
                        {getBlockPreview(block)}
                      </Text>
                    </View>
                    {selectedBlocks.has(block.id) && (
                      <Check size={18} color={colors.primary} style={{ marginLeft: 8 }} />
                    )}
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          )}

          {/* Section Summary (for section mode) */}
          {isSectionMode && currentSectionId && (
            <View style={s.section}>
              <Text style={[s.sectionLabel, { color: colors.textTertiary }]}>
                SECTION BLOCKS ({getSectionBlocks().length})
              </Text>
              <View style={[s.summaryBox, { backgroundColor: colors.primary + '10', borderColor: colors.primary }]}>
                <Zap size={16} color={colors.primary} />
                <Text style={[s.summaryText, { color: colors.textPrimary }]}>
                  {getSectionBlocks().length} blocks selected from current section
                </Text>
              </View>
            </View>
          )}

          {/* All Blocks Summary (for all mode) */}
          {isAllMode && (
            <View style={s.section}>
              <Text style={[s.sectionLabel, { color: colors.textTertiary }]}>ALL BLOCKS ({blocks.length})</Text>
              <View style={[s.summaryBox, { backgroundColor: colors.primary + '10', borderColor: colors.primary }]}>
                <Zap size={16} color={colors.primary} />
                <Text style={[s.summaryText, { color: colors.textPrimary }]}>
                  Using full note ({blocks.length} blocks) as AI context
                </Text>
              </View>
            </View>
          )}

          {/* Info Box */}
          <View style={[s.infoBox, { backgroundColor: colors.surfaceStrong, borderColor: colors.border }]}>
            <Text style={[s.infoLabel, { color: colors.textTertiary }]}>💡 AI CONTEXT TIPS</Text>
            <Text style={[s.infoText, { color: colors.textSecondary }]}>
              • More context = better AI understanding{'\n'}• Too much context slows down responses{'\n'}•
              Start with relevant sections
            </Text>
          </View>
        </ScrollView>

        {/* Footer Buttons */}
        <View style={[s.footer, { borderTopColor: colors.border, backgroundColor: colors.surface }]}>
          <TouchableOpacity
            onPress={onCancel}
            style={[s.btn, { backgroundColor: colors.border + '30' }]}
          >
            <Text style={[s.btnText, { color: colors.textSecondary }]}>Cancel</Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={handleConfirm}
            disabled={selectedBlocks.size === 0 && isMultipleMode}
            style={[
              s.btn,
              s.btnPrimary,
              {
                backgroundColor:
                  selectedBlocks.size === 0 && isMultipleMode ? colors.border : colors.primary,
              },
            ]}
          >
            <Zap size={16} color={colors.surface} style={{ marginRight: 6 }} />
            <Text style={[s.btnText, { color: colors.surface, fontWeight: '700' }]}>Use Context</Text>
          </TouchableOpacity>
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
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
  },
  title: {
    fontSize: 18,
    fontWeight: '800',
  },
  subtitle: {
    fontSize: 12,
    marginTop: 4,
    fontWeight: '500',
  },
  content: {
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  section: {
    marginBottom: 24,
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '700',
    marginBottom: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  modeGrid: {
    gap: 10,
  },
  modeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 10,
  },
  modeLabel: {
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 4,
  },
  modeDesc: {
    fontSize: 12,
  },
  blocksList: {
    gap: 8,
  },
  blockItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 8,
  },
  blockMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 6,
  },
  blockType: {
    fontSize: 14,
  },
  blockSection: {
    fontSize: 10,
    fontWeight: '600',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  blockPreview: {
    fontSize: 13,
    fontWeight: '500',
    lineHeight: 18,
  },
  summaryBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
  },
  summaryText: {
    fontSize: 13,
    fontWeight: '600',
    flex: 1,
  },
  infoBox: {
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    marginBottom: 24,
  },
  infoLabel: {
    fontSize: 11,
    fontWeight: '700',
    marginBottom: 8,
  },
  infoText: {
    fontSize: 12,
    lineHeight: 18,
  },
  footer: {
    flexDirection: 'row',
    gap: 12,
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderTopWidth: 1,
  },
  btn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnPrimary: {
    flexDirection: 'row',
  },
  btnText: {
    fontSize: 13,
    fontWeight: '700',
  },
});

import React, { useCallback, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TextInput, TouchableOpacity,
  Platform, KeyboardAvoidingView, useWindowDimensions, ActivityIndicator
} from 'react-native';
import {
  Bold, Italic, Underline as UnderlineIcon, List, ListOrdered,
  ListTodo, Save, X, RotateCcw, RotateCw, Highlighter, Plus, Trash2, CheckSquare, Square
} from 'lucide-react-native';
import { useTheme } from '../../context/ThemeContext';
import { usePilot, PilotBlock, PilotNote } from '../../context/PilotContext';

interface PilotEditorViewProps {
  onClose?: () => void;
  onSave?: (note: Partial<PilotNote>) => void;
}

export const PilotEditorView: React.FC<PilotEditorViewProps> = ({ onClose, onSave }) => {
  const { colors } = useTheme();
  const { state, dispatch } = usePilot();
  const { width } = useWindowDimensions();
  const isTablet = width >= 768;

  const [title, setTitle] = useState(state.currentNote?.title || 'Untitled');
  const [blocks, setBlocks] = useState<PilotBlock[]>(
    state.currentNote?.content.blocks || [{ id: '1', type: 'paragraph', text: '' }]
  );
  const [focusedBlockId, setFocusedBlockId] = useState<string | null>(null);
  const [showHighlights, setShowHighlights] = useState(false);
  const [rightTab, setRightTab] = useState<'blocks' | 'outline'>('blocks');
  const [saving, setSaving] = useState(false);

  const HIGHLIGHT_COLORS = [
    '#FFF300', '#ABEBC6', '#F1948A', '#C39BD3', '#AED6F1', '#F0F0F0'
  ];

  const handleBlockChange = (blockId: string, text: string) => {
    setBlocks(blocks.map(b => 
      b.id === blockId ? { ...b, text } : b
    ));
  };

  const handleBlockTypeChange = (blockId: string, type: PilotBlock['type']) => {
    setBlocks(blocks.map(b => 
      b.id === blockId ? { ...b, type } : b
    ));
  };

  const handleToggleChecklist = (blockId: string) => {
    setBlocks(blocks.map(b => 
      b.id === blockId ? { ...b, checked: !b.checked } : b
    ));
  };

  const handleApplyHighlight = (blockId: string, color: string) => {
    setBlocks(blocks.map(b => 
      b.id === blockId ? { ...b, highlightColor: color, type: 'highlight' } : b
    ));
    setShowHighlights(false);
  };

  const addBlockAfter = (afterId: string) => {
    const idx = blocks.findIndex(b => b.id === afterId);
    const newBlock: PilotBlock = {
      id: `b_${Date.now()}`,
      type: 'paragraph',
      text: '',
    };
    const newBlocks = [...blocks];
    newBlocks.splice(idx + 1, 0, newBlock);
    setBlocks(newBlocks);
    setFocusedBlockId(newBlock.id);
  };

  const deleteBlock = (blockId: string) => {
    if (blocks.length === 1) {
      setBlocks([{ id: '1', type: 'paragraph', text: '' }]);
    } else {
      setBlocks(blocks.filter(b => b.id !== blockId));
    }
  };

  const handleSave = useCallback(async () => {
    setSaving(true);
    try {
      const updatedNote: Partial<PilotNote> = {
        title,
        content: { blocks },
        updated_at: new Date().toISOString()
      };
      if (onSave) {
        onSave(updatedNote);
      } else {
        dispatch({
          type: 'UPDATE_CURRENT_NOTE',
          payload: updatedNote
        });
      }
    } catch (err) {
      console.error('Save failed:', err);
    } finally {
      setSaving(false);
    }
  }, [title, blocks, onSave, dispatch]);

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={{ flex: 1, backgroundColor: colors.surface }}>
        {/* Top bar */}
        <View style={[styles.topBar, { borderBottomColor: colors.border, backgroundColor: colors.surfaceStrong }]}>
          <Text style={{ color: colors.textPrimary, fontSize: 16, fontWeight: '700', flex: 1 }} numberOfLines={1}>
            {title || 'Untitled'}
          </Text>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <TouchableOpacity style={styles.iconBtn}>
              <RotateCcw size={18} color={colors.textSecondary} />
            </TouchableOpacity>
            <TouchableOpacity style={styles.iconBtn}>
              <RotateCw size={18} color={colors.textSecondary} />
            </TouchableOpacity>
            {onClose && (
              <TouchableOpacity onPress={onClose} style={styles.iconBtn}>
                <X size={20} color={colors.textPrimary} />
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* Toolbar */}
        <View style={[styles.toolbar, { borderBottomColor: colors.border, backgroundColor: colors.surface }]}>
          <TouchableOpacity 
            onPress={() => focusedBlockId && handleBlockTypeChange(focusedBlockId, 'heading')}
            style={[styles.toolBtn, { backgroundColor: colors.border + '40' }]}
          >
            <Text style={{ fontSize: 12, fontWeight: '900', color: colors.textPrimary }}>H1</Text>
          </TouchableOpacity>
          <TouchableOpacity 
            onPress={() => focusedBlockId && handleBlockTypeChange(focusedBlockId, 'paragraph')}
            style={[styles.toolBtn, { backgroundColor: colors.border + '40' }]}
          >
            <Text style={{ fontSize: 12, fontWeight: '900', color: colors.textPrimary }}>P</Text>
          </TouchableOpacity>
          <TouchableOpacity 
            onPress={() => focusedBlockId && handleBlockTypeChange(focusedBlockId, 'bullet')}
            style={styles.toolBtn}
          >
            <List size={16} color={colors.textSecondary} />
          </TouchableOpacity>
          <TouchableOpacity 
            onPress={() => focusedBlockId && handleBlockTypeChange(focusedBlockId, 'checklist')}
            style={styles.toolBtn}
          >
            <ListTodo size={16} color={colors.textSecondary} />
          </TouchableOpacity>
          <TouchableOpacity 
            onPress={() => setShowHighlights(!showHighlights)}
            style={[styles.toolBtn, showHighlights && { backgroundColor: colors.primary + '20' }]}
          >
            <Highlighter size={16} color={colors.primary} />
          </TouchableOpacity>

          {showHighlights && (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.colorPicker}>
              {HIGHLIGHT_COLORS.map(color => (
                <TouchableOpacity
                  key={color}
                  onPress={() => focusedBlockId && handleApplyHighlight(focusedBlockId, color)}
                  style={[styles.colorSwatch, { backgroundColor: color }]}
                />
              ))}
            </ScrollView>
          )}
        </View>

        {/* Main editor area */}
        <View style={{ flex: 1, flexDirection: 'row', overflow: 'hidden' }}>
          {/* Editor content */}
          <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.editorContent}>
            <TextInput
              value={title}
              onChangeText={setTitle}
              placeholder="Note title…"
              style={[styles.titleInput, { color: colors.textPrimary }]}
              placeholderTextColor={colors.textTertiary}
            />

            <View style={{ marginTop: 12, gap: 12 }}>
              {blocks.map((block) => (
                <View key={block.id} style={{ position: 'relative' }}>
                  <BlockEditor
                    block={block}
                    isFocused={focusedBlockId === block.id}
                    onFocus={() => setFocusedBlockId(block.id)}
                    onChange={(text) => handleBlockChange(block.id, text)}
                    onToggleCheck={() => handleToggleChecklist(block.id)}
                    colors={colors}
                  />
                  {focusedBlockId === block.id && (
                    <View style={styles.blockActions}>
                      <TouchableOpacity onPress={() => addBlockAfter(block.id)} style={styles.blockActionBtn}>
                        <Plus size={14} color={colors.primary} />
                      </TouchableOpacity>
                      <TouchableOpacity onPress={() => deleteBlock(block.id)} style={styles.blockActionBtn}>
                        <Trash2 size={14} color="#ef4444" />
                      </TouchableOpacity>
                    </View>
                  )}
                </View>
              ))}
            </View>
          </ScrollView>

          {/* Right sidebar (blocks outline) */}
          {isTablet && (
            <View style={[styles.rightPanel, { borderLeftColor: colors.border, backgroundColor: colors.surfaceStrong }]}>
              <View style={[styles.tabs, { borderBottomColor: colors.border }]}>
                <TouchableOpacity
                  onPress={() => setRightTab('blocks')}
                  style={[
                    styles.tab,
                    rightTab === 'blocks' && { borderBottomColor: colors.primary, borderBottomWidth: 2 },
                  ]}
                >
                  <Text style={{
                    fontSize: 13,
                    fontWeight: '700',
                    color: rightTab === 'blocks' ? colors.primary : colors.textSecondary,
                    textAlign: 'center'
                  }}>
                    Blocks
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => setRightTab('outline')}
                  style={[
                    styles.tab,
                    rightTab === 'outline' && { borderBottomColor: colors.primary, borderBottomWidth: 2 },
                  ]}
                >
                  <Text style={{
                    fontSize: 13,
                    fontWeight: '700',
                    color: rightTab === 'outline' ? colors.primary : colors.textSecondary,
                    textAlign: 'center'
                  }}>
                    Outline
                  </Text>
                </TouchableOpacity>
              </View>

              <ScrollView style={styles.outline}>
                {blocks.map((block) => (
                  <TouchableOpacity
                    key={block.id}
                    style={styles.outlineItem}
                    onPress={() => setFocusedBlockId(block.id)}
                  >
                    <Text style={{ fontSize: 10, fontWeight: '800', color: colors.textTertiary, textTransform: 'uppercase' }}>
                      {block.type}
                    </Text>
                    <Text 
                      style={{ fontSize: 13, color: colors.textPrimary, fontWeight: '600' }}
                      numberOfLines={1}
                    >
                      {block.text || 'Empty block'}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          )}
        </View>

        {/* Bottom save bar */}
        <View style={[styles.bottomBar, { borderTopColor: colors.border, backgroundColor: colors.surfaceStrong }]}>
          <TouchableOpacity 
            onPress={handleSave}
            style={[styles.saveBtn, { backgroundColor: colors.primary }]}
            disabled={saving}
          >
            {saving ? <ActivityIndicator size="small" color="#fff" /> : <Save size={16} color="#fff" />}
            <Text style={{ color: '#fff', fontSize: 14, fontWeight: '700' }}>
              {saving ? 'Saving...' : 'Save Changes'}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
};

// Block editor component
interface BlockEditorProps {
  block: PilotBlock;
  isFocused: boolean;
  onFocus: () => void;
  onChange: (text: string) => void;
  onToggleCheck: () => void;
  colors: any;
}

const BlockEditor: React.FC<BlockEditorProps> = ({
  block,
  isFocused,
  onFocus,
  onChange,
  onToggleCheck,
  colors,
}) => {
  const getPlaceholder = (type: PilotBlock['type']) => {
    switch (type) {
      case 'heading': return 'Heading…';
      case 'quote': return 'Quote…';
      default: return 'Type something…';
    }
  };

  const getInputStyle = (type: PilotBlock['type']) => {
    switch (type) {
      case 'heading':
        return { fontSize: 20, fontWeight: '800' as const, lineHeight: 26 };
      case 'quote':
        return { fontSize: 15, fontStyle: 'italic' as const, color: colors.textSecondary, lineHeight: 22 };
      default:
        return { fontSize: 15, lineHeight: 22 };
    }
  };

  return (
    <View
      style={[
        styles.blockWrap,
        isFocused && { backgroundColor: colors.primary + '10', borderColor: colors.primary + '40' },
        block.type === 'highlight' && { backgroundColor: block.highlightColor || '#FFF300', borderRadius: 6 }
      ]}
    >
      <View style={styles.blockRow}>
        {block.type === 'bullet' && (
          <Text style={{ color: colors.textPrimary, marginRight: 8, fontSize: 16, marginTop: 4 }}>•</Text>
        )}
        {block.type === 'numbered' && (
          <Text style={{ color: colors.textPrimary, marginRight: 8, fontSize: 15, fontWeight: '700', marginTop: 4 }}>1.</Text>
        )}
        {block.type === 'checklist' && (
          <TouchableOpacity onPress={onToggleCheck} style={{ marginRight: 8, marginTop: 4 }}>
            {block.checked ? (
              <CheckSquare size={18} color={colors.primary} />
            ) : (
              <Square size={18} color={colors.textTertiary} />
            )}
          </TouchableOpacity>
        )}

        <TextInput
          value={block.text}
          onChangeText={onChange}
          onFocus={onFocus}
          placeholder={getPlaceholder(block.type)}
          placeholderTextColor={colors.textTertiary}
          multiline
          scrollEnabled={false}
          style={[
            styles.blockInput,
            getInputStyle(block.type),
            { color: block.type === 'highlight' ? '#111' : colors.textPrimary, flex: 1 },
          ]}
        />
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    minHeight: 52,
  },
  iconBtn: { padding: 8, borderRadius: 8 },
  toolbar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderBottomWidth: 1,
    minHeight: 48,
    gap: 6,
  },
  toolBtn: { width: 34, height: 34, borderRadius: 6, alignItems: 'center', justifyContent: 'center' },
  colorPicker: { flexDirection: 'row', gap: 6, paddingLeft: 8 },
  colorSwatch: { width: 26, height: 26, borderRadius: 13, borderWidth: 1, borderColor: '#ccc' },
  editorContent: { paddingHorizontal: 16, paddingVertical: 16, paddingBottom: 120 },
  titleInput: { fontSize: 24, fontWeight: '900', padding: 8, borderBottomWidth: 1, borderBottomColor: '#eee' },
  blockWrap: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8, borderWidth: 1, borderColor: 'transparent', marginVertical: 2 },
  blockRow: { flexDirection: 'row', alignItems: 'flex-start' },
  blockInput: { padding: 0, minHeight: 28 },
  rightPanel: { width: 220, borderLeftWidth: 1, flexDirection: 'column' },
  tabs: { flexDirection: 'row', borderBottomWidth: 1 },
  tab: { flex: 1, paddingVertical: 12 },
  outline: { flex: 1, padding: 12 },
  outlineItem: { paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#eee', gap: 4 },
  bottomBar: { flexDirection: 'row', padding: 16, borderTopWidth: 1, justifyContent: 'flex-end' },
  saveBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 20, paddingVertical: 12, borderRadius: 10 },
  blockActions: { position: 'absolute', right: 4, top: 4, flexDirection: 'row', gap: 4 },
  blockActionBtn: { width: 24, height: 24, borderRadius: 12, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center', elevation: 2, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.1, shadowRadius: 1 }
});

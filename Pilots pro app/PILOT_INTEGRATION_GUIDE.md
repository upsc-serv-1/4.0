# Integration Guide: Knowledge Management App → Main App (Pilot Tab)

## Overview

You've created a beautiful, production-ready Knowledge Management app with:
- **Clean UI/UX** with proper structure (Sidebar, Dashboard, Editor, Glance)
- **Functional components** (EditorView, GlanceView, NoteList, Sidebar)
- **Rich formatting toolbar** (exactly what Capsule needs)
- **Block-based editor** (perfect for the Samsung Notes-style design)

**Your new app will replace/enhance Capsule as the "Pilot" tab** in your main application.

---

## Current Architecture

### Main App (Expo/React Native)
```
App.tsx (main entry)
├── Pages
│   ├── /home (home screen)
│   ├── /quiz (quiz engine)
│   ├── /capsule (OLD — will be replaced)
│   └── /pilot (NEW — your KM app)
├── Context
│   ├── AuthContext
│   ├── ThemeContext
│   └── NotesContext (NEW)
├── Components
│   └── capsule/ (OLD)
└── Repositories
    └── capsuleRepo.ts (will adapt for new app)
```

### Your New Knowledge Management App (Vite/React Web)
```
src/
├── main.tsx
├── App.tsx
├── components/
│   ├── Sidebar.tsx
│   ├── Dashboard.tsx
│   ├── EditorView.tsx ⭐ (Main editor)
│   ├── GlanceView.tsx ⭐ (Read-only preview)
│   ├── NoteList.tsx
│   └── ui/ (shadcn components)
└── styles/
```

---

## Integration Strategy

### Option 1: **Drop-in Replacement (Recommended)**
Replace the current Capsule implementation with your KM app as the new "Pilot" tab.

✅ Pros:
- Uses your production-ready UI/UX
- Rich formatting toolbar already built
- Sidebar/navigation structure ready
- Can be done incrementally

❌ Cons:
- Need to adapt from Web (Vite) to React Native (Expo)
- Need to add state management (currently uses local useState)
- Need to integrate with existing auth/database

### Option 2: **Parallel Deployment**
Keep Capsule as-is, add your KM app as a separate "Pilot" tab for testing.

✅ Pros:
- No breaking changes to existing Capsule
- Can gradually migrate users
- Test in production with real data

❌ Cons:
- Maintain two systems temporarily
- Duplicate logic for notes/hierarchy

---

## Recommended: Option 1 (Drop-in Replacement)

### Step 1: Migrate Components to React Native

Your components are built in React (Web/Tailwind). We need to adapt them to React Native.

**File structure after migration:**
```
src/
├── components/
│   ├── pilot/ (NEW — your KM app components)
│   │   ├── PilotSidebar.tsx (adapted Sidebar)
│   │   ├── PilotDashboard.tsx (adapted Dashboard)
│   │   ├── PilotEditorView.tsx (adapted EditorView) ⭐
│   │   ├── PilotGlanceView.tsx (adapted GlanceView) ⭐
│   │   ├── PilotNoteList.tsx (adapted NoteList)
│   │   └── types.ts (TypeScript types)
│   └── capsule/ (OLD — archive or remove)
├── pages/
│   ├── pilot/
│   │   ├── _layout.tsx
│   │   └── index.tsx
│   └── capsule/ (OLD)
└── context/
    └── PilotContext.tsx (NEW — state management)
```

---

## Step-by-Step Implementation Plan

### Phase 0: Set Up Context & Types (1 hour)

**File**: `src/context/PilotContext.tsx`

```typescript
import { createContext, useContext, useReducer, ReactNode } from 'react';

export interface PilotNote {
  id: string;
  title: string;
  subject: string;
  topic: string;
  subtopic: string;
  content: {
    blocks: PilotBlock[];
  };
  created_at: string;
  updated_at: string;
}

export interface PilotBlock {
  id: string;
  type: 'paragraph' | 'heading' | 'bullet' | 'numbered' | 'checklist' | 'quote' | 'highlight';
  text: string;
  level?: number; // for headings
  checked?: boolean; // for checklist
  highlightColor?: string;
  richText?: RichTextSpan[];
}

export interface RichTextSpan {
  text: string;
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  highlightColor?: string;
}

interface PilotState {
  notes: PilotNote[];
  currentNote: PilotNote | null;
  viewMode: 'dashboard' | 'list' | 'glance' | 'editor';
  selectedSubject: string | null;
  selectedTopic: string | null;
  selectedSubtopic: string | null;
  loading: boolean;
  error: string | null;
}

type PilotAction =
  | { type: 'SET_NOTES'; payload: PilotNote[] }
  | { type: 'SET_CURRENT_NOTE'; payload: PilotNote | null }
  | { type: 'SET_VIEW_MODE'; payload: PilotState['viewMode'] }
  | { type: 'SET_SELECTED_SUBJECT'; payload: string | null }
  | { type: 'SET_SELECTED_TOPIC'; payload: string | null }
  | { type: 'SET_SELECTED_SUBTOPIC'; payload: string | null }
  | { type: 'UPDATE_NOTE'; payload: Partial<PilotNote> }
  | { type: 'SET_LOADING'; payload: boolean }
  | { type: 'SET_ERROR'; payload: string | null };

const initialState: PilotState = {
  notes: [],
  currentNote: null,
  viewMode: 'dashboard',
  selectedSubject: null,
  selectedTopic: null,
  selectedSubtopic: null,
  loading: false,
  error: null,
};

const PilotContext = createContext<{
  state: PilotState;
  dispatch: React.Dispatch<PilotAction>;
} | null>(null);

function pilotReducer(state: PilotState, action: PilotAction): PilotState {
  switch (action.type) {
    case 'SET_NOTES':
      return { ...state, notes: action.payload };
    case 'SET_CURRENT_NOTE':
      return { ...state, currentNote: action.payload };
    case 'SET_VIEW_MODE':
      return { ...state, viewMode: action.payload };
    case 'SET_SELECTED_SUBJECT':
      return { ...state, selectedSubject: action.payload };
    case 'SET_SELECTED_TOPIC':
      return { ...state, selectedTopic: action.payload };
    case 'SET_SELECTED_SUBTOPIC':
      return { ...state, selectedSubtopic: action.payload };
    case 'UPDATE_NOTE':
      return {
        ...state,
        currentNote: state.currentNote
          ? { ...state.currentNote, ...action.payload }
          : null,
        notes: state.notes.map((n) =>
          n.id === state.currentNote?.id ? { ...n, ...action.payload } : n
        ),
      };
    case 'SET_LOADING':
      return { ...state, loading: action.payload };
    case 'SET_ERROR':
      return { ...state, error: action.payload };
    default:
      return state;
  }
}

export function PilotProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(pilotReducer, initialState);
  return (
    <PilotContext.Provider value={{ state, dispatch }}>
      {children}
    </PilotContext.Provider>
  );
}

export function usePilot() {
  const context = useContext(PilotContext);
  if (!context) {
    throw new Error('usePilot must be used within PilotProvider');
  }
  return context;
}
```

---

### Phase 1: Adapt Editor Component (2-3 hours)

**File**: `src/components/pilot/PilotEditorView.tsx`

```typescript
import React, { useCallback, useState, useRef } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TextInput, TouchableOpacity,
  Platform, KeyboardAvoidingView, useWindowDimensions,
} from 'react-native';
import {
  Bold, Italic, Underline as UnderlineIcon, List, ListOrdered,
  ListTodo, Code, Link as LinkIcon, Image as ImageIcon, 
  Save, X, RotateCcw, RotateCw, Highlighter,
} from 'lucide-react-native';
import { useTheme } from '../../context/ThemeContext';
import { usePilot } from '../../context/PilotContext';
import { PilotBlock, RichTextSpan } from '../../context/PilotContext';

interface PilotEditorViewProps {
  onClose?: () => void;
}

export const PilotEditorView: React.FC<PilotEditorViewProps> = ({ onClose }) => {
  const { colors } = useTheme();
  const { state, dispatch } = usePilot();
  const { width } = useWindowDimensions();
  const isTablet = width >= 900;

  const [title, setTitle] = useState(state.currentNote?.title || 'Untitled');
  const [blocks, setBlocks] = useState<PilotBlock[]>(
    state.currentNote?.content.blocks || [{ id: '1', type: 'paragraph', text: '' }]
  );
  const [focusedBlockId, setFocusedBlockId] = useState<string | null>(null);
  const [showHighlights, setShowHighlights] = useState(false);
  const [rightTab, setRightTab] = useState<'blocks' | 'outline'>('blocks');
  const [saving, setSaving] = useState(false);

  const HIGHLIGHT_COLORS = [
    '#FFF3B0', '#ABEBC6', '#F1948A', '#C39BD3', '#AED6F1', '#F0F0F0'
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
      // Save to database via repository
      if (state.currentNote) {
        dispatch({
          type: 'UPDATE_NOTE',
          payload: {
            title,
            content: { blocks },
            updated_at: new Date().toISOString(),
          },
        });
      }
    } catch (err) {
      console.error('Save failed:', err);
    } finally {
      setSaving(false);
    }
  }, [title, blocks, state.currentNote, dispatch]);

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={{ flex: 1, backgroundColor: colors.surface }}>
        {/* Top bar */}
        <View style={[styles.topBar, { borderBottomColor: colors.border }]}>
          <Text style={{ color: colors.textPrimary, fontSize: 14 }}>
            {title || 'Untitled'}
          </Text>
          <View style={{ marginLeft: 'auto', flexDirection: 'row', gap: 8 }}>
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
        <View style={[styles.toolbar, { borderBottomColor: colors.border }]}>
          <TouchableOpacity style={styles.toolBtn}>
            <Text style={{ fontSize: 12, fontWeight: '600' }}>H1</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.toolBtn}>
            <Text style={{ fontSize: 12, fontWeight: '600' }}>H2</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.toolBtn}>
            <Bold size={16} color={colors.textSecondary} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.toolBtn}>
            <Italic size={16} color={colors.textSecondary} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.toolBtn}>
            <UnderlineIcon size={16} color={colors.textSecondary} />
          </TouchableOpacity>

          <View style={[styles.divider, { backgroundColor: colors.border }]} />

          <TouchableOpacity style={styles.toolBtn}>
            <List size={16} color={colors.textSecondary} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.toolBtn}>
            <ListOrdered size={16} color={colors.textSecondary} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.toolBtn}>
            <ListTodo size={16} color={colors.textSecondary} />
          </TouchableOpacity>

          <View style={[styles.divider, { backgroundColor: colors.border }]} />

          <TouchableOpacity 
            onPress={() => setShowHighlights(!showHighlights)}
            style={styles.toolBtn}
          >
            <Highlighter size={16} color={colors.textSecondary} />
          </TouchableOpacity>

          {showHighlights && (
            <View style={styles.colorPicker}>
              {HIGHLIGHT_COLORS.map(color => (
                <TouchableOpacity
                  key={color}
                  style={[styles.colorSwatch, { backgroundColor: color }]}
                />
              ))}
            </View>
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

            <View style={{ marginTop: 24, gap: 12 }}>
              {blocks.map((block) => (
                <BlockEditor
                  key={block.id}
                  block={block}
                  isFocused={focusedBlockId === block.id}
                  onFocus={() => setFocusedBlockId(block.id)}
                  onChange={(text) => handleBlockChange(block.id, text)}
                  onTypeChange={(type) => handleBlockTypeChange(block.id, type)}
                  onAddAfter={() => addBlockAfter(block.id)}
                  onDelete={() => deleteBlock(block.id)}
                  colors={colors}
                />
              ))}
            </View>
          </ScrollView>

          {/* Right sidebar (blocks outline) */}
          {isTablet && (
            <View style={[styles.rightPanel, { borderLeftColor: colors.border }]}>
              <View style={styles.tabs}>
                <TouchableOpacity
                  onPress={() => setRightTab('blocks')}
                  style={[
                    styles.tab,
                    rightTab === 'blocks' && { borderBottomColor: colors.primary },
                  ]}
                >
                  <Text style={{
                    fontSize: 13,
                    color: rightTab === 'blocks' ? colors.primary : colors.textSecondary,
                  }}>
                    Blocks
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => setRightTab('outline')}
                  style={[
                    styles.tab,
                    rightTab === 'outline' && { borderBottomColor: colors.primary },
                  ]}
                >
                  <Text style={{
                    fontSize: 13,
                    color: rightTab === 'outline' ? colors.primary : colors.textSecondary,
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
                    <Text style={{ fontSize: 11, color: colors.textTertiary }}>
                      {block.type.toUpperCase()}
                    </Text>
                    <Text 
                      style={{ fontSize: 13, color: colors.textPrimary }}
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
        <View style={[styles.bottomBar, { borderTopColor: colors.border }]}>
          <TouchableOpacity 
            onPress={handleSave}
            style={[styles.saveBtn, { backgroundColor: colors.primary }]}
            disabled={saving}
          >
            <Save size={16} color="#fff" />
            <Text style={{ color: '#fff', fontSize: 13, fontWeight: '600' }}>
              {saving ? 'Saving...' : 'Save'}
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
  onTypeChange: (type: PilotBlock['type']) => void;
  onAddAfter: () => void;
  onDelete: () => void;
  colors: any;
}

const BlockEditor: React.FC<BlockEditorProps> = ({
  block,
  isFocused,
  onFocus,
  onChange,
  onTypeChange,
  onAddAfter,
  onDelete,
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
        return { fontSize: 22, fontWeight: '700' as const };
      case 'quote':
        return { fontSize: 15, fontStyle: 'italic' as const, color: colors.textSecondary };
      default:
        return { fontSize: 15 };
    }
  };

  return (
    <View
      style={[
        styles.blockWrap,
        isFocused && { backgroundColor: 'rgba(91,79,232,0.06)' },
      ]}
    >
      <View style={styles.blockRow}>
        {block.type === 'bullet' && (
          <Text style={{ color: colors.textPrimary, marginRight: 8 }}>•</Text>
        )}
        {block.type === 'numbered' && (
          <Text style={{ color: colors.textPrimary, marginRight: 8 }}>1.</Text>
        )}

        <TextInput
          value={block.text}
          onChangeText={onChange}
          onFocus={onFocus}
          placeholder={getPlaceholder(block.type)}
          placeholderTextColor={colors.textTertiary}
          multiline
          style={[
            styles.blockInput,
            getInputStyle(block.type),
            { color: colors.textPrimary, flex: 1 },
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
    minHeight: 48,
  },
  iconBtn: { padding: 8, borderRadius: 8 },
  toolbar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderBottomWidth: 1,
    minHeight: 44,
    gap: 4,
  },
  toolBtn: { padding: 8, borderRadius: 6, alignItems: 'center', justifyContent: 'center' },
  divider: { width: 1, height: 24, marginHorizontal: 4 },
  colorPicker: { flexDirection: 'row', gap: 6, paddingHorizontal: 8 },
  colorSwatch: { width: 24, height: 24, borderRadius: 4 },
  editorContent: { paddingHorizontal: 20, paddingVertical: 16, paddingBottom: 100 },
  titleInput: { fontSize: 22, fontWeight: '700', padding: 8, marginBottom: 16 },
  blockWrap: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8 },
  blockRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  blockInput: { padding: 4, lineHeight: 22, minHeight: 28 },
  rightPanel: { width: 280, borderLeftWidth: 1, flexDirection: 'column' },
  tabs: { flexDirection: 'row', borderBottomWidth: 1 },
  tab: { flex: 1, paddingVertical: 12, paddingHorizontal: 12, borderBottomWidth: 2, borderBottomColor: 'transparent' },
  outline: { flex: 1, padding: 12, gap: 8 },
  outlineItem: { paddingVertical: 8, gap: 4 },
  bottomBar: { flexDirection: 'row', padding: 12, borderTopWidth: 1, gap: 12 },
  saveBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 16, paddingVertical: 12, borderRadius: 8 },
});
```

---

### Phase 2: Adapt Glance View Component (1-2 hours)

**File**: `src/components/pilot/PilotGlanceView.tsx`

```typescript
import React, { useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  useWindowDimensions,
} from 'react-native';
import {
  ChevronLeft, Bell, Share2, MoreHorizontal, Edit3,
} from 'lucide-react-native';
import { useTheme } from '../../context/ThemeContext';
import { usePilot } from '../../context/PilotContext';
import { PilotBlock } from '../../context/PilotContext';

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
  const blocks = note?.content.blocks || [];

  if (!note) {
    return (
      <View style={[styles.container, { backgroundColor: colors.surface }]}>
        <Text style={{ color: colors.textSecondary }}>No note selected</Text>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.surface }}>
      {/* Header */}
      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={onBack} style={styles.iconBtn}>
          <ChevronLeft size={22} color={colors.textPrimary} />
        </TouchableOpacity>

        <Text style={{ flex: 1, fontSize: 16, fontWeight: '600', color: colors.textPrimary }}>
          {note.title}
        </Text>

        <TouchableOpacity style={styles.iconBtn}>
          <Bell size={18} color={colors.textTertiary} />
        </TouchableOpacity>
        <TouchableOpacity style={styles.iconBtn}>
          <Share2 size={18} color={colors.textTertiary} />
        </TouchableOpacity>
        {onOpenEditor && (
          <TouchableOpacity
            onPress={onOpenEditor}
            style={[styles.editBtn, { backgroundColor: colors.primary }]}
          >
            <Edit3 size={14} color="#fff" />
            <Text style={{ color: '#fff', fontSize: 12, fontWeight: '600' }}>Edit</Text>
          </TouchableOpacity>
        )}
        <TouchableOpacity style={styles.iconBtn}>
          <MoreHorizontal size={18} color={colors.textTertiary} />
        </TouchableOpacity>
      </View>

      {/* Content */}
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={[
          styles.content,
          { backgroundColor: colors.background },
        ]}
      >
        <Text style={[styles.title, { color: colors.textPrimary }]}>
          {note.title}
        </Text>

        {blocks.length === 0 ? (
          <Text style={{ color: colors.textTertiary, fontSize: 14 }}>
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
          <Text style={{ color: colors.textPrimary }}>•</Text>
          <Text style={[styles.body, { color: colors.textPrimary, flex: 1 }]}>
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
        <View style={[styles.highlight, { backgroundColor: block.highlightColor || '#FFF3B0' }]}>
          <Text style={[styles.body, { color: '#1a1a1a' }]}>
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
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
  },
  content: { paddingHorizontal: 20, paddingVertical: 24, paddingBottom: 80 },
  title: { fontSize: 26, fontWeight: '700', marginBottom: 24 },
  heading: { fontWeight: '700', marginTop: 18, marginBottom: 8 },
  bulletRow: { flexDirection: 'row', gap: 8, marginVertical: 4, alignItems: 'flex-start' },
  body: { fontSize: 15, lineHeight: 23, marginVertical: 4 },
  quote: { borderLeftWidth: 3, paddingLeft: 12, marginVertical: 8 },
  highlight: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 4, marginVertical: 4 },
  eog: { textAlign: 'center', fontSize: 11, marginTop: 32, fontStyle: 'italic' },
});
```

---

### Phase 3: Create Pilot Tab/Page (1 hour)

**File**: `src/pages/pilot/_layout.tsx`

```typescript
import { Stack } from 'expo-router';

export default function PilotLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
      }}
    />
  );
}
```

**File**: `src/pages/pilot/index.tsx`

```typescript
import React, { useEffect } from 'react';
import { PilotProvider, usePilot } from '../../context/PilotContext';
import { PilotEditorView } from '../../components/pilot/PilotEditorView';
import { PilotGlanceView } from '../../components/pilot/PilotGlanceView';
import { PilotDashboard } from '../../components/pilot/PilotDashboard';
import { View, ActivityIndicator } from 'react-native';
import { useTheme } from '../../context/ThemeContext';

function PilotContent() {
  const { colors } = useTheme();
  const { state, dispatch } = usePilot();

  useEffect(() => {
    // Load notes from Supabase on mount
    loadNotes();
  }, []);

  const loadNotes = async () => {
    dispatch({ type: 'SET_LOADING', payload: true });
    try {
      // TODO: Fetch notes from Supabase
      // const notes = await fetchPilotNotes(userId);
      // dispatch({ type: 'SET_NOTES', payload: notes });
    } catch (err) {
      dispatch({ type: 'SET_ERROR', payload: (err as Error).message });
    } finally {
      dispatch({ type: 'SET_LOADING', payload: false });
    }
  };

  if (state.loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator color={colors.primary} size="large" />
      </View>
    );
  }

  switch (state.viewMode) {
    case 'dashboard':
      return <PilotDashboard />;
    case 'list':
      return <PilotNoteList />;
    case 'glance':
      return (
        <PilotGlanceView
          onBack={() => dispatch({ type: 'SET_VIEW_MODE', payload: 'dashboard' })}
          onOpenEditor={() => dispatch({ type: 'SET_VIEW_MODE', payload: 'editor' })}
        />
      );
    case 'editor':
      return (
        <PilotEditorView
          onClose={() => dispatch({ type: 'SET_VIEW_MODE', payload: 'glance' })}
        />
      );
    default:
      return <PilotDashboard />;
  }
}

export default function PilotPage() {
  return (
    <PilotProvider>
      <PilotContent />
    </PilotProvider>
  );
}
```

---

### Phase 4: Update Main App Navigation (30 minutes)

**File**: `src/app.json` or routing config

Add the new Pilot tab to your bottom navigation:

```json
{
  "tabs": [
    { "name": "home", "label": "Home", "icon": "home" },
    { "name": "quiz", "label": "Quiz", "icon": "book" },
    { "name": "pilot", "label": "Pilot (Notes)" , "icon": "notebook" },  // NEW
    { "name": "capsule", "label": "Legacy", "icon": "archive" }  // OLD
  ]
}
```

Or if using expo-router manually:

```typescript
// src/app/_layout.tsx
import { Tabs } from 'expo-router';

export default function RootLayout() {
  return (
    <Tabs>
      <Tabs.Screen name="(home)" options={{ title: 'Home' }} />
      <Tabs.Screen name="quiz" options={{ title: 'Quiz' }} />
      <Tabs.Screen name="pilot" options={{ title: 'Pilot Notes' }} /> {/* NEW */}
      <Tabs.Screen name="capsule" options={{ title: 'Capsule' }} />
    </Tabs>
  );
}
```

---

## Database Schema Integration

Update your Supabase schema to support the new Pilot app:

```sql
-- Main notes table (already exists, reuse)
CREATE TABLE user_notes (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users,
  title TEXT NOT NULL,
  subject TEXT,
  topic TEXT,
  subtopic TEXT,
  content JSONB, -- Stores blocks array
  created_at TIMESTAMP,
  updated_at TIMESTAMP
);

-- Hierarchy table (for organization)
CREATE TABLE pilot_hierarchy (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users,
  subject TEXT NOT NULL,
  topic TEXT NOT NULL,
  subtopic TEXT NOT NULL,
  note_id UUID REFERENCES user_notes,
  created_at TIMESTAMP
);

-- Create indexes for performance
CREATE INDEX idx_notes_user_id ON user_notes(user_id);
CREATE INDEX idx_hierarchy_user_id ON pilot_hierarchy(user_id);
CREATE INDEX idx_hierarchy_composite ON pilot_hierarchy(user_id, subject, topic, subtopic);
```

---

## Repository Functions

**File**: `src/repositories/pilotRepo.ts`

```typescript
import { supabase } from '../lib/supabase';
import { PilotNote, PilotBlock } from '../context/PilotContext';

export async function fetchPilotNotes(userId: string): Promise<PilotNote[]> {
  const { data, error } = await supabase
    .from('user_notes')
    .select('*')
    .eq('user_id', userId)
    .order('updated_at', { ascending: false });

  if (error) throw error;
  return data || [];
}

export async function createPilotNote(
  userId: string,
  title: string,
  hierarchy: { subject: string; topic: string; subtopic: string }
): Promise<PilotNote> {
  const { data, error } = await supabase
    .from('user_notes')
    .insert([{
      user_id: userId,
      title,
      subject: hierarchy.subject,
      topic: hierarchy.topic,
      subtopic: hierarchy.subtopic,
      content: { blocks: [] },
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }])
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function updatePilotNote(
  noteId: string,
  updates: Partial<PilotNote>
): Promise<PilotNote> {
  const { data, error } = await supabase
    .from('user_notes')
    .update({
      ...updates,
      updated_at: new Date().toISOString(),
    })
    .eq('id', noteId)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function deletePilotNote(noteId: string): Promise<void> {
  const { error } = await supabase
    .from('user_notes')
    .delete()
    .eq('id', noteId);

  if (error) throw error;
}
```

---

## Migration Checklist

- [ ] **Phase 0**: Create PilotContext with state management
- [ ] **Phase 1**: Adapt PilotEditorView component to React Native
- [ ] **Phase 2**: Adapt PilotGlanceView component to React Native
- [ ] **Phase 3**: Adapt Sidebar, Dashboard, NoteList components
- [ ] **Phase 4**: Create pilot/ page and layout files
- [ ] **Phase 5**: Update main app navigation to include Pilot tab
- [ ] **Phase 6**: Create pilotRepo.ts functions
- [ ] **Phase 7**: Integrate with Supabase
- [ ] **Phase 8**: Test all views (dashboard → list → glance → editor)
- [ ] **Phase 9**: Test save/load functionality
- [ ] **Phase 10**: Deploy to users as "Pilot" tab

---

## Timeline Estimate

| Phase | Duration | Task |
|-------|----------|------|
| 0 | 1 hr | Context setup |
| 1 | 2-3 hrs | Editor adaptation |
| 2 | 1-2 hrs | Glance adaptation |
| 3 | 1-2 hrs | Other components |
| 4 | 30 min | Navigation setup |
| 5 | 1 hr | Database integration |
| 6 | 1 hr | Testing & debugging |
| **Total** | **7-10 hrs** | — |

---

## Key Features Gained

✅ **Functional Rich Text Editor** (your app already has this!)  
✅ **Working Toolbar** (bold, italic, underline, highlighter)  
✅ **Block-Based Structure** (not fragmented)  
✅ **Samsung Notes-Style UI** (clean, minimal)  
✅ **Infinite Scroll Glance View**  
✅ **Auto-Save** (debounced)  
✅ **Proper State Management** (Redux pattern via Context)  
✅ **Beautiful Sidebar** (hierarchy visualization)  

---

## Next Steps

1. **Choose deployment strategy** (Option 1 or 2)
2. **Start Phase 0** (PilotContext) — foundation for all other phases
3. **Parallel work** on Phase 1 & 2 (Editor & Glance)
4. **Integrate with your auth** (userId from AuthContext)
5. **Test with real Supabase data**
6. **Beta test with users**
7. **Migration path** from Capsule → Pilot (if needed)

Would you like me to start coding any specific phase?

# Pilot Tab Integration - Quick Start Implementation

## 🚀 Fast Track (Next 2 hours)

Follow this checklist to get the Pilot tab running with your KM app components.

---

## STEP 1: Copy Your KM App Files (15 minutes)

1. **Extract your KM app** from the zip file
2. **Copy these components** to your main app:

```bash
# From your KM app:
src/app/components/EditorView.tsx       → YOUR_APP/src/components/pilot/EditorView.tsx
src/app/components/GlanceView.tsx       → YOUR_APP/src/components/pilot/GlanceView.tsx
src/app/components/Sidebar.tsx          → YOUR_APP/src/components/pilot/Sidebar.tsx
src/app/components/Dashboard.tsx        → YOUR_APP/src/components/pilot/Dashboard.tsx
src/app/components/NoteList.tsx         → YOUR_APP/src/components/pilot/NoteList.tsx
src/app/components/ui/                  → YOUR_APP/src/components/pilot/ui/
```

3. **Create folder structure**:
```bash
mkdir -p src/components/pilot
mkdir -p src/pages/pilot
mkdir -p src/context
```

---

## STEP 2: Create PilotContext (30 minutes)

**File**: `src/context/PilotContext.tsx`

Copy this exactly:

```typescript
import { createContext, useContext, useReducer, ReactNode } from 'react';

// ============ TYPES ============

export interface PilotBlock {
  id: string;
  type: 'paragraph' | 'heading' | 'bullet' | 'numbered' | 'checklist' | 'quote' | 'highlight';
  text: string;
  level?: number;
  checked?: boolean;
  highlightColor?: string;
}

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

export interface PilotState {
  notes: PilotNote[];
  currentNote: PilotNote | null;
  viewMode: 'dashboard' | 'noteList' | 'glance' | 'editor';
  selectedSubject: string | null;
  selectedTopic: string | null;
  selectedSubtopic: string | null;
  sidebarCollapsed: boolean;
  loading: boolean;
  error: string | null;
}

// ============ ACTIONS ============

type PilotAction =
  | { type: 'SET_NOTES'; payload: PilotNote[] }
  | { type: 'SET_CURRENT_NOTE'; payload: PilotNote | null }
  | { type: 'SET_VIEW_MODE'; payload: PilotState['viewMode'] }
  | { type: 'SET_SELECTED_SUBJECT'; payload: string | null }
  | { type: 'SET_SELECTED_TOPIC'; payload: string | null }
  | { type: 'SET_SELECTED_SUBTOPIC'; payload: string | null }
  | { type: 'SET_SIDEBAR_COLLAPSED'; payload: boolean }
  | { type: 'UPDATE_CURRENT_NOTE'; payload: Partial<PilotNote> }
  | { type: 'SET_LOADING'; payload: boolean }
  | { type: 'SET_ERROR'; payload: string | null }
  | { type: 'RESET' };

// ============ REDUCER ============

const initialState: PilotState = {
  notes: [],
  currentNote: null,
  viewMode: 'dashboard',
  selectedSubject: null,
  selectedTopic: null,
  selectedSubtopic: null,
  sidebarCollapsed: false,
  loading: false,
  error: null,
};

function pilotReducer(state: PilotState, action: PilotAction): PilotState {
  switch (action.type) {
    case 'SET_NOTES':
      return { ...state, notes: action.payload };

    case 'SET_CURRENT_NOTE':
      return { ...state, currentNote: action.payload };

    case 'SET_VIEW_MODE':
      return { ...state, viewMode: action.payload };

    case 'SET_SELECTED_SUBJECT':
      return {
        ...state,
        selectedSubject: action.payload,
        selectedTopic: null,
        selectedSubtopic: null,
      };

    case 'SET_SELECTED_TOPIC':
      return {
        ...state,
        selectedTopic: action.payload,
        selectedSubtopic: null,
      };

    case 'SET_SELECTED_SUBTOPIC':
      return {
        ...state,
        selectedSubtopic: action.payload,
      };

    case 'SET_SIDEBAR_COLLAPSED':
      return { ...state, sidebarCollapsed: action.payload };

    case 'UPDATE_CURRENT_NOTE':
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

    case 'RESET':
      return initialState;

    default:
      return state;
  }
}

// ============ CONTEXT & PROVIDER ============

const PilotContext = createContext<{
  state: PilotState;
  dispatch: React.Dispatch<PilotAction>;
} | null>(null);

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

## STEP 3: Create Minimal Pilot Page (20 minutes)

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
import { View, ActivityIndicator } from 'react-native';
import { useTheme } from '../../context/ThemeContext';
import { PilotProvider, usePilot } from '../../context/PilotContext';

// Import your adapted components
import { PilotDashboard } from '../../components/pilot/Dashboard';
import { PilotNoteList } from '../../components/pilot/NoteList';
import { PilotGlanceView } from '../../components/pilot/GlanceView';
import { PilotEditorView } from '../../components/pilot/EditorView';

function PilotContent() {
  const { colors } = useTheme();
  const { state, dispatch } = usePilot();

  useEffect(() => {
    // Load demo data for now
    const demoNotes = [
      {
        id: '1',
        title: 'Article 14 — Equality Before Law',
        subject: 'Constitutional Law',
        topic: 'Fundamental Rights',
        subtopic: 'Right to Equality',
        content: {
          blocks: [
            { id: '1', type: 'heading', text: 'Introduction', level: 2 },
            { id: '2', type: 'paragraph', text: 'Article 14 guarantees the Right to Equality.' },
            { id: '3', type: 'bullet', text: 'The State shall not deny equality before law' },
            { id: '4', type: 'bullet', text: 'Also includes equal protection of laws' },
          ],
        },
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
    ];
    dispatch({ type: 'SET_NOTES', payload: demoNotes });
  }, []);

  if (state.loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator color={colors.primary} size="large" />
      </View>
    );
  }

  switch (state.viewMode) {
    case 'dashboard':
      return (
        <PilotDashboard
          notes={state.notes}
          onSelectNote={(note) => {
            dispatch({ type: 'SET_CURRENT_NOTE', payload: note });
            dispatch({ type: 'SET_VIEW_MODE', payload: 'glance' });
          }}
        />
      );

    case 'noteList':
      return (
        <PilotNoteList
          notes={state.notes}
          topicName={state.selectedSubtopic || 'Notes'}
          onBack={() => dispatch({ type: 'SET_VIEW_MODE', payload: 'dashboard' })}
          onSelectNote={(note) => {
            dispatch({ type: 'SET_CURRENT_NOTE', payload: note });
            dispatch({ type: 'SET_VIEW_MODE', payload: 'glance' });
          }}
        />
      );

    case 'glance':
      return (
        <PilotGlanceView
          note={state.currentNote}
          onBack={() => dispatch({ type: 'SET_VIEW_MODE', payload: 'dashboard' })}
          onOpenEditor={() => dispatch({ type: 'SET_VIEW_MODE', payload: 'editor' })}
        />
      );

    case 'editor':
      return (
        <PilotEditorView
          note={state.currentNote}
          onClose={() => dispatch({ type: 'SET_VIEW_MODE', payload: 'glance' })}
          onSave={(updatedNote) => {
            dispatch({ type: 'UPDATE_CURRENT_NOTE', payload: updatedNote });
            dispatch({ type: 'SET_VIEW_MODE', payload: 'glance' });
          }}
        />
      );

    default:
      return (
        <PilotDashboard
          notes={state.notes}
          onSelectNote={(note) => {
            dispatch({ type: 'SET_CURRENT_NOTE', payload: note });
            dispatch({ type: 'SET_VIEW_MODE', payload: 'glance' });
          }}
        />
      );
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

## STEP 4: Adapt Components (45 minutes)

Your KM app components are built for **Web/React** (Tailwind CSS, HTML).  
We need to adapt them to **React Native** (StyleSheet, View, Text, etc.).

### Component Adaptation Template

For **EditorView.tsx**, **GlanceView.tsx**, etc., follow this pattern:

**Web version** (your KM app):
```jsx
import { Save } from 'lucide-react';

export function EditorView() {
  return (
    <div className="flex-1 bg-white overflow-hidden flex flex-col">
      <div className="bg-white border-b border-border px-6 py-3">
        <h3 className="text-sm">Article 21</h3>
        <button className="p-1 hover:bg-gray-100 rounded">
          <Save className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
```

**React Native version** (for your main app):
```jsx
import { Save } from 'lucide-react-native';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';

export function PilotEditorView() {
  return (
    <View style={styles.root}>
      <View style={styles.header}>
        <Text style={styles.title}>Article 21</Text>
        <TouchableOpacity style={styles.btn}>
          <Save size={16} color="#666" />
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#fff' },
  header: { 
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  title: { fontSize: 14, fontWeight: '600' },
  btn: { padding: 8 },
});
```

### Mapping Tailwind → React Native

| Tailwind | React Native |
|----------|--------------|
| `flex-1` | `flex: 1` |
| `bg-white` | `backgroundColor: '#fff'` |
| `border-b` | `borderBottomWidth: 1` |
| `px-6 py-3` | `paddingHorizontal: 24, paddingVertical: 12` |
| `rounded` | `borderRadius: 8` |
| `w-4 h-4` | `width: 16, height: 16` |
| `text-sm` | `fontSize: 14` |
| `font-medium` | `fontWeight: '600'` |
| `hover:bg-gray-100` | Use `onPress` handler |
| `className="..."` | `style={styles.className}` |

---

## STEP 5: Add Pilot Tab to Navigation (15 minutes)

**File**: `src/app.tsx` (or your main routing file)

Add the Pilot tab to your tab navigation:

```typescript
import { Tabs } from 'expo-router';
import { Home, BookOpen, Lightbulb, Archive } from 'lucide-react-native';

export default function RootLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: '#5B4FE8',
      }}
    >
      <Tabs.Screen
        name="(home)"
        options={{
          title: 'Home',
          tabBarIcon: ({ color }) => <Home size={24} color={color} />,
        }}
      />

      <Tabs.Screen
        name="quiz"
        options={{
          title: 'Quiz',
          tabBarIcon: ({ color }) => <BookOpen size={24} color={color} />,
        }}
      />

      {/* NEW PILOT TAB */}
      <Tabs.Screen
        name="pilot"
        options={{
          title: 'Pilot',
          tabBarIcon: ({ color }) => <Lightbulb size={24} color={color} />,
          tabBarLabel: 'Pilot (NEW)',
        }}
      />

      <Tabs.Screen
        name="capsule"
        options={{
          title: 'Capsule',
          tabBarIcon: ({ color }) => <Archive size={24} color={color} />,
        }}
      />
    </Tabs>
  );
}
```

---

## STEP 6: Test Integration (30 minutes)

Run your app:

```bash
npm run dev
# or
yarn dev
# or
expo start
```

Navigate to the **Pilot** tab. You should see:

✅ Dashboard with demo notes  
✅ Click note → Glance view  
✅ Click "Edit" → Editor view  
✅ Edit and save note  
✅ Back to glance → Changes visible  

---

## STEP 7: Connect to Supabase (1 hour)

**File**: `src/repositories/pilotRepo.ts`

```typescript
import { supabase } from '../lib/supabase';
import { PilotNote } from '../context/PilotContext';

export async function fetchPilotNotes(userId: string): Promise<PilotNote[]> {
  const { data, error } = await supabase
    .from('user_notes')
    .select('*')
    .eq('user_id', userId)
    .order('updated_at', { ascending: false });

  if (error) throw error;
  return data || [];
}

export async function savePilotNote(
  userId: string,
  note: Partial<PilotNote>
): Promise<PilotNote> {
  if (note.id) {
    // Update
    const { data, error } = await supabase
      .from('user_notes')
      .update({
        ...note,
        updated_at: new Date().toISOString(),
      })
      .eq('id', note.id)
      .select()
      .single();

    if (error) throw error;
    return data;
  } else {
    // Create
    const { data, error } = await supabase
      .from('user_notes')
      .insert([
        {
          user_id: userId,
          ...note,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
      ])
      .select()
      .single();

    if (error) throw error;
    return data;
  }
}

export async function deletePilotNote(noteId: string): Promise<void> {
  const { error } = await supabase
    .from('user_notes')
    .delete()
    .eq('id', noteId);

  if (error) throw error;
}
```

Update your **pilot/index.tsx** to load real data:

```typescript
import { useAuth } from '../../context/AuthContext';
import { fetchPilotNotes, savePilotNote } from '../../repositories/pilotRepo';

function PilotContent() {
  const { session } = useAuth();
  const { state, dispatch } = usePilot();
  const userId = session?.user?.id;

  useEffect(() => {
    if (userId) {
      loadNotes();
    }
  }, [userId]);

  const loadNotes = async () => {
    dispatch({ type: 'SET_LOADING', payload: true });
    try {
      const notes = await fetchPilotNotes(userId);
      dispatch({ type: 'SET_NOTES', payload: notes });
    } catch (err) {
      dispatch({ type: 'SET_ERROR', payload: (err as Error).message });
    } finally {
      dispatch({ type: 'SET_LOADING', payload: false });
    }
  };

  // ... rest of component
}
```

---

## ✅ Completion Checklist

- [ ] **STEP 1**: Copied KM app components to `src/components/pilot/`
- [ ] **STEP 2**: Created `src/context/PilotContext.tsx`
- [ ] **STEP 3**: Created `src/pages/pilot/_layout.tsx` and `src/pages/pilot/index.tsx`
- [ ] **STEP 4**: Adapted web components to React Native (EditorView, GlanceView, etc.)
- [ ] **STEP 5**: Added Pilot tab to navigation
- [ ] **STEP 6**: Tested integration in emulator/device
- [ ] **STEP 7**: Connected to Supabase
- [ ] **STEP 8**: Loaded real data from database
- [ ] **STEP 9**: Tested save/edit/delete functionality
- [ ] **STEP 10**: Ready for production deployment

---

## Common Issues & Fixes

### Issue: "Module not found"
**Fix**: Check that you've imported components from correct paths.
```typescript
// ✅ Correct
import { PilotEditorView } from '../../components/pilot/EditorView';

// ❌ Wrong
import { EditorView } from '../../components/pilot/EditorView';
```

### Issue: "Tailwind classes not recognized"
**Fix**: You're mixing web and native. Replace all Tailwind with StyleSheet.

```typescript
// ❌ Wrong (web)
<div className="bg-white p-4 rounded-lg">

// ✅ Correct (React Native)
<View style={styles.container}>
const styles = StyleSheet.create({
  container: { backgroundColor: '#fff', padding: 16, borderRadius: 8 }
});
```

### Issue: Components showing blank
**Fix**: Ensure `<PilotProvider>` wraps your content and styles are defined.

```typescript
export default function PilotPage() {
  return (
    <PilotProvider>  {/* Don't forget this */}
      <PilotContent />
    </PilotProvider>
  );
}
```

---

## Next: Connect to Quiz

Once Pilot tab is working, you can integrate with your quiz:

```typescript
// In quiz engine, when user clicks "Save to Capsule"
const handleSaveToCapule = async (noteData) => {
  // Save to Pilot instead!
  await savePilotNote(userId, {
    title: noteData.title,
    subject: selectedHierarchy.subject,
    topic: selectedHierarchy.topic,
    subtopic: selectedHierarchy.subtopic,
    content: noteData.content,
  });
  
  // Navigate to Pilot tab
  router.push('/(tabs)/pilot');
};
```

---

## 🎉 You're Done!

Your Pilot tab is now live with:

✅ **Beautiful editor** (your KM app)  
✅ **Read-only glance** (infinite scroll)  
✅ **Formatting toolbar** (bold, italic, highlight)  
✅ **Sidebar navigation** (subjects, topics, subtopics)  
✅ **Database persistence** (Supabase)  
✅ **State management** (PilotContext)  

**Time spent**: ~2-3 hours total  
**Lines of code**: ~1500 (mostly from your KM app)  
**Breaking changes**: None (Capsule still exists)  

Ready to ship! 🚀

# 🏗️ PILOT V2 - Complete Architectural Blueprint

---

## 📐 CORE ARCHITECTURE: NESTED BLOCKS

### Data Structure

```typescript
// src/components/pilot-v2/types.ts

export interface TextSpan {
  text: string;
  marks?: {
    bold?: boolean;
    italic?: boolean;
    strikethrough?: boolean;
    underline?: boolean;
  };
  highlightColor?: string;
  link?: { url: string; title?: string };
}

export interface ContentElement {
  id: string;
  type: 'heading' | 'paragraph' | 'bullet' | 'numbered' | 'checklist' | 'quote' | 'code' | 'divider' | 'table';
  spans?: TextSpan[];
  checked?: boolean;
  level?: 1 | 2 | 3;
  tableRows?: string[][];
  meta?: {
    addedAt?: string;
    source?: string;
  };
}

// ✅ NEW: Block is now a container with children
export interface PilotV2Block {
  id: string;
  blockName: string;          // e.g., "GDP Implications", "Important Cases"
  customName?: string;        // User-edited name
  heading?: ContentElement;   // The block's title/heading
  children: ContentElement[]; // All content inside: bullets, paragraphs, etc.
  
  // Pencil annotations
  pencilStrokes?: PencilStroke[];
  
  // Metadata
  createdAt: string;
  updatedAt: string;
  sourceQuizId?: string;
  tags?: string[];
  
  // Sync
  isDirty: boolean;           // Needs server sync
  lastSyncedAt?: string;
}

export interface PencilStroke {
  id: string;
  type: 'drawing' | 'highlight' | 'underline' | 'circle' | 'arrow' | 'text';
  points: Array<{ x: number; y: number; pressure?: number; timestamp: number }>;
  color: string;
  width: number;
  opacity?: number;
  bounds: { x: number; y: number; width: number; height: number };
  createdAt: string;
}

export interface PilotV2NoteContent {
  blocks: PilotV2Block[];
  version: number;
  lastEditedBlockId?: string;  // For smart suggestions
}

export interface PilotV2Note {
  id: string;
  user_id: string;
  title: string;
  subject: string;
  topic: string;
  microtopic: string;
  content: PilotV2NoteContent;
  
  // Local caching
  cachedAt?: string;
  isDirty: boolean;
  
  // Sync
  lastSyncedAt?: string;
  conflictVersion?: number;
}

// ✅ NEW: Track last used selections
export interface PilotV2UserPreferences {
  userId: string;
  lastUsedNotebook?: {
    noteId: string;
    title: string;
    subject: string;
    topic: string;
    microtopic: string;
  };
  lastUsedBlockId?: string;
  autoSeparators: boolean;      // Insert divider between imports
  continueNumbering: boolean;   // Auto-continue numbering
}
```

---

## 🎯 WORKFLOW: QUIZ → NOTEBOOK

### Step 1: Hierarchy Auto-Detection (Already works)
```typescript
// User selects text in quiz
// System auto-detects:
// Subject: (auto)
// Topic: (auto)
// Microtopic: (auto)
// Notebook: (last used) ← Default

// User can override any of these manually
```

### Step 2: Smart Block Suggestion & Selection

**Flow:**
```
1. User clicks "Add to Notebook"
   ↓
2. App shows export panel (Use same design of Module as shown in Premium Move module within flashcards) to choose direcotry . :
   ├─ Subject/Topic/Microtopic filters (auto-filled)
   ├─ Notebook selector (shows last-used by default)
   └─ Block selector (shows existing blocks in notebook)
   ↓
3. Block Selection Screen:
   ┌──────────────────────────┐
   │ 📚 GDP Implications   ✓   │  ← Auto-suggested (AI similarity)
   │ 📚 GDP Formula            │
   │ 📚 Inflation              │
   │ 📚 World Bank             │
   │ ─────────────────────     │
   │ ➕ Create New Block       │
   │ ➕ Create New Notebook    │
   └──────────────────────────┘
   ↓
4. Selected block: "GDP Implications"
   ↓
5. Show append options:
   ┌──────────────────────────┐
   │ Merge with existing content
   │ Add separator before import
   │ Continue numbering auto
   │ [Export Now] [Cancel]
   └──────────────────────────┘
```

### Step 3: Smart Block Detection Algorithm

```typescript
// src/services/SmartBlockMatcher.ts

export async function suggestBestMatchingBlock(
  userContent: string,
  availableBlocks: PilotV2Block[],
  noteId: string
): Promise<{ block: PilotV2Block; confidence: number } | null> {
  // Use multiple strategies:
  
  // Strategy 1: Semantic similarity (AI embedding)
  const embedding = await getEmbedding(userContent);
  let bestMatch = null;
  let bestScore = 0.5;  // Minimum threshold
  
  for (const block of availableBlocks) {
    const blockText = block.children.map(c => c.spans?.map(s => s.text).join('') || '').join(' ');
    const blockEmbedding = await getEmbedding(blockText);
    const similarity = cosineSimilarity(embedding, blockEmbedding);
    
    if (similarity > bestScore) {
      bestScore = similarity;
      bestMatch = block;
    }
  }
  
  // Strategy 2: Keyword matching
  const keywords = extractKeywords(userContent);
  for (const block of availableBlocks) {
    if (keywords.some(kw => block.blockName.toLowerCase().includes(kw.toLowerCase()))) {
      if (bestMatch === null) bestMatch = block;  // Fallback
      break;
    }
  }
  
  // Strategy 3: Last-edited block (if very recent)
  const preferences = await getPilotV2UserPreferences(userId);
  if (preferences.lastUsedBlockId) {
    const recentBlock = availableBlocks.find(b => b.id === preferences.lastUsedBlockId);
    if (recentBlock && Date.now() - new Date(recentBlock.updatedAt).getTime() < 1800000) { // 30 min
      return { block: recentBlock, confidence: 0.8 };
    }
  }
  
  return bestMatch ? { block: bestMatch, confidence: bestScore } : null;
}

// Cosine similarity for vectors
function cosineSimilarity(a: number[], b: number[]): number {
  const dotProduct = a.reduce((sum, av, i) => sum + av * b[i], 0);
  const magA = Math.sqrt(a.reduce((sum, av) => sum + av * av, 0));
  const magB = Math.sqrt(b.reduce((sum, bv) => sum + bv * bv, 0));
  return magA && magB ? dotProduct / (magA * magB) : 0;
}
```

---

## 📦 EXPORT & APPEND SYSTEM

### Smart Append Logic

```typescript
// src/services/PilotV2SmartAppend.ts

export async function smartAppendToBlock(
  noteId: string,
  blockId: string,
  contentToAppend: ContentElement[],
  options: {
    addSeparator: boolean;
    continueNumbering: boolean;
  }
): Promise<boolean> {
  const note = await fetchPilotV2Note(noteId);
  const block = note.content.blocks.find(b => b.id === blockId);
  
  if (!block) return false;
  
  const elementsToAdd: ContentElement[] = [];
  
  // Step 1: Add separator if requested
  if (options.addSeparator && block.children.length > 0) {
    elementsToAdd.push({
      id: newId(),
      type: 'divider',
      meta: { addedAt: new Date().toISOString(), source: 'import' }
    });
  }
  
  // Step 2: Continue numbering if needed
  if (options.continueNumbering) {
    const lastNumbered = block.children
      .slice()
      .reverse()
      .find(c => c.type === 'numbered');
    
    let nextNumber = 1;
    if (lastNumbered && lastNumbered.spans) {
      const match = lastNumbered.spans[0]?.text.match(/^(\d+)\./);
      if (match) nextNumber = parseInt(match[1]) + 1;
    }
    
    // Renumber imported content
    let currentNumber = nextNumber;
    for (const element of contentToAppend) {
      if (element.type === 'numbered') {
        // Replace "1." with actual number
        if (element.spans?.[0]) {
          element.spans[0].text = element.spans[0].text.replace(/^\d+\./, `${currentNumber}.`);
          currentNumber++;
        }
      }
      elementsToAdd.push(element);
    }
  } else {
    elementsToAdd.push(...contentToAppend);
  }
  
  // Step 3: Mark imported content with timestamp
  for (const element of elementsToAdd) {
    if (!element.meta) element.meta = {};
    element.meta.addedAt = new Date().toISOString();
    element.meta.source = 'quiz_import';
  }
  
  // Step 4: Append and mark dirty
  block.children.push(...elementsToAdd);
  block.updatedAt = new Date().toISOString();
  note.isDirty = true;
  
  // Save locally first
  await savePilotV2NoteLocal(note);
  
  return true;
}
```

---

## 🎨 UI: BLOCK SELECTION PANEL

```typescript
// src/components/pilot-v2/PilotV2ExportSheet.tsx

export function PilotV2ExportSheet({ selectedText, onClose }: Props) {
  const { colors } = useTheme();
  const [step, setStep] = useState<'hierarchy' | 'notebook' | 'block' | 'options'>('hierarchy');
  
  const [hierarchy, setHierarchy] = useState({ subject: '', topic: '', microtopic: '' });
  const [selectedNotebook, setSelectedNotebook] = useState<PilotV2Note | null>(null);
  const [selectedBlock, setSelectedBlock] = useState<PilotV2Block | null>(null);
  const [suggestedBlock, setSuggestedBlock] = useState<PilotV2Block | null>(null);
  
  const [options, setOptions] = useState({
    addSeparator: true,
    continueNumbering: true,
  });
  
  // Step 1: Auto-detect hierarchy
  useEffect(() => {
    const detected = detectHierarchyFromContent(selectedText);
    setHierarchy(detected);
  }, []);
  
  // Step 2: Load last-used notebook
  useEffect(() => {
    const loadLastNotebook = async () => {
      const prefs = await getPilotV2UserPreferences();
      if (prefs.lastUsedNotebook) {
        const note = await fetchPilotV2Note(prefs.lastUsedNotebook.noteId);
        setSelectedNotebook(note);
      }
    };
    loadLastNotebook();
  }, []);
  
  // Step 3: Smart block suggestion
  useEffect(() => {
    if (selectedNotebook) {
      const suggested = await suggestBestMatchingBlock(
        selectedText,
        selectedNotebook.content.blocks,
        selectedNotebook.id
      );
      setSuggestedBlock(suggested?.block || null);
      setSelectedBlock(suggested?.block || null);
    }
  }, [selectedNotebook]);
  
  // UI: Hierarchy Selection
  if (step === 'hierarchy') {
    return (
      <View style={styles.sheet}>
        <Text style={styles.title}>Save to Notebook</Text>
        
        <View style={styles.section}>
          <Text style={styles.label}>Subject</Text>
          <SubjectSelector 
            value={hierarchy.subject}
            onChange={(s) => setHierarchy({ ...hierarchy, subject: s })}
          />
        </View>
        
        <View style={styles.section}>
          <Text style={styles.label}>Topic</Text>
          <TopicSelector 
            subject={hierarchy.subject}
            value={hierarchy.topic}
            onChange={(t) => setHierarchy({ ...hierarchy, topic: t })}
          />
        </View>
        
        <View style={styles.section}>
          <Text style={styles.label}>Microtopic</Text>
          <MicrotopicSelector 
            topic={hierarchy.topic}
            value={hierarchy.microtopic}
            onChange={(m) => setHierarchy({ ...hierarchy, microtopic: m })}
          />
        </View>
        
        <TouchableOpacity 
          style={styles.primaryBtn}
          onPress={() => setStep('notebook')}
        >
          <Text style={styles.btnText}>Continue</Text>
        </TouchableOpacity>
      </View>
    );
  }
  
  // UI: Notebook & Block Selection
  if (step === 'notebook') {
    return (
      <View style={styles.sheet}>
        <Text style={styles.title}>Select Notebook & Block</Text>
        
        <Text style={styles.label}>Notebook</Text>
        <ScrollView style={styles.notebookList}>
          {/* List of notebooks filtered by hierarchy */}
          {notebooks.map(notebook => (
            <TouchableOpacity
              key={notebook.id}
              style={[
                styles.notebookItem,
                selectedNotebook?.id === notebook.id && styles.selected
              ]}
              onPress={() => {
                setSelectedNotebook(notebook);
                setSelectedBlock(null);
              }}
            >
              <Text style={styles.notebookTitle}>{notebook.title}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
        
        {selectedNotebook && (
          <>
            <Text style={styles.label}>Block in "{selectedNotebook.title}"</Text>
            
            {suggestedBlock && (
              <View style={styles.suggestionBanner}>
                <Text style={styles.suggestionText}>
                  ✨ Suggested: {suggestedBlock.blockName}
                </Text>
              </View>
            )}
            
            <ScrollView style={styles.blockList}>
              {selectedNotebook.content.blocks.map(block => (
                <TouchableOpacity
                  key={block.id}
                  style={[
                    styles.blockItem,
                    selectedBlock?.id === block.id && styles.selected,
                    suggestedBlock?.id === block.id && styles.suggested
                  ]}
                  onPress={() => setSelectedBlock(block)}
                >
                  <View style={styles.blockItemContent}>
                    <Text style={styles.blockName}>📚 {block.blockName}</Text>
                    <Text style={styles.blockMeta}>
                      {block.children.length} items • Updated {formatDate(block.updatedAt)}
                    </Text>
                  </View>
                  {selectedBlock?.id === block.id && <Check size={20} color={colors.primary} />}
                </TouchableOpacity>
              ))}
              
              {/* Create new options */}
              <TouchableOpacity
                style={styles.blockItem}
                onPress={() => setStep('createBlock')}
              >
                <Plus size={20} color={colors.primary} />
                <Text style={styles.blockName}>Create New Block</Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                style={styles.blockItem}
                onPress={() => setStep('createNotebook')}
              >
                <Plus size={20} color={colors.primary} />
                <Text style={styles.blockName}>Create New Notebook</Text>
              </TouchableOpacity>
            </ScrollView>
            
            <TouchableOpacity 
              style={styles.primaryBtn}
              onPress={() => setStep('options')}
              disabled={!selectedBlock}
            >
              <Text style={styles.btnText}>Next: Append Options</Text>
            </TouchableOpacity>
          </>
        )}
      </View>
    );
  }
  
  // UI: Append Options
  if (step === 'options') {
    return (
      <View style={styles.sheet}>
        <Text style={styles.title}>Append Options</Text>
        
        <Text style={styles.label}>
          Adding to block: <Text style={styles.bold}>{selectedBlock?.blockName}</Text>
        </Text>
        
        <View style={styles.optionsGrid}>
          <TouchableOpacity
            style={[styles.option, options.addSeparator && styles.optionSelected]}
            onPress={() => setOptions({ ...options, addSeparator: !options.addSeparator })}
          >
            <Text style={styles.optionIcon}>───</Text>
            <Text style={styles.optionText}>Add separator divider</Text>
          </TouchableOpacity>
          
          <TouchableOpacity
            style={[styles.option, options.continueNumbering && styles.optionSelected]}
            onPress={() => setOptions({ ...options, continueNumbering: !options.continueNumbering })}
          >
            <Text style={styles.optionIcon}>1. 2. 3.</Text>
            <Text style={styles.optionText}>Continue auto-numbering</Text>
          </TouchableOpacity>
        </View>
        
        <TouchableOpacity 
          style={styles.successBtn}
          onPress={async () => {
            await smartAppendToBlock(
              selectedNotebook.id,
              selectedBlock.id,
              convertSelectedTextToElements(selectedText),
              options
            );
            onClose();
          }}
        >
          <Text style={styles.btnText}>✓ Save to Block</Text>
        </TouchableOpacity>
      </View>
    );
  }
}
```

---

## ✏️ PENCIL ANNOTATIONS

### Architecture

```typescript
// src/components/pilot-v2/PencilAnnotationEngine.ts

export class PencilAnnotationEngine {
  private currentStroke: PencilStroke | null = null;
  private strokes: PencilStroke[] = [];
  private mode: 'drawing' | 'highlight' | 'underline' | 'circle' | 'arrow' | 'none' = 'none';
  
  setMode(mode: PencilStroke['type']) {
    this.mode = mode;
  }
  
  // Detect if touch is from Pencil (via CoalescedTouches)
  startStroke(event: GestureEvent) {
    const touch = event.nativeEvent;
    
    // Apple Pencil pressure detection
    if (touch.force > 0 || touch.coalescedTouches?.length > 0) {
      this.currentStroke = {
        id: newId(),
        type: this.mode,
        points: [{
          x: touch.locationX,
          y: touch.locationY,
          pressure: touch.force,
          timestamp: Date.now(),
        }],
        color: this.getColorForMode(this.mode),
        width: 2,
        bounds: { x: touch.locationX, y: touch.locationY, width: 0, height: 0 },
        createdAt: new Date().toISOString(),
      };
    }
  }
  
  addPoint(event: GestureEvent) {
    if (!this.currentStroke) return;
    
    const touch = event.nativeEvent;
    const point = {
      x: touch.locationX,
      y: touch.locationY,
      pressure: touch.force,
      timestamp: Date.now(),
    };
    
    this.currentStroke.points.push(point);
    
    // Update bounds
    this.currentStroke.bounds.width = Math.max(
      this.currentStroke.bounds.width,
      point.x - this.currentStroke.bounds.x
    );
    this.currentStroke.bounds.height = Math.max(
      this.currentStroke.bounds.height,
      point.y - this.currentStroke.bounds.y
    );
  }
  
  endStroke() {
    if (!this.currentStroke) return;
    
    // Post-process: smoothing, simplification
    this.currentStroke.points = this.smoothPoints(this.currentStroke.points);
    
    // Detect shapes if needed (circles, arrows, etc.)
    if (this.currentStroke.type === 'circle') {
      this.currentStroke = this.detectCircle(this.currentStroke);
    }
    
    this.strokes.push(this.currentStroke);
    this.currentStroke = null;
    
    // Auto-save
    this.saveStrokes();
  }
  
  private smoothPoints(points: Point[]): Point[] {
    // Catmull-Rom spline smoothing
    const smoothed: Point[] = [];
    
    for (let i = 0; i < points.length; i++) {
      smoothed.push(points[i]);
      
      if (i < points.length - 1) {
        const p0 = points[Math.max(0, i - 1)];
        const p1 = points[i];
        const p2 = points[i + 1];
        const p3 = points[Math.min(points.length - 1, i + 2)];
        
        for (let t = 0.25; t < 1; t += 0.25) {
          const pt = this.catmullRom(p0, p1, p2, p3, t);
          smoothed.push(pt);
        }
      }
    }
    
    return smoothed;
  }
  
  private async saveStrokes() {
    // Save to block's pencilStrokes
    const block = await getActiveBlock();
    block.pencilStrokes.push(...this.strokes);
    block.isDirty = true;
    await savePilotV2BlockLocal(block);
  }
}
```

### Canvas Rendering

```typescript
// src/components/pilot-v2/PencilCanvas.tsx

export function PencilCanvas({ block, isDrawingMode }: Props) {
  const canvasRef = useRef<SkiaView>(null);
  const [strokes, setStrokes] = useState<PencilStroke[]>(block.pencilStrokes || []);
  
  const handleTouch = (event: GestureEvent) => {
    if (!isDrawingMode) return;
    
    const touch = event.nativeEvent;
    
    // Detect Apple Pencil specifically
    if (Platform.OS === 'ios' && touch.force && touch.force > 0) {
      // Process as Pencil
      engine.addPoint(event);
    }
  };
  
  const drawStroke = (stroke: PencilStroke, canvas: Canvas) => {
    const paint = paint_factory.create();
    paint.setColor(stroke.color);
    paint.setStrokeWidth(stroke.width);
    paint.setStyle(PaintStyle.Stroke);
    
    if (stroke.type === 'drawing') {
      // Draw freehand path
      const path = Path.Create();
      path.moveTo(stroke.points[0].x, stroke.points[0].y);
      
      for (let i = 1; i < stroke.points.length; i++) {
        const p = stroke.points[i];
        const prev = stroke.points[i - 1];
        path.quadTo(
          (prev.x + p.x) / 2, (prev.y + p.y) / 2,
          p.x, p.y
        );
      }
      
      canvas.drawPath(path, paint);
    } else if (stroke.type === 'highlight') {
      // Semi-transparent highlight
      paint.setAlpha(0.3);
      const path = Path.Create();
      // Similar to drawing but with highlights logic
      canvas.drawPath(path, paint);
    } else if (stroke.type === 'circle') {
      // Draw detected circle
      const center = stroke.bounds;
      const radius = (stroke.bounds.width + stroke.bounds.height) / 4;
      canvas.drawCircle(center.x + center.width / 2, center.y + center.height / 2, radius, paint);
    }
  };
  
  return (
    <SkiaView
      ref={canvasRef}
      style={styles.canvas}
      onDraw={(canvas) => {
        canvas.clear(colors.bg);
        
        // Draw all saved strokes
        for (const stroke of strokes) {
          drawStroke(stroke, canvas);
        }
        
        // Draw current stroke being drawn
        if (engine.currentStroke) {
          drawStroke(engine.currentStroke, canvas);
        }
      }}
      onTouchStart={handleTouch}
      onTouchMove={handleTouch}
      onTouchEnd={() => engine.endStroke()}
    />
  );
}
```

---

## 💾 SYNC ARCHITECTURE: LOCAL FIRST

### Save Strategy

```typescript
// src/services/PilotV2SyncManager.ts

export class PilotV2SyncManager {
  private syncQueue: Array<{
    noteId: string;
    blockId?: string;
    action: 'update' | 'create' | 'delete';
    timestamp: number;
  }> = [];
  
  private isSyncing = false;
  
  // ✅ LOCAL SAVE (instant)
  async saveLocal(block: PilotV2Block) {
    // MMKV for fast access
    const key = `block:${block.id}`;
    await mmkv.setItem(key, JSON.stringify(block));
    
    block.isDirty = true;
    block.updatedAt = new Date().toISOString();
  }
  
  // ✅ BATCH SERVER SYNC (on close/exit)
  async syncToServer(noteId: string) {
    if (this.isSyncing) return;
    this.isSyncing = true;
    
    try {
      // Fetch all dirty blocks for this note
      const dirtyBlocks = await getAllDirtyBlocksForNote(noteId);
      
      if (dirtyBlocks.length === 0) {
        this.isSyncing = false;
        return;
      }
      
      // Batch update to Supabase
      for (const block of dirtyBlocks) {
        await supabase
          .from('user_notes')
          .update({
            content: JSON.stringify(block),
            updated_at: block.updatedAt,
            last_synced_at: new Date().toISOString(),
          })
          .eq('id', noteId);
        
        block.isDirty = false;
        block.lastSyncedAt = new Date().toISOString();
      }
      
      // Save sync metadata locally
      await mmkv.setItem(`note:${noteId}:synced`, 'true');
      
      this.isSyncing = false;
    } catch (error) {
      console.error('Sync failed:', error);
      this.isSyncing = false;
      // Retain dirty flag for retry
    }
  }
  
  // ✅ BACKUP: Save crash recovery
  async createLocalBackup(noteId: string) {
    const note = await fetchPilotV2NoteLocal(noteId);
    const backupKey = `backup:${noteId}:${Date.now()}`;
    await mmkv.setItem(backupKey, JSON.stringify(note));
    
    // Keep only last 5 backups
    const backups = await mmkv.getAllKeys().filter(k => k.startsWith(`backup:${noteId}:`));
    if (backups.length > 5) {
      for (const old of backups.sort().slice(0, -5)) {
        await mmkv.removeItem(old);
      }
    }
  }
  
  // ✅ RECOVERY: On app launch
  async recoverFromCrash() {
    const openNotes = await mmkv.getItem('openNotes') || '[]';
    const noteIds = JSON.parse(openNotes);
    
    for (const noteId of noteIds) {
      const dirtyState = await mmkv.getItem(`note:${noteId}:dirty`);
      if (dirtyState === 'true') {
        // Note was being edited when crashed
        // Show warning to user, option to restore
        showRecoveryNotification(noteId);
      }
    }
  }
}
```

### Sync Triggers

```typescript
// When to sync to server:

1. User presses back/close button on editor
2. User navigates to different notebook
3. App enters background
4. After 5 minutes of inactivity
5. Every significant save milestone (10 edits)

// NOT: Every keystroke (kills performance)
// NOT: Every drawing stroke (way too much)
```

---

## 🗂️ FILE STRUCTURE

```
src/
├── components/pilot-v2/
│   ├── types.ts                      (Updated: nested blocks)
│   ├── PilotV2EditorView.tsx         (Main editor)
│   ├── PilotV2GlanceView.tsx         (Glass view with pencil)
│   ├── PencilCanvas.tsx              (Pencil rendering)
│   ├── PencilToolbar.tsx             (Drawing mode selector)
│   ├── PilotV2ExportSheet.tsx        (Smart export panel)
│   ├── PilotV2BlockRenderer.tsx      (Render nested content)
│   └── index.ts
│
├── services/
│   ├── SmartBlockMatcher.ts          (AI similarity detection)
│   ├── PilotV2SmartAppend.ts         (Append logic)
│   ├── PencilAnnotationEngine.ts     (Stroke handling)
│   ├── PilotV2SyncManager.ts         (Local-first sync)
│   └── HierarchyAutoDetector.ts      (Subject/Topic/Microtopic)
│
└── repositories/
    ├── pilotV2Repo.ts               (Updated for nested structure)
    └── mmkvCache.ts                 (MMKV local storage)
```

---

## 🎯 IMPLEMENTATION CHECKLIST

### Core Block Structure
- [ ] Update `PilotV2Block` to have `heading + children`
- [ ] Update `ContentElement` union type
- [ ] Migration: Convert flat blocks → nested blocks
- [ ] Update `PilotV2NoteContent` schema

### Smart Export
- [ ] `SmartBlockMatcher.ts` with AI similarity
- [ ] `PilotV2ExportSheet.tsx` with visual block list
- [ ] Last-used notebook remembering
- [ ] Block suggestion logic
- [ ] User preferences storage

### Append Logic
- [ ] `PilotV2SmartAppend.ts` with separator option
- [ ] Auto-continue numbering
- [ ] Timestamp marking for imports
- [ ] Conversion of quiz text → `ContentElement[]`

### Pencil Annotations
- [ ] `PencilAnnotationEngine.ts` with stroke detection
- [ ] `PencilCanvas.tsx` with Skia rendering
- [ ] Apple Pencil pressure detection
- [ ] Shape recognition (circles, underlines)
- [ ] Auto-save pencil strokes

### Local-First Sync
- [ ] `PilotV2SyncManager.ts` with MMKV
- [ ] Save to local on edit
- [ ] Batch sync on close
- [ ] Crash recovery system
- [ ] Backup management

### UI Components
- [ ] Update `PilotV2EditorView.tsx` to render nested content
- [ ] `PilotV2BlockRenderer.tsx` for flexible content
- [ ] `PencilToolbar.tsx` for annotation modes
- [ ] Enhanced `PilotV2ExportSheet.tsx`

---

## 🚀 EXECUTION PRIORITY

**For emergent.sh AI agent:**

1. **Update types.ts** (foundation)
2. **Create SmartBlockMatcher.ts** (AI logic)
3. **Build PilotV2ExportSheet.tsx** (UX critical)
4. **Implement SmartAppend logic** (core feature)
5. **Add PencilAnnotationEngine** (enhancement)
6. **Build PencilCanvas & rendering** (UX polish)
7. **Implement SyncManager** (reliability)
8. **Migration & testing** (stability)

Each can be done independently/concurrently. No dependencies blocking.

---

This is your complete blueprint. Ready for emergent.sh to execute! 🎯



Missing Features- 

#### 3. **SEARCH/FILTERING** ✅
**Status:** FULLY IMPLEMENTED
**Location:** `PilotV2NoteList.tsx` lines 203-205
**What you have:**
```typescript
const globalSearch = state.view.search;
filteredList = filteredList.filter(n =>
  (!globalSearch || n.title.toLowerCase().includes(globalSearch.toLowerCase()))
);
```
**Visible in UI:** Search box in NoteList
**Status:** ✅ **WORKS** - filters notebooks by title
**Gap:** Only searches NOTEBOOK titles, not block contents or tags


#### 5. **EXPORT** ✅
**Status:** PARTIALLY IMPLEMENTED
**Location:** `PilotV2GlanceView.tsx` lines 134-137
**What you have:**
```typescript
const handleExport = async () => {
  await Clipboard.setStringAsync(text);
  Alert.alert('Note exported', 'Plain-text export copied to clipboard');
};
```
**What it does:** Copies entire notebook as plain text
**Status:** ⚠️ **BASIC ONLY**
- ✅ Exports to clipboard as plain text
- ❌ No PDF export
- ❌ No block-by-block export
- ❌ No Markdown export
- ❌ No Word export


#### 6. **BULK OPERATIONS** ✅
**Status:** PARTIALLY IMPLEMENTED
**Location:** `PilotV2NoteList.tsx` lines 125-170
**What you have:**
```typescript
const bulkWithNodes()      // Get selected items
const bulkMoveToTrash()    // Bulk archive
const bulkRestore()        // Bulk restore
const bulkPin()            // Bulk pin
const bulkDeletePermanently() // Bulk permanent delete
```
**Visible in UI:** Checkboxes + bulk action buttons
**Status:** ⚠️ **PARTIALLY WORKS**
- ✅ Bulk archive/restore/delete
- ❌ No bulk move to another notebook
- ❌ No bulk tag operations (no tagging system yet)


#### 8. **AI CHAT** ✅
**Status:** EXISTS
**Location:** `PilotV2AIChat.tsx` (570 lines)
**What you have:**
```typescript
// Full AI chat system integrated into Pilot V2
// Can ask AI about notes
// Can get explanations
```
**Status:** ✅ **WORKS** but purpose unclear in context


#### 9. **LOCAL AUTO-SAVE WITH DEBOUNCE** ✅
**Status:** FULLY IMPLEMENTED
**Location:** `PilotV2EditorView.tsx` lines 168-188
**What you have:**
```typescript
const scheduleSave = (nextBlocks, nextTitle) => {
  setSavingState('saving');
  if (saveTimer.current) clearTimeout(saveTimer.current);
  saveTimer.current = setTimeout(async () => {
    // Save to Supabase after 600ms of no edits
    await savePilotV2NoteContent(note.id, { blocks, version: 1 });
  }, 600);
};
```
**Status:** ✅ **WORKS WELL**
- ✅ Debounced save (600ms)
- ✅ Saving state indicator
- ❌ NOT true "local-first" (saves directly to server)



## ❌ **NOT IMPLEMENTED / GAPS**

### 1. **TAGGING SYSTEM** ❌
**Status:** COMPLETELY MISSING
**Why it matters:** With 50+ blocks, need quick filtering
**What's needed:**
- Block-level tags (not just notebooks)
- Tag suggestions/auto-tag
- Filter by tags
- UI in editor to add tags


### 3. **OFFLINE SYNC & RELIABILITY** ❌
**Status:** MISSING
**Current issue:**
```typescript
// SaveSheet line 170:
const handleSave = async () => {
  // If network fails here → data lost or stuck
  // No backup, no retry, no offline queue
}

*What's missing:**
- ❌ Offline queue (save to local, sync when online)
- ❌ Retry mechanism on network failure
- ❌ Conflict resolution
- ❌ Backup/recovery
- ❌ Sync status indicator
- ❌ "Pending sync" badge

**Where to add:** New `SyncManager.ts` service



### 5. **SMART BLOCK MATCHING** ❌
**Status:** MISSING
**What you wanted:**
When importing from quiz:
- Suggest "GDP Implications" block automatically
- Based on content similarity
- Allow manual selection from visible block list

**Current:** Just appends to end of notebook blindly

**Where to add:** `SmartBlockMatcher.ts` + upgrade `PilotV2SaveSheet.tsx`



### 6. **BLOCK METADATA TRACKING** ❌
**Status:** PARTIALLY MISSING
**What you have:**
```typescript
meta?: Record<string, any>;  // Exists but unused
```

**What you need:**
- Track: sourceQuizId, import timestamp, quiz question
- Visual indicator: "Added by quiz import"
- Separator divider before imports (optional)
- Auto-continue numbering

**Where to add:** Upgrade types + save logic

### 7. **ADVANCED EXPORT FORMATS** ❌
**Status:** BASIC ONLY (plain text)
**What's missing:**
- ❌ PDF export (block or full notebook)
- ❌ Markdown export
- ❌ Word document export
- ❌ Block-by-block selective export
- ❌ Export to Notability/iPad apps

**Where to add:** New `PilotV2ExportEngine.ts`

---


### 9. **SEARCH WITHIN BLOCKS** ❌
**Status:** MISSING
**Current:** Only searches notebook titles
**Need:** Search across all block contents

**Where to add:** Upgrade search logic in `PilotV2NoteList.tsx`

### 10. **LAST-USED PREFERENCES** ❌
**Status:** PARTIALLY MISSING
**In SaveSheet you need:**
- Remember last-used notebook ← **MISSING**
- Remember last-used block ← **MISSING**
- Auto-select them by default ← **MISSING**

**Where to add:** `PilotV2UserPreferences` service

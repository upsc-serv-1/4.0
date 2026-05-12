# Flashcard AI Feature - Component Specifications

## 1. Component: `QuickFlashcardModal.tsx`

### Purpose
Main modal interface for quick flashcard creation with AI assistance.

### Props
```typescript
interface QuickFlashcardModalProps {
  visible: boolean;
  onClose: () => void;
  onSave: (flashcard: { front: string; back: string }) => Promise<void>;
  
  // Optional: pre-fill with content
  initialFront?: string;
  initialBack?: string;
  
  // Optional: context from note
  notebookTitle?: string;
  subject?: string;
  blocks?: CapsuleBlock[]; // for multi-block selection
}
```

### State Structure
```typescript
{
  front: string;                    // Front card content
  back: string;                     // Back card content
  selectedBlocks: Set<string>;      // Selected block IDs for multi-block
  showBlockSelector: boolean;       // Toggle block selector
  aiChatVisible: boolean;          // Show/hide AI panel
  isProcessing: boolean;           // Loading state for AI
  responseError: string | null;    // Error from AI
  batchMode: boolean;              // Create multiple flashcards
}
```

### Key Features
- ✅ Front/Back input fields with character counters
- ✅ AI preset buttons (5 presets)
- ✅ Custom AI chat input
- ✅ Real-time response parsing
- ✅ Multi-block selector (expandable)
- ✅ Batch mode toggle
- ✅ Save/Clear/Cancel actions

### Layout (Responsive)
```
┌─────────────────────────────────────────────┐
│ Create Flashcard                          ✕ │
├─────────────────────────────────────────────┤
│                                             │
│  FRONT                  │   AI PRESETS     │
│  [Input Field]          │   [Preset BTNs]  │
│  254 / 500              │   [Chat Input]   │
│                         │   [Response]     │
│  BACK                   │                  │
│  [Input Field]          │                  │
│  0 / 1000               │                  │
│                         │                  │
├─────────────────────────────────────────────┤
│ [Use Blocks] [Batch Mode] | [Clear] [Save] │
└─────────────────────────────────────────────┘

Mobile Layout (Stacked):
┌───────────────────┐
│ Front Field       │
├───────────────────┤
│ [AI Presets ▼]    │ (collapsed by default)
├───────────────────┤
│ Back Field        │
├───────────────────┤
│ [Buttons...]      │
└───────────────────┘
```

---

## 2. Component: `FlashcardAIPresets.tsx`

### Purpose
Reusable preset command buttons for common flashcard creation patterns.

### Props
```typescript
interface FlashcardAIPresetsProps {
  onPresetSelect: (preset: Preset) => void;
  isLoading?: boolean;
  selectedPreset?: string; // ID of currently active preset
}

interface Preset {
  id: string;
  icon: React.ReactNode;
  label: string;
  description: string;
  systemPrompt: string;
  userPromptTemplate: string; // Template with {content} placeholder
}
```

### Preset Definitions
```typescript
const FLASHCARD_PRESETS: Preset[] = [
  {
    id: 'convert-qa',
    icon: <RotateCcw size={16} />,
    label: 'Convert to Q&A',
    description: 'Turn into question and answer format',
    systemPrompt: FLASHCARD_SYSTEM_PROMPT,
    userPromptTemplate: `Convert this into a clear Q&A flashcard. Make it exam-focused.\n\nContent:\n{content}`
  },
  {
    id: 'simplify-def',
    icon: <Lightbulb size={16} />,
    label: 'Simplify Definition',
    description: 'Create simple term→definition flashcard',
    systemPrompt: FLASHCARD_SYSTEM_PROMPT,
    userPromptTemplate: `Create a flashcard with a simple, memorable definition. Include a usage example.\n\nContent:\n{content}`
  },
  {
    id: 'extract-key',
    icon: <Target size={16} />,
    label: 'Extract Key Point',
    description: 'Pull out the most important concept',
    systemPrompt: FLASHCARD_SYSTEM_PROMPT,
    userPromptTemplate: `Extract the single most important concept from this and create a memorable flashcard about it.\n\nContent:\n{content}`
  },
  {
    id: 'mnemonics',
    icon: <Brain size={16} />,
    label: 'Create Mnemonics',
    description: 'Build memory aids and tricks',
    systemPrompt: FLASHCARD_SYSTEM_PROMPT,
    userPromptTemplate: `Create a flashcard with a mnemonic device or memory technique. Front: what to remember. Back: the mnemonic.\n\nContent:\n{content}`
  },
  {
    id: 'link-concept',
    icon: <Link2 size={16} />,
    label: 'Link Related',
    description: 'Connect to related UPSC topics',
    systemPrompt: FLASHCARD_SYSTEM_PROMPT,
    userPromptTemplate: `Create a flashcard linking this to a related UPSC concept. Front: connection question. Back: relationship explanation.\n\nContent:\n{content}`
  }
];
```

### Rendering
```
Horizontal scroll on mobile, grid on tablet:
┌──────────┐ ┌──────────┐ ┌──────────┐
│ 🔄 Q&A   │ │ 💡 Simple│ │ 🎯 Key   │
└──────────┘ └──────────┘ └──────────┘
┌──────────┐ ┌──────────┐
│ 🧠 Mnem  │ │ 🔗 Link  │
└──────────┘ └──────────┘
```

---

## 3. Component: `BlockSelector.tsx`

### Purpose
Modal for selecting multiple blocks to combine into one flashcard.

### Props
```typescript
interface BlockSelectorProps {
  visible: boolean;
  onClose: () => void;
  blocks: CapsuleBlock[];
  selectedBlockIds: Set<string>;
  onSelectionChange: (blockIds: Set<string>) => void;
  onCombine: (combinedContent: string) => void;
  maxBlocks?: number; // Default: 4
}

interface CapsuleBlock {
  id: string;
  type: 'text' | 'code' | 'image' | 'list';
  content: string;
  title?: string;
  position: number;
}
```

### State
```typescript
{
  localSelection: Set<string>;
  previewText: string;
}
```

### UI Layout
```
┌─────────────────────────────────────────┐
│ Select Blocks (Max 4)          ✕        │
├─────────────────────────────────────────┤
│ [📄 Block 1: Definition]         [☐]   │ (hover: highlight)
│ [📄 Block 2: History]            [☑]   │ (selected)
│ [📄 Block 3: Examples]           [☐]   │
│ [📄 Block 4: Key Terms]          [☑]   │
│ [📄 Block 5: ...more]            [☐]   │ (disabled if max selected)
│                                         │
│ Preview (2 blocks selected):            │
│ ─────────────────────────────────────  │
│ "Block 2 content here...                │
│  Block 4 content continues..."          │
├─────────────────────────────────────────┤
│              [Combine These]            │
└─────────────────────────────────────────┘
```

### Behavior
- Max 4 blocks selectable
- Click to toggle selection
- Visual indicator (checkmark, highlight)
- Preview updates in real-time
- Combine button disabled until at least 1 block selected

---

## 4. Utility: `FlashcardFormatParser.ts`

### Purpose
Parse AI responses into structured front/back content.

### Functions
```typescript
interface FlashcardPair {
  front: string;
  back: string;
  confidence: 'high' | 'medium' | 'low'; // How confident the parser is
  rawResponse: string; // Original AI response
}

/**
 * Parse AI response in format: "front - back -"
 * Returns null if format not recognized.
 */
export function parseFlashcardResponse(
  aiResponse: string,
  fallbackStrategy?: 'first-dash' | 'newline-split'
): FlashcardPair | null;

/**
 * Combine multiple block contents with separators
 */
export function combineBlocks(blocks: CapsuleBlock[]): string;

/**
 * Validate flashcard pair (check for minimum content)
 */
export function validateFlashcard(pair: FlashcardPair): {
  valid: boolean;
  errors: string[]; // e.g., "Front is too short", "Back is empty"
};

/**
 * Clean up markdown/html from flashcard content
 */
export function sanitizeFlashcardContent(text: string): string;
```

### Parsing Algorithm
```typescript
const FLASHCARD_PATTERNS = [
  // Pattern 1: Explicit labels
  /^front\s*[-–]\s*([\s\S]*?)\s*[-–]\s*back\s*[-–]\s*([\s\S]*?)\s*[-–]?\s*$/im,
  
  // Pattern 2: Two-line format
  /^([\s\S]*?)\n\s*[-–]\n\s*([\s\S]*?)$/m,
  
  // Pattern 3: Simple dash separator (fallback)
  /^([\s\S]*?)\s*[-–]\s*([\s\S]*)$/
];

function parseFlashcardResponse(aiResponse: string): FlashcardPair | null {
  for (const pattern of FLASHCARD_PATTERNS) {
    const match = aiResponse.match(pattern);
    if (match) {
      return {
        front: match[1].trim(),
        back: match[2].trim(),
        confidence: patternConfidence(pattern),
        rawResponse: aiResponse
      };
    }
  }
  return null;
}
```

---

## 5. Hook: `useFlashcardAIChat.ts`

### Purpose
Manage AI chat state, presets, and API calls for flashcard creation.

### Return Type
```typescript
interface UseFlashcardAIChatReturn {
  // State
  presets: Preset[];
  selectedPreset: Preset | null;
  customPrompt: string;
  response: FlashcardPair | null;
  isLoading: boolean;
  error: string | null;
  
  // Methods
  selectPreset: (presetId: string) => void;
  setCustomPrompt: (prompt: string) => void;
  chat: (userPrompt: string) => Promise<FlashcardPair | null>;
  reset: () => void;
  clearError: () => void;
}
```

### Implementation Outline
```typescript
export function useFlashcardAIChat() {
  const [selectedPreset, setSelectedPreset] = useState<string | null>(null);
  const [customPrompt, setCustomPrompt] = useState('');
  const [response, setResponse] = useState<FlashcardPair | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const chat = async (userPrompt: string): Promise<FlashcardPair | null> => {
    setIsLoading(true);
    setError(null);
    
    try {
      // 1. Build full prompt with system message
      const fullPrompt = FLASHCARD_SYSTEM_PROMPT + '\n\n' + userPrompt;
      
      // 2. Call AI API (Groq or Gemini)
      const aiResponse = await callAIAPI(fullPrompt);
      
      // 3. Parse response
      const parsed = parseFlashcardResponse(aiResponse);
      
      if (!parsed) {
        throw new Error('Invalid response format from AI');
      }
      
      // 4. Validate
      const validation = validateFlashcard(parsed);
      if (!validation.valid) {
        setError(validation.errors.join(', '));
        return null;
      }
      
      setResponse(parsed);
      return parsed;
    } catch (err: any) {
      const message = err.message || 'Failed to generate flashcard';
      setError(message);
      return null;
    } finally {
      setIsLoading(false);
    }
  };
  
  return {
    presets: FLASHCARD_PRESETS,
    selectedPreset: FLASHCARD_PRESETS.find(p => p.id === selectedPreset) || null,
    customPrompt,
    response,
    isLoading,
    error,
    selectPreset: setSelectedPreset,
    setCustomPrompt,
    chat,
    reset: () => {
      setResponse(null);
      setCustomPrompt('');
      setSelectedPreset(null);
    },
    clearError: () => setError(null)
  };
}
```

---

## 6. Integration: Adding Button to Glance

### In `app/capsule/glance/[id].tsx`

```typescript
// Add to imports
import { QuickFlashcardModal } from '../../../src/components/flashcard/QuickFlashcardModal';

// Add state
const [quickFlashcardOpen, setQuickFlashcardOpen] = useState(false);

// Add button to top bar (after edit button)
<TouchableOpacity 
  testID="capsule-glance-flashcard-ai"
  onPress={() => setQuickFlashcardOpen(true)}
  style={[styles.actionBtn, { backgroundColor: colors.primary }]}
>
  <Sparkles color="#fff" size={14} />
  <Text style={styles.actionBtnText}>Flashcard AI</Text>
</TouchableOpacity>

// Add modal at bottom
{content && (
  <QuickFlashcardModal
    visible={quickFlashcardOpen}
    onClose={() => setQuickFlashcardOpen(false)}
    onSave={handleSaveFlashcard}
    notebookTitle={meta?.title}
    subject={meta?.subject}
    blocks={content?.blocks}
  />
)}
```

---

## 7. Data Flow Diagram

```
User clicks "Flashcard AI" in Glance
            ↓
    QuickFlashcardModal opens
            ↓
    User fills Front / Back OR
    User clicks preset / custom prompt
            ↓
    useFlashcardAIChat executes chat()
            ↓
    AI API called with FLASHCARD_SYSTEM_PROMPT
            ↓
    Response received from Groq/Gemini
            ↓
    parseFlashcardResponse() extracts front/back
            ↓
    validateFlashcard() checks quality
            ↓
    Front/Back fields auto-populated / error shown
            ↓
    User reviews and clicks "Save Flashcard"
            ↓
    AddToFlashcardSheet opens (existing flow)
            ↓
    User selects deck and confirms
            ↓
    Flashcard saved ✅
```

---

## 8. Error Handling

### Error Scenarios
1. **Invalid AI Response Format**
   - Show: "AI response format unrecognized. Please edit manually or try again."
   - Action: Allow manual editing of front/back

2. **AI API Failure**
   - Show: "Failed to reach AI. Check internet connection."
   - Action: Retry button

3. **Content Too Long**
   - Show: "Front/Back fields must be under 500/1000 words"
   - Action: Character counters guide user

4. **No Blocks Selected**
   - Show: Disabled "Combine" button with tooltip

5. **Parsing Confidence Low**
   - Show: Warning icon + "Review the fields below carefully"
   - Action: Highlight fields that were auto-filled

---

## 9. Testing Strategy

### Unit Tests
- [ ] parseFlashcardResponse with various formats
- [ ] validateFlashcard with edge cases
- [ ] combineBlocks with empty/special blocks

### Component Tests
- [ ] QuickFlashcardModal renders correctly
- [ ] Presets trigger correct prompts
- [ ] Block selector multi-select works
- [ ] Auto-fill works after AI response

### Integration Tests
- [ ] Full workflow: Open → AI → Save
- [ ] Multi-block combination
- [ ] Error scenarios

### Performance Tests
- [ ] Modal open/close < 200ms
- [ ] AI response parsing < 100ms
- [ ] No main thread blocking

---

## 10. Accessibility Considerations

- ✅ Alt text for preset icons
- ✅ Proper label associations for input fields
- ✅ Keyboard navigation support
- ✅ Screen reader friendly
- ✅ High contrast mode support
- ✅ Focus indicators for all buttons

# Flashcard AI Feature - Implementation Roadmap & Setup

## Phase Overview

| Phase | Duration | Tasks | Priority |
|-------|----------|-------|----------|
| **Phase 1** | 1-2 days | Setup, Parser, Hook | 🔴 High |
| **Phase 2** | 1-2 days | Core Modal, Presets | 🔴 High |
| **Phase 3** | 1 day | Block Selector | 🟡 Medium |
| **Phase 4** | 1 day | Integration & Polish | 🟡 Medium |
| **Phase 5** | 1 day | Testing & Refinement | 🟡 Medium |

**Total Estimated Time: 5-7 days**

---

## Phase 1: Foundation Setup (1-2 Days)

### Step 1.1: Create Type Definitions
**File:** `src/types/flashcard.ts`

```typescript
export interface Preset {
  id: string;
  icon: LucideIcon; // lucide-react-native icon
  label: string;
  description: string;
  systemPrompt: string;
  userPromptTemplate: string;
}

export interface FlashcardPair {
  front: string;
  back: string;
  confidence: 'high' | 'medium' | 'low';
  rawResponse: string;
}

export interface FlashcardValidation {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

export interface CapsuleBlock {
  id: string;
  type: 'text' | 'code' | 'image' | 'list' | 'heading';
  content: string;
  title?: string;
  position: number;
}
```

### Step 1.2: Create Format Parser
**File:** `src/components/flashcard/FlashcardFormatParser.ts`

Key functions:
- `parseFlashcardResponse(aiResponse: string): FlashcardPair | null`
- `combineBlocks(blocks: CapsuleBlock[]): string`
- `validateFlashcard(pair: FlashcardPair): FlashcardValidation`
- `sanitizeFlashcardContent(text: string): string`

**Test cases:**
```typescript
// Test case 1: Standard format
Input: "front - What is photosynthesis? - back - Process of converting light to energy. -"
Expected: { front: "What is photosynthesis?", back: "Process of..." }

// Test case 2: Multiline format
Input: "What is gravity?\n-\nForce that attracts objects with mass."
Expected: { front: "What is gravity?", back: "Force that attracts..." }

// Test case 3: With markdown
Input: "front - **What** is X? - back - Answer with *emphasis*. -"
Expected: { front: "**What** is X?", back: "Answer with *emphasis*." }

// Test case 4: Invalid format (should return null)
Input: "Some random text without structure"
Expected: null
```

### Step 1.3: Create AI Chat Hook
**File:** `src/hooks/useFlashcardAIChat.ts`

```typescript
export function useFlashcardAIChat() {
  // Manages: presets, custom prompt, AI response, loading state, errors
  
  const chat = async (userPrompt: string): Promise<FlashcardPair | null> => {
    // 1. Build prompt with system message
    // 2. Call AI API (Groq or Gemini - existing integration)
    // 3. Parse response with FlashcardFormatParser
    // 4. Validate result
    // 5. Update state and return
  };
  
  return { presets, selectedPreset, customPrompt, response, isLoading, error, ... };
}
```

**Integration with existing AI:**
- Use existing `useAIAPI` hook or create wrapper
- Reuse existing Groq/Gemini configuration
- Add flashcard presets to AI context

### Step 1.4: System Prompt & Presets
**File:** `src/hooks/useFlashcardAIChat.ts` (constants section)

```typescript
const FLASHCARD_SYSTEM_PROMPT = `You are an expert flashcard creator for UPSC exam preparation.

Your task: Convert study material into high-quality flashcards.

CRITICAL REQUIREMENTS:
1. Always respond in EXACTLY this format:
   front - [question/prompt] - back - [answer/explanation] -

2. Front (max 100 words):
   - Specific, clear question or prompt
   - Phrased to test understanding
   - Include context if needed

3. Back (max 200 words):
   - Complete but concise answer
   - Use markdown for emphasis (**bold**, *italic*)
   - Include examples when helpful
   - Be self-contained (don't assume prior context)

4. Quality checklist:
   - Flashcard makes sense without original text
   - Answer directly addresses the question
   - Appropriate difficulty level
   - No ambiguity

DO NOT include any text before or after the "front - ... - back - ... -" format.
DO NOT ask clarifying questions.
DO NOT apologize or explain.
ONLY output the flashcard in the specified format.`;

const FLASHCARD_PRESETS = [
  {
    id: 'convert-qa',
    icon: 'RotateCcw',
    label: 'Convert to Q&A',
    description: 'Turn into question and answer format',
    systemPrompt: FLASHCARD_SYSTEM_PROMPT,
    userPromptTemplate: `Convert this into a clear Q&A flashcard suitable for UPSC exam prep. Focus on key concepts.\n\nContent:\n{content}`
  },
  // ... (4 more presets)
];
```

---

## Phase 2: Core Modal & Presets (1-2 Days)

### Step 2.1: Create Main Modal Component
**File:** `src/components/flashcard/QuickFlashcardModal.tsx`

Structure:
```typescript
export function QuickFlashcardModal({
  visible,
  onClose,
  onSave,
  initialFront,
  initialBack,
  notebookTitle,
  subject,
  blocks
}: QuickFlashcardModalProps) {
  const [front, setFront] = useState(initialFront || '');
  const [back, setBack] = useState(initialBack || '');
  const [showBlockSelector, setShowBlockSelector] = useState(false);
  const [batchMode, setBatchMode] = useState(false);
  
  const { presets, chat, response, isLoading, selectPreset } = useFlashcardAIChat();
  
  // Preset button handler
  const handlePresetTap = async (preset: Preset) => {
    selectPreset(preset.id);
    const prompt = preset.userPromptTemplate.replace('{content}', front);
    const result = await chat(prompt);
    if (result) {
      setFront(result.front);
      setBack(result.back);
    }
  };
  
  // Custom chat handler
  const handleCustomChat = async (customPrompt: string) => {
    const result = await chat(customPrompt);
    if (result) {
      setFront(result.front);
      setBack(result.back);
    }
  };
  
  return (
    <Modal visible={visible} transparent animationType="slide">
      <SafeAreaView style={styles.container}>
        <Header title="Create Flashcard" onClose={onClose} />
        
        <View style={styles.content}>
          {/* Front/Back inputs */}
          <View style={styles.inputSection}>
            <TextField
              label="Front"
              value={front}
              onChangeText={setFront}
              placeholder="Question or prompt..."
              maxLength={500}
            />
            <Text style={styles.counter}>{front.length} / 500</Text>
            
            <TextField
              label="Back"
              value={back}
              onChangeText={setBack}
              placeholder="Answer or explanation..."
              maxLength={1000}
            />
            <Text style={styles.counter}>{back.length} / 1000</Text>
          </View>
          
          {/* AI Panel */}
          <View style={styles.aiPanel}>
            <FlashcardAIPresets
              presets={presets}
              onPresetSelect={handlePresetTap}
              isLoading={isLoading}
            />
            
            <AIChatInput
              onSubmit={handleCustomChat}
              isLoading={isLoading}
              placeholder="Ask AI: 'Make this harder' or 'Add exam context'"
            />
            
            {isLoading && <ActivityIndicator />}
          </View>
        </View>
        
        <Footer
          onSave={() => onSave({ front, back })}
          onClear={() => { setFront(''); setBack(''); }}
          onUseBlocks={() => setShowBlockSelector(true)}
          isSaveDisabled={!front.trim() || !back.trim()}
        />
        
        {showBlockSelector && (
          <BlockSelector
            visible={true}
            onClose={() => setShowBlockSelector(false)}
            blocks={blocks || []}
            onCombine={(combined) => {
              setFront(combined);
              setShowBlockSelector(false);
            }}
          />
        )}
      </SafeAreaView>
    </Modal>
  );
}
```

### Step 2.2: Create Preset Component
**File:** `src/components/flashcard/FlashcardAIPresets.tsx`

```typescript
export function FlashcardAIPresets({
  presets,
  onPresetSelect,
  isLoading,
  selectedPreset
}: FlashcardAIPresetsProps) {
  return (
    <View style={styles.presetsContainer}>
      <Text style={styles.presetsTitle}>Quick Presets</Text>
      
      <ScrollView 
        horizontal 
        showsHorizontalScrollIndicator={false}
        style={styles.presetsScroll}
      >
        {presets.map((preset) => (
          <TouchableOpacity
            key={preset.id}
            disabled={isLoading}
            onPress={() => onPresetSelect(preset)}
            style={[
              styles.presetBtn,
              selectedPreset === preset.id && styles.presetBtnActive
            ]}
          >
            {preset.icon}
            <Text style={styles.presetLabel}>{preset.label}</Text>
            <Text style={styles.presetDesc}>{preset.description}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  );
}
```

### Step 2.3: Create AI Chat Input Component
**File:** `src/components/flashcard/AIChatInput.tsx`

```typescript
export function AIChatInput({
  onSubmit,
  isLoading,
  placeholder
}: AIChatInputProps) {
  const [input, setInput] = useState('');
  
  const handleSend = () => {
    if (input.trim()) {
      onSubmit(input);
      setInput('');
    }
  };
  
  return (
    <View style={styles.chatInput}>
      <TextInput
        style={styles.input}
        placeholder={placeholder}
        value={input}
        onChangeText={setInput}
        multiline
        editable={!isLoading}
      />
      <TouchableOpacity
        disabled={isLoading || !input.trim()}
        onPress={handleSend}
        style={styles.sendBtn}
      >
        {isLoading ? (
          <ActivityIndicator size="small" color="#fff" />
        ) : (
          <Send size={18} color="#fff" />
        )}
      </TouchableOpacity>
    </View>
  );
}
```

---

## Phase 3: Block Selector (1 Day)

### Step 3.1: Create Block Selector Modal
**File:** `src/components/flashcard/BlockSelector.tsx`

```typescript
export function BlockSelector({
  visible,
  onClose,
  blocks,
  selectedBlockIds,
  onSelectionChange,
  onCombine,
  maxBlocks = 4
}: BlockSelectorProps) {
  const [localSelection, setLocalSelection] = useState<Set<string>>(selectedBlockIds);
  
  const handleBlockPress = (blockId: string) => {
    const newSelection = new Set(localSelection);
    if (newSelection.has(blockId)) {
      newSelection.delete(blockId);
    } else if (newSelection.size < maxBlocks) {
      newSelection.add(blockId);
    }
    setLocalSelection(newSelection);
    onSelectionChange(newSelection);
  };
  
  const handleCombine = () => {
    const selected = blocks
      .filter(b => localSelection.has(b.id))
      .sort((a, b) => a.position - b.position);
    
    const combined = selected
      .map(b => b.content.trim())
      .join('\n\n---\n\n');
    
    onCombine(combined);
  };
  
  return (
    <Modal visible={visible} transparent animationType="slide">
      <SafeAreaView style={styles.container}>
        <Header 
          title={`Select Blocks (${localSelection.size}/${maxBlocks})`}
          onClose={onClose}
        />
        
        <ScrollView style={styles.list}>
          {blocks.map((block) => (
            <TouchableOpacity
              key={block.id}
              onPress={() => handleBlockPress(block.id)}
              disabled={
                localSelection.size >= maxBlocks && !localSelection.has(block.id)
              }
              style={[
                styles.blockItem,
                localSelection.has(block.id) && styles.blockItemSelected
              ]}
            >
              <View style={styles.blockContent}>
                <Text style={styles.blockTitle}>{block.title || 'Untitled'}</Text>
                <Text style={styles.blockPreview} numberOfLines={2}>
                  {block.content}
                </Text>
              </View>
              <CheckBox
                checked={localSelection.has(block.id)}
                onChange={() => handleBlockPress(block.id)}
              />
            </TouchableOpacity>
          ))}
        </ScrollView>
        
        <Footer>
          <TouchableOpacity
            disabled={localSelection.size === 0}
            onPress={handleCombine}
            style={styles.combineBtn}
          >
            <Text style={styles.combineBtnText}>Combine Selected</Text>
          </TouchableOpacity>
        </Footer>
      </SafeAreaView>
    </Modal>
  );
}
```

---

## Phase 4: Integration (1 Day)

### Step 4.1: Add Button to Glance View
**File:** `app/capsule/glance/[id].tsx`

```typescript
import { QuickFlashcardModal } from '../../../src/components/flashcard/QuickFlashcardModal';

export default function CapsuleGlance() {
  // ... existing code ...
  
  const [quickFlashcardOpen, setQuickFlashcardOpen] = useState(false);
  const [flashcardModalState, setFlashcardModalState] = useState<any>({
    aff: { visible: false, cardId: null, hint: { subject: 'General', section_group: 'General', microtopic: 'General' } }
  });
  
  // Reuse existing flashcard handler from engine.tsx
  const { handleAddToFlashcards } = useFlashcardAction(session?.user?.id);
  
  const handleSaveFlashcard = async (flashcard: { front: string; back: string }) => {
    // Create flashcard from content
    const card = {
      id: generateId(),
      question_text: flashcard.front,
      explanation_markdown: flashcard.back,
      subject: meta?.subject || 'General',
      section_group: 'Custom',
      micro_topic: meta?.title || 'From Glance'
    };
    
    // Use existing flow to save
    await handleAddToFlashcards(card);
    
    setQuickFlashcardOpen(false);
  };
  
  return (
    <PageWrapper>
      <View style={styles.root}>
        <View style={[styles.topBar, { borderBottomColor: colors.border }]}>
          {/* ... existing buttons ... */}
          
          <TouchableOpacity
            testID="capsule-glance-flashcard-ai"
            onPress={() => setQuickFlashcardOpen(true)}
            style={[styles.actionBtn, { backgroundColor: colors.primary }]}
          >
            <Sparkles color="#fff" size={14} />
            <Text style={styles.actionBtnText}>Flashcard AI</Text>
          </TouchableOpacity>
        </View>
        
        {/* ... existing content ... */}
        
        <QuickFlashcardModal
          visible={quickFlashcardOpen}
          onClose={() => setQuickFlashcardOpen(false)}
          onSave={handleSaveFlashcard}
          notebookTitle={meta?.title}
          subject={meta?.subject}
          blocks={content?.blocks}
        />
      </View>
    </PageWrapper>
  );
}
```

### Step 4.2: Add to Inline Glance
**File:** `app/capsule/index.tsx`

Similar integration in the `InlineGlance` component.

---

## Phase 5: Testing & Refinement (1 Day)

### Testing Checklist
- [ ] Parser handles all response formats correctly
- [ ] Presets generate valid flashcards
- [ ] Custom prompts work
- [ ] Block selector works (1-4 blocks)
- [ ] Modal opens/closes smoothly
- [ ] Flashcards save to deck
- [ ] Error handling (network, parsing)
- [ ] Performance (no lag on iPad)
- [ ] Mobile responsive layout
- [ ] Accessibility (keyboard navigation, screen reader)

### Performance Targets
- Modal open/close: < 200ms
- AI response: < 5 seconds (typical)
- Parsing: < 100ms
- No main thread blocking

### Refinement Items
- [ ] Loading states and spinners
- [ ] Toast notifications for success/error
- [ ] Haptic feedback on actions
- [ ] Keyboard handling (dismiss on done)
- [ ] Animation polish
- [ ] Dark mode support

---

## Dependencies & Setup

### New Dependencies Required
None! All existing:
- ✅ react-native
- ✅ lucide-react-native (icons)
- ✅ Groq/Gemini API (existing)
- ✅ Supabase (existing)
- ✅ expo-router (navigation)

### Files to Create
```
src/types/
  └── flashcard.ts

src/components/flashcard/
  ├── QuickFlashcardModal.tsx
  ├── FlashcardAIPresets.tsx
  ├── AIChatInput.tsx
  ├── BlockSelector.tsx
  └── FlashcardFormatParser.ts

src/hooks/
  └── useFlashcardAIChat.ts (or extend existing)

App updates:
  ├── app/capsule/glance/[id].tsx (add button & modal)
  └── app/capsule/index.tsx (add to inline glance)
```

### Files to Modify
```
app/capsule/glance/[id].tsx
  → Add button, import modal, handle save

app/capsule/index.tsx
  → Add button to InlineGlance component

(Optional) src/hooks/useFlashcardAction.ts
  → Already handles flashcard saving, may extend for metrics
```

---

## Deployment Steps

1. **Create feature branch**
   ```bash
   git checkout -b feature/flashcard-ai-creation
   ```

2. **Implement in phases** (following roadmap above)

3. **Local testing on iPad & phone**
   ```bash
   npm run ios  # or android
   ```

4. **Code review**
   - Check component structure
   - Review AI integration
   - Test error handling

5. **Merge to main**
   ```bash
   git merge feature/flashcard-ai-creation
   ```

6. **Deployment**
   - Build and submit to TestFlight / Play Store

---

## Success Criteria

✅ Users can create flashcards with 1-click preset AI generation  
✅ Multi-block flashcard creation works smoothly  
✅ AI format parsing handles >95% of responses correctly  
✅ Feature adopted by 50%+ active users within 2 weeks  
✅ Average flashcard creation time < 1 minute  
✅ No performance regression in Glance view  
✅ Error rate < 1% (invalid flashcards)  

---

## Rollback Plan

If issues arise post-deployment:
1. Hide button via feature flag
2. Keep existing flashcard creation flow functional
3. Investigate issue in staging
4. Fix and re-deploy

Feature flag implementation:
```typescript
const FLASHCARD_AI_ENABLED = true; // Set to false to hide

{FLASHCARD_AI_ENABLED && (
  <TouchableOpacity onPress={() => setQuickFlashcardOpen(true)}>
    <Sparkles />
  </TouchableOpacity>
)}
```

---

## Next Steps

1. ✅ Review design with team
2. ⏳ Implement Phase 1 (Parser, Hook)
3. ⏳ Implement Phase 2 (Modal, Presets)
4. ⏳ Integration testing
5. ⏳ Deploy to staging
6. ⏳ User acceptance testing
7. ⏳ Deploy to production

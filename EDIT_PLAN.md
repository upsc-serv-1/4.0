# Flashcard AI Feature - Edit Plan

## Executive Summary
Complete implementation plan for the Flashcard AI Creation feature. **5-7 days of development**, organized by file with specific line numbers and code changes needed.

---

## Phase 1: Foundation Setup (1-2 Days)

### 1.1 Create: `src/types/flashcard.ts`
**Status**: 🔴 Not Started  
**Priority**: HIGH - Dependency for all other files  
**Lines**: ~100 lines

**What to create:**
```typescript
// Type definitions for flashcard feature
export interface Preset { id, icon, label, description, systemPrompt, userPromptTemplate }
export interface FlashcardPair { front, back, confidence, rawResponse }
export interface FlashcardValidation { valid, errors, warnings }
export interface CapsuleBlock { id, type, content, title, position }
```

**Checklist:**
- [ ] Create file with all 4 interfaces
- [ ] Add proper imports (LucideIcon type)
- [ ] Export all types

---

### 1.2 Create: `src/components/flashcard/FlashcardFormatParser.ts`
**Status**: 🔴 Not Started  
**Priority**: HIGH - Core parsing logic  
**Lines**: ~200 lines

**What to create:**
Key functions needed:
1. `parseFlashcardResponse(aiResponse: string): FlashcardPair | null`
   - Parse `front - ... - back - ... -` format
   - Fallback patterns for variations
   - Return null if format invalid

2. `combineBlocks(blocks: CapsuleBlock[]): string`
   - Join multiple blocks with separators
   - Preserve formatting
   - Return combined string

3. `validateFlashcard(pair: FlashcardPair): FlashcardValidation`
   - Check front length (max 500 chars)
   - Check back length (max 1000 chars)
   - Verify both are non-empty
   - Return validation object

4. `sanitizeFlashcardContent(text: string): string`
   - Remove extra whitespace
   - Clean up markdown
   - Return sanitized text

**Test Cases to Include:**
```
✓ "front - What is X? - back - Answer Y. -"
✓ "What is X?\n-\nAnswer Y."
✓ "front - **What** is X? - back - Answer with *emphasis*. -"
✗ "Random text without structure" (should return null)
```

**Checklist:**
- [ ] All 4 functions implemented
- [ ] Regex patterns for parsing
- [ ] Error handling for edge cases
- [ ] Export all functions

---

### 1.3 Create: `src/hooks/useFlashcardAIChat.ts`
**Status**: 🔴 Not Started  
**Priority**: HIGH - Main AI interaction hook  
**Lines**: ~300 lines

**What to create:**

#### Constants Section:
- `FLASHCARD_SYSTEM_PROMPT` - System instruction for AI
- `FLASHCARD_PRESETS` array with 5 presets:
  1. Convert to Q&A
  2. Simplify Definition
  3. Extract Key Point
  4. Create Mnemonics
  5. Link Related

#### Hook Function:
```typescript
export function useFlashcardAIChat() {
  // State:
  const [presets, setPresets] = useState(FLASHCARD_PRESETS)
  const [selectedPreset, setSelectedPreset] = useState<string>('')
  const [customPrompt, setCustomPrompt] = useState<string>('')
  const [response, setResponse] = useState<FlashcardPair | null>(null)
  const [isLoading, setIsLoading] = useState<boolean>(false)
  const [error, setError] = useState<string | null>(null)
  
  // Functions:
  const chat = async (userPrompt: string): Promise<FlashcardPair | null> => {
    // 1. Build system + user prompt
    // 2. Call existing AI API (Groq or Gemini)
    // 3. Parse response with FlashcardFormatParser
    // 4. Validate result
    // 5. Update state
    // 6. Return pair or null
  }
  
  const selectPreset = (presetId: string) => { /* set selected */ }
  
  // Return: { presets, selectedPreset, customPrompt, response, isLoading, error, chat, selectPreset }
}
```

**Integration Notes:**
- Use existing `useAIAPI` hook or create wrapper for Groq/Gemini
- Reuse AI configuration from existing codebase
- Add rate limiting (50 calls/day per user)
- Handle network errors gracefully

**Checklist:**
- [ ] Hook structure complete
- [ ] All 5 presets configured
- [ ] System prompt written
- [ ] AI API integration working
- [ ] Error handling in place
- [ ] Rate limiting implemented

---

## Phase 2: Core Components (1-2 Days)

### 2.1 Create: `src/components/flashcard/QuickFlashcardModal.tsx`
**Status**: 🔴 Not Started  
**Priority**: HIGH - Main UI component  
**Lines**: ~400 lines

**What to create:**

```typescript
export interface QuickFlashcardModalProps {
  visible: boolean
  onClose: () => void
  onSave: (flashcard: { front: string; back: string }) => void
  initialFront?: string
  initialBack?: string
  notebookTitle?: string
  subject?: string
  blocks?: CapsuleBlock[]
}

export function QuickFlashcardModal(props: QuickFlashcardModalProps) {
  // State:
  const [front, setFront] = useState(props.initialFront || '')
  const [back, setBack] = useState(props.initialBack || '')
  const [showBlockSelector, setShowBlockSelector] = useState(false)
  const [batchMode, setBatchMode] = useState(false)
  
  // Hooks:
  const { presets, chat, response, isLoading, selectPreset } = useFlashcardAIChat()
  const theme = useContext(ThemeContext)
  
  // Handlers:
  const handlePresetTap = async (preset: Preset) => {
    selectPreset(preset.id)
    const prompt = preset.userPromptTemplate.replace('{content}', front)
    const result = await chat(prompt)
    if (result) {
      setFront(result.front)
      setBack(result.back)
    }
  }
  
  const handleCustomChat = async (customPrompt: string) => {
    const result = await chat(customPrompt)
    if (result) {
      setFront(result.front)
      setBack(result.back)
    }
  }
  
  const handleSave = () => {
    if (front.trim() && back.trim()) {
      onSave({ front, back })
      setFront('')
      setBack('')
    }
  }
  
  // Render:
  return (
    <Modal visible={visible} transparent animationType="slide">
      <SafeAreaView style={styles.container}>
        <Header title="Create Flashcard" onClose={onClose} />
        
        <ScrollView style={styles.content}>
          <FrontInput value={front} onChange={setFront} />
          <BackInput value={back} onChange={setBack} />
          
          <FlashcardAIPresets
            presets={presets}
            onPresetSelect={handlePresetTap}
            isLoading={isLoading}
          />
          
          <AIChatInput
            onSubmit={handleCustomChat}
            isLoading={isLoading}
          />
        </ScrollView>
        
        <Footer
          onSave={handleSave}
          onClear={() => { setFront(''); setBack('') }}
          onUseBlocks={() => setShowBlockSelector(true)}
          isSaveDisabled={!front.trim() || !back.trim()}
        />
        
        {showBlockSelector && (
          <BlockSelector
            visible={true}
            onClose={() => setShowBlockSelector(false)}
            blocks={props.blocks || []}
            onCombine={(combined) => {
              setFront(combined)
              setShowBlockSelector(false)
            }}
          />
        )}
      </SafeAreaView>
    </Modal>
  )
}

// Styles:
const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { flex: 1, padding: 16 },
  // ... (more styles)
})
```

**Checklist:**
- [ ] Modal structure complete
- [ ] Input fields working
- [ ] Preset integration
- [ ] Custom chat input
- [ ] Block selector integration
- [ ] Save/Clear functionality
- [ ] Responsive styling

---

### 2.2 Create: `src/components/flashcard/FlashcardAIPresets.tsx`
**Status**: 🔴 Not Started  
**Priority**: HIGH - Preset UI  
**Lines**: ~150 lines

**What to create:**

```typescript
export interface FlashcardAIPresetsProps {
  presets: Preset[]
  onPresetSelect: (preset: Preset) => void
  isLoading?: boolean
  selectedPreset?: string
}

export function FlashcardAIPresets(props: FlashcardAIPresetsProps) {
  return (
    <View style={styles.presetsContainer}>
      <Text style={styles.presetsTitle}>Quick Presets</Text>
      
      <ScrollView 
        horizontal 
        showsHorizontalScrollIndicator={false}
        style={styles.presetsScroll}
      >
        {props.presets.map((preset) => (
          <TouchableOpacity
            key={preset.id}
            disabled={props.isLoading}
            onPress={() => props.onPresetSelect(preset)}
            style={[
              styles.presetBtn,
              props.selectedPreset === preset.id && styles.presetBtnActive
            ]}
          >
            <Icon icon={preset.icon} size={20} />
            <Text style={styles.presetLabel}>{preset.label}</Text>
            <Text style={styles.presetDesc}>{preset.description}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  )
}

const styles = StyleSheet.create({
  presetsContainer: { marginVertical: 16 },
  presetsTitle: { fontSize: 14, fontWeight: '600', marginBottom: 8 },
  presetsScroll: { paddingHorizontal: 0 },
  presetBtn: { /* styling */ },
  presetBtnActive: { /* active state */ }
})
```

**Checklist:**
- [ ] Horizontal scroll layout
- [ ] Preset button styling
- [ ] Loading state handling
- [ ] Selection highlighting
- [ ] Icon rendering

---

### 2.3 Create: `src/components/flashcard/AIChatInput.tsx`
**Status**: 🔴 Not Started  
**Priority**: HIGH - Custom prompt input  
**Lines**: ~120 lines

**What to create:**

```typescript
export interface AIChatInputProps {
  onSubmit: (prompt: string) => void
  isLoading?: boolean
  placeholder?: string
}

export function AIChatInput(props: AIChatInputProps) {
  const [input, setInput] = useState('')
  
  const handleSend = () => {
    if (input.trim()) {
      props.onSubmit(input)
      setInput('')
    }
  }
  
  return (
    <View style={styles.chatInput}>
      <TextInput
        style={styles.input}
        placeholder={props.placeholder || "Ask AI: 'Make this harder'"}
        value={input}
        onChangeText={setInput}
        multiline
        editable={!props.isLoading}
        placeholderTextColor="#999"
      />
      <TouchableOpacity
        disabled={props.isLoading || !input.trim()}
        onPress={handleSend}
        style={styles.sendBtn}
      >
        {props.isLoading ? (
          <ActivityIndicator size="small" color="#fff" />
        ) : (
          <Send size={18} color="#fff" />
        )}
      </TouchableOpacity>
    </View>
  )
}

const styles = StyleSheet.create({
  chatInput: { flexDirection: 'row', marginVertical: 12 },
  input: { flex: 1, borderRadius: 8, padding: 10, marginRight: 8 },
  sendBtn: { /* styling */ }
})
```

**Checklist:**
- [ ] Text input functional
- [ ] Send button working
- [ ] Loading state
- [ ] Disabled state when loading
- [ ] Clear input after send

---

## Phase 3: Block Selector (1 Day)

### 3.1 Create: `src/components/flashcard/BlockSelector.tsx`
**Status**: 🔴 Not Started  
**Priority**: MEDIUM - Multi-block support  
**Lines**: ~250 lines

**What to create:**

```typescript
export interface BlockSelectorProps {
  visible: boolean
  onClose: () => void
  blocks: CapsuleBlock[]
  selectedBlockIds?: Set<string>
  onSelectionChange?: (selected: Set<string>) => void
  onCombine: (combined: string) => void
  maxBlocks?: number
}

export function BlockSelector(props: BlockSelectorProps) {
  const [localSelection, setLocalSelection] = useState<Set<string>>(
    props.selectedBlockIds || new Set()
  )
  
  const handleBlockPress = (blockId: string) => {
    const newSelection = new Set(localSelection)
    if (newSelection.has(blockId)) {
      newSelection.delete(blockId)
    } else if (newSelection.size < (props.maxBlocks || 4)) {
      newSelection.add(blockId)
    }
    setLocalSelection(newSelection)
    props.onSelectionChange?.(newSelection)
  }
  
  const handleCombine = () => {
    const selected = props.blocks
      .filter(b => localSelection.has(b.id))
      .sort((a, b) => a.position - b.position)
    
    const combined = selected
      .map(b => b.content.trim())
      .join('\n\n---\n\n')
    
    props.onCombine(combined)
  }
  
  return (
    <Modal visible={props.visible} transparent animationType="slide">
      <SafeAreaView style={styles.container}>
        <Header 
          title={`Select Blocks (${localSelection.size}/${props.maxBlocks || 4})`}
          onClose={props.onClose}
        />
        
        <ScrollView style={styles.list}>
          {props.blocks.map((block) => (
            <TouchableOpacity
              key={block.id}
              onPress={() => handleBlockPress(block.id)}
              disabled={
                localSelection.size >= (props.maxBlocks || 4) && 
                !localSelection.has(block.id)
              }
              style={[
                styles.blockItem,
                localSelection.has(block.id) && styles.blockItemSelected
              ]}
            >
              <View style={styles.blockContent}>
                <Text style={styles.blockTitle}>
                  {block.title || 'Untitled Block'}
                </Text>
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
            <Text style={styles.combineBtnText}>
              Combine {localSelection.size} Block{localSelection.size !== 1 ? 's' : ''}
            </Text>
          </TouchableOpacity>
        </Footer>
      </SafeAreaView>
    </Modal>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  list: { flex: 1 },
  blockItem: { /* styling */ },
  blockItemSelected: { /* selected styling */ },
  combineBtn: { /* button styling */ }
})
```

**Checklist:**
- [ ] Block list rendering
- [ ] Selection logic (max 4 blocks)
- [ ] Combination logic
- [ ] UI responsive
- [ ] Selection state display

---

## Phase 4: Integration with Glance (1 Day)

### 4.1 Modify: `app/capsule/glance/[id].tsx`

**Location**: Line numbers vary (find current implementation)  
**Status**: 🔴 Not Started  
**Priority**: HIGH - User-facing integration  

**Changes needed:**

#### Step 1: Add imports (after existing imports)
```typescript
// Add these imports:
import { QuickFlashcardModal } from '../../../src/components/flashcard/QuickFlashcardModal'
import { useFlashcardAction } from '../../../src/hooks/useFlashcardAction'
```

#### Step 2: Add state inside component (near other useState declarations)
```typescript
const [quickFlashcardOpen, setQuickFlashcardOpen] = useState(false)
const [flashcardModalContent, setFlashcardModalContent] = useState<{
  front?: string
  blocks?: CapsuleBlock[]
}>({})
```

#### Step 3: Add flashcard handler (near other event handlers)
```typescript
const { handleAddToFlashcards } = useFlashcardAction(session?.user?.id)

const handleSaveFlashcard = async (flashcard: { front: string; back: string }) => {
  try {
    const card = {
      id: generateId(),
      question_text: flashcard.front,
      explanation_markdown: flashcard.back,
      subject: meta?.subject || 'General',
      section_group: 'Custom',
      micro_topic: meta?.title || 'From Glance'
    }
    
    await handleAddToFlashcards(card)
    setQuickFlashcardOpen(false)
    
    // Optional: Show success toast
    Toast.show({
      type: 'success',
      text1: 'Flashcard Created',
      text2: 'Saved to your decks'
    })
  } catch (error) {
    console.error('Error saving flashcard:', error)
    Toast.show({
      type: 'error',
      text1: 'Error',
      text2: 'Failed to create flashcard'
    })
  }
}
```

#### Step 4: Add button to toolbar (find topBar section)
```typescript
<TouchableOpacity
  testID="capsule-glance-flashcard-ai"
  onPress={() => setQuickFlashcardOpen(true)}
  style={[styles.actionBtn, { backgroundColor: colors.primary }]}
>
  <Sparkles color="#fff" size={14} />
  <Text style={styles.actionBtnText}>Flashcard AI</Text>
</TouchableOpacity>
```

#### Step 5: Add modal near end of JSX (before closing tag)
```typescript
<QuickFlashcardModal
  visible={quickFlashcardOpen}
  onClose={() => setQuickFlashcardOpen(false)}
  onSave={handleSaveFlashcard}
  notebookTitle={meta?.title}
  subject={meta?.subject}
  blocks={/* extract blocks from content */}
  initialFront={flashcardModalContent.front}
/>
```

**Checklist:**
- [ ] Imports added
- [ ] State variables initialized
- [ ] Handler function implemented
- [ ] Button added to toolbar
- [ ] Modal mounted in JSX
- [ ] Success/error handling
- [ ] Testing on device

---

### 4.2 Modify: `app/capsule/index.tsx`

**Location**: InlineGlance component  
**Status**: 🔴 Not Started  
**Priority**: MEDIUM - Also integrate to notebook index  

**Same changes as 4.1**, but applied to InlineGlance component:
- Add imports
- Add state
- Add handler
- Add button to toolbar
- Mount modal

**Checklist:**
- [ ] Same steps as 4.1
- [ ] Button placement appropriate
- [ ] Modal functional
- [ ] Testing in context

---

## Phase 5: Testing & Refinement (1 Day)

### 5.1 Unit Tests
**Status**: 🔴 Not Started  
**Location**: `src/components/flashcard/__tests__/`

**Tests needed:**
```
FlashcardFormatParser.test.ts
├── parseFlashcardResponse
│   ├── Standard format
│   ├── Multiline format
│   ├── With markdown
│   └── Invalid format returns null
├── combineBlocks
│   ├── Single block
│   ├── Multiple blocks
│   └── With separators
├── validateFlashcard
│   ├── Valid card
│   ├── Too long front
│   ├── Too long back
│   └── Empty fields

useFlashcardAIChat.test.ts
├── Chat with preset
├── Chat with custom prompt
├── Rate limiting
└── Error handling
```

**Checklist:**
- [ ] Parser tests all pass
- [ ] Hook tests all pass
- [ ] Coverage > 80%
- [ ] Edge cases covered

---

### 5.2 Integration Tests
**Status**: 🔴 Not Started

**Test scenarios:**
```
1. Open modal → Type front → Select preset → Verify back auto-fills
2. Select multi-block → Combine → Verify concatenation
3. Save flashcard → Verify saved to deck
4. Network error → Verify graceful handling
5. Parsing failure → Verify error message
```

**Checklist:**
- [ ] All scenarios pass on iPhone
- [ ] All scenarios pass on iPad (landscape)
- [ ] All scenarios pass on Android
- [ ] Performance acceptable

---

### 5.3 Polish & Refinement
**Status**: 🔴 Not Started

**Items:**
```
- [ ] Smooth animations
- [ ] Dark mode support
- [ ] Accessibility (screen readers, keyboard nav)
- [ ] Loading states
- [ ] Toast notifications
- [ ] Error messages are clear
- [ ] Help text for presets
- [ ] Tooltips on UI elements
```

---

## Summary of Files

### NEW FILES TO CREATE (8 total)
```
1. src/types/flashcard.ts
2. src/components/flashcard/FlashcardFormatParser.ts
3. src/hooks/useFlashcardAIChat.ts
4. src/components/flashcard/QuickFlashcardModal.tsx
5. src/components/flashcard/FlashcardAIPresets.tsx
6. src/components/flashcard/AIChatInput.tsx
7. src/components/flashcard/BlockSelector.tsx
8. src/components/flashcard/__tests__/ (test files)
```

### FILES TO MODIFY (2 total)
```
1. app/capsule/glance/[id].tsx
   - Add: imports, state, handler, button, modal

2. app/capsule/index.tsx (InlineGlance)
   - Add: imports, state, handler, button, modal
```

### FILES ALREADY REVIEWED (Dependencies)
```
✅ src/hooks/useFlashcardAction.ts - Already handles flashcard saving
✅ src/services/FlashcardSvc.ts - Already has create/save methods
✅ Groq/Gemini API - Already integrated in codebase
✅ AddToFlashcardSheet component - Can reuse
✅ ThemeContext - For styling
```

---

## Execution Order

### Priority 1 (Foundation - 1-2 days)
1. `src/types/flashcard.ts` 
2. `src/components/flashcard/FlashcardFormatParser.ts`
3. `src/hooks/useFlashcardAIChat.ts`
→ These are dependencies for all UI components

### Priority 2 (UI - 1-2 days)
4. `src/components/flashcard/QuickFlashcardModal.tsx`
5. `src/components/flashcard/FlashcardAIPresets.tsx`
6. `src/components/flashcard/AIChatInput.tsx`
→ Build and test in isolation

### Priority 3 (Advanced - 1 day)
7. `src/components/flashcard/BlockSelector.tsx`
→ Depends on main modal

### Priority 4 (Integration - 1 day)
8. `app/capsule/glance/[id].tsx` - Add button and modal
9. `app/capsule/index.tsx` - Add button and modal
→ Connect UI to actual app

### Priority 5 (Polish - 1 day)
10. Testing, refinement, accessibility
11. Performance optimization
12. Dark mode verification

---

## Go/No-Go Decision Points

### After Phase 1:
- ✅ Parser tests pass with all format variations
- ✅ Hook successfully calls AI API
- ✅ No TypeScript errors

### After Phase 2:
- ✅ Modal renders without errors
- ✅ Presets interactive
- ✅ Custom chat input working
- ✅ No main thread blocking

### After Phase 3:
- ✅ Block selector allows 1-4 selection
- ✅ Combination logic preserves content

### After Phase 4:
- ✅ Button visible in Glance
- ✅ Modal opens/closes smoothly
- ✅ Flashcard saves to deck
- ✅ No UI regressions

### Before Release:
- ✅ All tests pass
- ✅ Performance acceptable
- ✅ No console errors
- ✅ Accessibility verified

---

## Deployment Checklist

- [ ] Feature branch created: `feature/flashcard-ai-creation`
- [ ] All code reviewed
- [ ] All tests passing
- [ ] No performance regressions
- [ ] Accessibility audit passed
- [ ] Beta tested with 5-10 users
- [ ] Merge to main
- [ ] Deploy to TestFlight/Play Store

---

**Created**: May 12, 2026  
**Status**: Ready for execution  
**Estimated Duration**: 5-7 days  
**Team Size**: 1-2 developers recommended

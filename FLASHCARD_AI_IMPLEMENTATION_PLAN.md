# AI-Powered Flashcard Creation - Implementation Plan

## Overview
Integrate AI into flashcard creation with two modes:
1. **AI Mode** - AI converts content to "front - back -" format automatically
2. **Custom Mode** - User manually enters front/back

---

## Part 1: Modify Existing Flashcard Creation (`app/flashcards/new.tsx`)

### Current Flow:
User manually types in Front field → Manual typing in Back field → Save

### New Flow:
```
+─────────────────────────────────────────────────────┐
│ Add Card (Existing Page)                        ✕   │
├─────────────────────────────────────────────────────┤
│                                                     │
│ [💬 Use AI] [✏️ Manual Entry]  ← Tab selector      │
│                                                     │
│ ╔═══════════════════════════════════════════════╗  │
│ ║ AI TAB:                                       ║  │
│ ║ ┌───────────────────────────────────────────┐ ║  │
│ ║ │ Paste your content here...                │ ║  │
│ ║ │ "The mitochondria is the powerhouse..."   │ ║  │
│ ║ │                                           │ ║  │
│ ║ │ [Generate with AI →]                      │ ║  │
│ ║ └───────────────────────────────────────────┘ ║  │
│ ║                                               ║  │
│ ║ ⏳ AI is thinking...                          ║  │
│ ║                                               ║  │
│ ║ FRONT: [Edit box with AI response]            ║  │
│ ║ ┌───────────────────────────────────────────┐ ║  │
│ ║ │ What is the powerhouse of the cell?      │ ║  │
│ ║ │                                           │ ║  │
│ ║ └───────────────────────────────────────────┘ ║  │
│ ║                                               ║  │
│ ║ BACK: [Edit box with AI response]             ║  │
│ ║ ┌───────────────────────────────────────────┐ ║  │
│ ║ │ Mitochondria - produces ATP for energy    │ ║  │
│ ║ │ through cellular respiration               │ ║  │
│ ║ └───────────────────────────────────────────┘ ║  │
│ ║                                               ║  │
│ ║ [Edit] [Generate Again] [Save & Choose Deck] ║  │
│ ╚═══════════════════════════════════════════════╝  │
│                                                     │
│ ╔═══════════════════════════════════════════════╗  │
│ ║ MANUAL TAB:                                   ║  │
│ ║ FRONT: [User enters text]                     ║  │
│ ║ BACK: [User enters text]                      ║  │
│ ║ [Save & Choose Deck]                          ║  │
│ ╚═══════════════════════════════════════════════╝  │
│                                                     │
└─────────────────────────────────────────────────────┘
```

### Changes to `app/flashcards/new.tsx`:

#### 1. Add AI Tab State
```typescript
const [mode, setMode] = useState<'ai' | 'manual'>('ai')  // Default to AI
const [aiInput, setAiInput] = useState('')  // What user pastes
const [aiResponse, setAiResponse] = useState<{front: string; back: string} | null>(null)
const [aiLoading, setAiLoading] = useState(false)
```

#### 2. Add AI Processing Function
```typescript
const generateFlashcardWithAI = async () => {
  if (!aiInput.trim()) {
    Alert.alert('Empty', 'Paste some content to convert to a flashcard')
    return
  }
  
  setAiLoading(true)
  try {
    // Call AI API with system prompt
    const response = await callAIAPI({
      systemPrompt: FLASHCARD_SYSTEM_PROMPT,
      userPrompt: `Convert this content into a flashcard:\n\n${aiInput}`
    })
    
    // Parse response - expect format: "front - [content] - back - [content] -"
    const parsed = parseFlashcardResponse(response)
    if (parsed) {
      setAiResponse(parsed)
      setFront(parsed.front)
      setBack(parsed.back)
    } else {
      Alert.alert('Parse Error', 'AI response was not in expected format')
    }
  } catch (error) {
    Alert.alert('Error', error.message)
  } finally {
    setAiLoading(false)
  }
}
```

#### 3. Add UI Tabs
```typescript
// Replace existing form with tabs
<View style={s.tabContainer}>
  <TouchableOpacity
    style={[s.tab, mode === 'ai' && s.tabActive]}
    onPress={() => setMode('ai')}
  >
    <MessageCircle size={16} />
    <Text>Use AI</Text>
  </TouchableOpacity>
  
  <TouchableOpacity
    style={[s.tab, mode === 'manual' && s.tabActive]}
    onPress={() => setMode('manual')}
  >
    <Edit size={16} />
    <Text>Manual Entry</Text>
  </TouchableOpacity>
</View>

{mode === 'ai' ? (
  <AIFlashcardForm
    input={aiInput}
    onInputChange={setAiInput}
    response={aiResponse}
    onGenerate={generateFlashcardWithAI}
    loading={aiLoading}
    onFrontChange={setFront}
    onBackChange={setBack}
    front={front}
    back={back}
  />
) : (
  <ManualFlashcardForm
    front={front}
    onFrontChange={setFront}
    back={back}
    onBackChange={setBack}
  />
)}
```

---

## Part 2: Create AI System Components

### Component 1: `src/hooks/useFlashcardAI.ts`

```typescript
export const FLASHCARD_SYSTEM_PROMPT = `You are an expert flashcard creator for UPSC exam preparation.

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
   - Be self-contained

DO NOT include any text before or after the "front - ... - back - ... -" format.
ONLY output the flashcard in the specified format.`

export function useFlashcardAI() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  
  const generateFlashcard = async (content: string): Promise<{front: string; back: string} | null> => {
    setLoading(true)
    setError(null)
    
    try {
      // Call existing AI API (Groq or Gemini)
      const response = await callAIAPI({
        systemPrompt: FLASHCARD_SYSTEM_PROMPT,
        userPrompt: `Convert this into a flashcard:\n\n${content}`
      })
      
      const parsed = parseFlashcardResponse(response)
      if (!parsed) {
        setError('AI response format incorrect')
        return null
      }
      
      return parsed
    } catch (err) {
      setError(err.message)
      return null
    } finally {
      setLoading(false)
    }
  }
  
  return { generateFlashcard, loading, error }
}
```

### Component 2: `src/utils/parseFlashcard.ts`

```typescript
export function parseFlashcardResponse(aiResponse: string): {front: string; back: string} | null {
  if (!aiResponse) return null
  
  // Pattern 1: "front - [content] - back - [content] -"
  const pattern1 = /front\s*[-–]\s*([\s\S]*?)\s*[-–]\s*back\s*[-–]\s*([\s\S]*?)\s*[-–]\s*$/i
  const match1 = aiResponse.match(pattern1)
  
  if (match1) {
    return {
      front: match1[1].trim(),
      back: match1[2].trim()
    }
  }
  
  // Pattern 2: "FRONT: [content] BACK: [content]"
  const pattern2 = /front:\s*([\s\S]*?)\s*back:\s*([\s\S]*?)$/i
  const match2 = aiResponse.match(pattern2)
  
  if (match2) {
    return {
      front: match2[1].trim(),
      back: match2[2].trim()
    }
  }
  
  // Pattern 3: Simple split on first " - "
  const parts = aiResponse.split(' - ')
  if (parts.length >= 2) {
    return {
      front: parts[0].trim(),
      back: parts.slice(1).join(' - ').trim()
    }
  }
  
  return null
}
```

### Component 3: `src/components/flashcards/AIFlashcardForm.tsx`

```typescript
interface AIFlashcardFormProps {
  input: string
  onInputChange: (text: string) => void
  response: {front: string; back: string} | null
  onGenerate: () => void
  loading: boolean
  onFrontChange: (text: string) => void
  onBackChange: (text: string) => void
  front: string
  back: string
}

export function AIFlashcardForm(props: AIFlashcardFormProps) {
  return (
    <View>
      {/* INPUT SECTION */}
      <View style={s.section}>
        <Text style={s.label}>Paste content to convert:</Text>
        <TextInput
          value={props.input}
          onChangeText={props.onInputChange}
          placeholder="Paste your notes, paragraph, or concept here..."
          multiline
          style={s.inputArea}
        />
        <TouchableOpacity
          onPress={props.onGenerate}
          disabled={props.loading || !props.input.trim()}
          style={[s.generateBtn, props.loading && s.disabled]}
        >
          {props.loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <>
              <Sparkles size={18} color="#fff" />
              <Text style={s.generateBtnText}>Generate with AI</Text>
            </>
          )}
        </TouchableOpacity>
      </View>
      
      {/* AI RESPONSE SECTION */}
      {props.response && (
        <View style={s.section}>
          <Text style={s.sectionTitle}>AI Generated Flashcard</Text>
          
          <View style={s.fieldContainer}>
            <Text style={s.label}>Front (Question):</Text>
            <TextInput
              value={props.front}
              onChangeText={props.onFrontChange}
              placeholder="Question or prompt..."
              multiline
              style={s.editableArea}
            />
          </View>
          
          <View style={s.fieldContainer}>
            <Text style={s.label}>Back (Answer):</Text>
            <TextInput
              value={props.back}
              onChangeText={props.onBackChange}
              placeholder="Answer or explanation..."
              multiline
              style={s.editableArea}
            />
          </View>
          
          <View style={s.buttonRow}>
            <TouchableOpacity onPress={props.onGenerate} style={s.secondaryBtn}>
              <Text>Generate Again</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => {}} style={s.primaryBtn}>
              <Save size={18} />
              <Text>Save & Choose Deck</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
    </View>
  )
}
```

### Component 4: `src/components/flashcards/ManualFlashcardForm.tsx`

```typescript
interface ManualFlashcardFormProps {
  front: string
  onFrontChange: (text: string) => void
  back: string
  onBackChange: (text: string) => void
}

export function ManualFlashcardForm(props: ManualFlashcardFormProps) {
  return (
    <View>
      <Text style={s.label}>Front side</Text>
      <TextInput
        value={props.front}
        onChangeText={props.onFrontChange}
        placeholder="Question or prompt..."
        multiline
        style={s.textArea}
      />
      
      <View style={{ height: 24 }} />
      
      <Text style={s.label}>Back side</Text>
      <TextInput
        value={props.back}
        onChangeText={props.onBackChange}
        placeholder="Answer or explanation..."
        multiline
        style={s.textArea}
      />
    </View>
  )
}
```

---

## Part 3: Integration with Pilot V2 Glance View

### Modified Flow in `src/components/pilot-v2/PilotV2GlanceView.tsx`

#### Current (What I added):
```typescript
const handleCreateFlashcard = () => {
  router.push({
    pathname: '/flashcards/new',
    params: { ... }
  })
}
```

#### Enhanced (New):
```typescript
const [flashcardModalOpen, setFlashcardModalOpen] = useState(false)

const handleCreateFlashcard = () => {
  // Open our custom AI modal instead of going directly to /flashcards/new
  setFlashcardModalOpen(true)
}
```

### New Component: `src/components/flashcards/FlashcardAIModal.tsx`

```typescript
interface FlashcardAIModalProps {
  visible: boolean
  onClose: () => void
  onSave: (flashcard: {front: string; back: string}) => void
  initialContent?: string
  noteTitle?: string
}

export function FlashcardAIModal(props: FlashcardAIModalProps) {
  const [mode, setMode] = useState<'ai' | 'manual'>('ai')
  const [aiInput, setAiInput] = useState(props.initialContent || '')
  const [front, setFront] = useState('')
  const [back, setBack] = useState('')
  const [aiResponse, setAiResponse] = useState<{front: string; back: string} | null>(null)
  
  const { generateFlashcard, loading } = useFlashcardAI()
  
  const handleGenerate = async () => {
    const result = await generateFlashcard(aiInput)
    if (result) {
      setAiResponse(result)
      setFront(result.front)
      setBack(result.back)
    }
  }
  
  const handleSave = () => {
    if (front.trim() && back.trim()) {
      props.onSave({ front, back })
      props.onClose()
    }
  }
  
  return (
    <Modal visible={props.visible} transparent animationType="slide">
      <SafeAreaView style={s.container}>
        <View style={s.header}>
          <Text style={s.title}>Create Flashcard</Text>
          <TouchableOpacity onPress={props.onClose}>
            <X size={24} />
          </TouchableOpacity>
        </View>
        
        <View style={s.tabs}>
          <TouchableOpacity
            style={[s.tab, mode === 'ai' && s.tabActive]}
            onPress={() => setMode('ai')}
          >
            <MessageCircle size={16} />
            <Text>AI Mode</Text>
          </TouchableOpacity>
          
          <TouchableOpacity
            style={[s.tab, mode === 'manual' && s.tabActive]}
            onPress={() => setMode('manual')}
          >
            <Edit size={16} />
            <Text>Manual</Text>
          </TouchableOpacity>
        </View>
        
        <ScrollView style={s.content}>
          {mode === 'ai' ? (
            <AIFlashcardForm
              input={aiInput}
              onInputChange={setAiInput}
              response={aiResponse}
              onGenerate={handleGenerate}
              loading={loading}
              onFrontChange={setFront}
              onBackChange={setBack}
              front={front}
              back={back}
            />
          ) : (
            <ManualFlashcardForm
              front={front}
              onFrontChange={setFront}
              back={back}
              onBackChange={setBack}
            />
          )}
        </ScrollView>
        
        <View style={s.footer}>
          <TouchableOpacity onPress={handleSave} disabled={!front.trim() || !back.trim()}>
            <Text>Save to Deck</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    </Modal>
  )
}
```

#### Use in PilotV2GlanceView:
```typescript
// Add state
const [flashcardModalOpen, setFlashcardModalOpen] = useState(false)

// In JSX
<FlashcardAIModal
  visible={flashcardModalOpen}
  onClose={() => setFlashcardModalOpen(false)}
  onSave={async (flashcard) => {
    // Get the note's subject/section from context
    const card = {
      id: generateId(),
      front_text: flashcard.front,
      back_text: flashcard.back,
      subject: 'From Pilot V2',
      section_group: title || 'General',
      microtopic: 'Custom'
    }
    
    await FlashcardSvc.createCard(userId, card)
    // Then show AddToFlashcardSheet to choose deck
    setFlashcardModalOpen(false)
  }}
  initialContent=""
  noteTitle={title}
/>
```

---

## Implementation Steps

### **Step 1: Create AI System** (30 mins)
- [ ] Create `src/hooks/useFlashcardAI.ts`
- [ ] Create `src/utils/parseFlashcard.ts`
- [ ] Test parsing with sample AI responses

### **Step 2: Create Components** (1 hour)
- [ ] Create `AIFlashcardForm.tsx`
- [ ] Create `ManualFlashcardForm.tsx`
- [ ] Create `FlashcardAIModal.tsx`

### **Step 3: Modify Flashcard/new.tsx** (1 hour)
- [ ] Add AI tab state
- [ ] Add AI processing function
- [ ] Add UI tabs
- [ ] Import components

### **Step 4: Integrate with Pilot V2** (30 mins)
- [ ] Update `PilotV2GlanceView.tsx` button handler
- [ ] Add modal to Pilot V2
- [ ] Test end-to-end

### **Step 5: Testing** (1 hour)
- [ ] AI response parsing
- [ ] Manual entry mode
- [ ] Saving to existing AddToFlashcardSheet
- [ ] iPad/mobile responsiveness

---

## User Journeys

### **Journey 1: AI Mode (30 seconds)**
```
1. Pilot V2: Click Sparkles button
2. Modal opens (AI mode by default)
3. Paste/type content: "The mitochondria..."
4. Click "Generate with AI"
5. ⏳ AI responds: "front - What is... - back - Mitochondria is... -"
6. System auto-parses and populates Front/Back fields
7. Click "Save & Choose Deck"
8. AddToFlashcardSheet opens → Choose deck → Saved ✓
```

### **Journey 2: Manual Mode (2 minutes)**
```
1. Pilot V2: Click Sparkles button
2. Modal opens
3. Click "Manual" tab
4. Type Front: "What is photosynthesis?"
5. Type Back: "Process of converting light to energy..."
6. Click "Save & Choose Deck"
7. AddToFlashcardSheet opens → Choose deck → Saved ✓
```

### **Journey 3: Flashcard/new.tsx AI Mode**
```
1. Navigate to /flashcards/new
2. Default to AI tab
3. Paste/type content
4. Click "Generate with AI"
5. Edit Front/Back if needed
6. Click "Save & Choose Deck"
7. AddToFlashcardSheet opens → Choose deck → Saved ✓
```

---

## AI System Prompt Examples

### For UPSC Preparation:
```
"Create a flashcard for UPSC exam prep.
Front: Max 100 words, should test understanding
Back: Max 200 words, include examples, use markdown for emphasis
Format: front - ... - back - ... -"
```

### For Competitive Exams:
```
"Create an MCQ-style flashcard.
Front: Question with options
Back: Correct answer with explanation
Format: front - ... - back - ... -"
```

---

## Error Handling

| Scenario | Action |
|----------|--------|
| AI API fails | Show error → Suggest manual entry |
| Parse fails | Show raw AI response → Let user edit manually |
| Network timeout | Retry with exponential backoff |
| Empty input | Disable button, show helpful message |
| Front/back too long | Trim to limits, warn user |

---

**Total Implementation Time: 3-4 hours**

Ready to implement? 🚀

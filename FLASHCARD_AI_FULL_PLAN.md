# AI-Powered Flashcard Creation - Enhanced Plan (Multi-Block + Image Support)

## Overview
Complete AI flashcard system that:
1. ✅ AI Tab with "Generate with AI" in flashcard creation
2. ✅ Manual Tab for traditional entry
3. 🆕 **Multi-Block Selection** from Pilot V2 Glance
4. 🆕 **Context-Aware AI** that understands selected blocks
5. 🆕 **Full Flashcard Page Integration** with image upload

---

## Part 1: Pilot V2 - Multi-Block Selection

### New Component: `src/components/pilot-v2/BlockSelector.tsx`

**Purpose**: Allow users to select 1-4 blocks from the glance view to create a flashcard

```typescript
interface BlockSelectorProps {
  blocks: PilotV2Block[]
  onSelect: (selectedBlocks: PilotV2Block[]) => void
  onCancel: () => void
}

export function BlockSelector(props: BlockSelectorProps) {
  const [selected, setSelected] = useState<Set<string>>(new Set())
  
  const handleToggle = (blockId: string) => {
    const newSelected = new Set(selected)
    if (newSelected.has(blockId)) {
      newSelected.delete(blockId)
    } else if (newSelected.size < 4) {
      // Max 4 blocks per card
      newSelected.add(blockId)
    }
    setSelected(newSelected)
  }
  
  const handleConfirm = () => {
    const selectedBlocks = props.blocks.filter(b => selected.has(b.id))
    props.onSelect(selectedBlocks)
  }
  
  return (
    <Modal visible={true} transparent animationType="slide">
      <SafeAreaView>
        <View style={s.header}>
          <Text style={s.title}>Select Blocks for Flashcard</Text>
          <TouchableOpacity onPress={props.onCancel}>
            <X size={24} />
          </TouchableOpacity>
        </View>
        
        <ScrollView style={s.list}>
          {props.blocks.map((block) => (
            <TouchableOpacity
              key={block.id}
              onPress={() => handleToggle(block.id)}
              disabled={selected.size >= 4 && !selected.has(block.id)}
              style={[
                s.blockItem,
                selected.has(block.id) && s.blockItemSelected
              ]}
            >
              <View>
                <Text style={s.blockType}>{block.type.toUpperCase()}</Text>
                <Text style={s.blockContent} numberOfLines={2}>
                  {block.text || block.imageUri ? '📷 Image' : 'Empty'}
                </Text>
              </View>
              <CheckBox
                checked={selected.has(block.id)}
                onChange={() => handleToggle(block.id)}
              />
            </TouchableOpacity>
          ))}
        </ScrollView>
        
        <View style={s.footer}>
          <Text style={s.counter}>
            {selected.size} / 4 blocks selected
          </Text>
          <TouchableOpacity
            onPress={handleConfirm}
            disabled={selected.size === 0}
            style={s.confirmBtn}
          >
            <Text style={s.confirmBtnText}>Create Flashcard</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    </Modal>
  )
}
```

### Updated PilotV2GlanceView.tsx

```typescript
// Add states
const [blockSelectorOpen, setBlockSelectorOpen] = useState(false)
const [selectedBlocks, setSelectedBlocks] = useState<PilotV2Block[]>([])

// Modified button handler
const handleCreateFlashcard = () => {
  // Open block selector first
  setBlockSelectorOpen(true)
}

// Handle block selection
const handleBlocksSelected = (blocks: PilotV2Block[]) => {
  setSelectedBlocks(blocks)
  setBlockSelectorOpen(false)
  
  // Now open AI modal with selected blocks
  // We'll navigate to the flashcard page with pre-filled content
  const combinedContent = blocks
    .map(b => b.text || '')
    .filter(t => t)
    .join('\n\n')
  
  router.push({
    pathname: '/flashcards/new',
    params: {
      aiPrefilledContent: combinedContent,
      subject: 'From Pilot V2',
      section: title || 'General',
      microtopic: 'Custom AI Generated',
      mode: 'ai' // Tell the page to start in AI mode
    }
  })
}

// Render in JSX
{blockSelectorOpen && (
  <BlockSelector
    blocks={blocks}
    onSelect={handleBlocksSelected}
    onCancel={() => setBlockSelectorOpen(false)}
  />
)}
```

---

## Part 2: Enhanced Flashcard Creation Page

### Updated `app/flashcards/new.tsx`

The existing page already has:
- ✅ Text input for Front/Back
- ✅ Image upload for Front/Back
- ✅ Destination deck selection
- ✅ AddToFlashcardSheet integration

Now add:
- 🆕 AI Tab with "Generate with AI"
- 🆕 Support for `aiPrefilledContent` and `mode` params

```typescript
const params = useLocalSearchParams<{   
  subject?: string
  section?: string
  microtopic?: string
  branchId?: string
  branchName?: string
  aiPrefilledContent?: string  // 🆕 From Pilot V2
  mode?: 'ai' | 'manual'       // 🆕 Start mode
}>()

// Default to AI mode if content provided
const [mode, setMode] = useState<'ai' | 'manual'>(
  params.mode === 'manual' ? 'manual' : 'ai'
)

// AI input from Pilot V2 blocks
const [aiInput, setAiInput] = useState(params.aiPrefilledContent || '')
const [aiResponse, setAiResponse] = useState<{front: string; back: string} | null>(null)
const [aiLoading, setAiLoading] = useState(false)

const { generateFlashcard, error: aiError } = useFlashcardAI()

const handleGenerateWithAI = async () => {
  if (!aiInput.trim()) {
    Alert.alert('Empty', 'Paste or select content to convert')
    return
  }
  
  setAiLoading(true)
  const result = await generateFlashcard(aiInput)
  if (result) {
    setAiResponse(result)
    setFront(result.front)
    setBack(result.back)
  }
  setAiLoading(false)
}

// In render:
<View style={s.tabContainer}>
  <TouchableOpacity
    style={[s.tab, mode === 'ai' && s.tabActive]}
    onPress={() => setMode('ai')}
  >
    <Sparkles size={16} color={mode === 'ai' ? colors.primary : colors.textTertiary} />
    <Text>AI Generation</Text>
  </TouchableOpacity>
  
  <TouchableOpacity
    style={[s.tab, mode === 'manual' && s.tabActive]}
    onPress={() => setMode('manual')}
  >
    <Edit size={16} color={mode === 'manual' ? colors.primary : colors.textTertiary} />
    <Text>Manual Entry</Text>
  </TouchableOpacity>
</View>

{mode === 'ai' ? (
  <View>
    {/* AI INPUT SECTION */}
    <Text style={s.label}>Content to Convert:</Text>
    <TextInput
      value={aiInput}
      onChangeText={setAiInput}
      placeholder="Paste or select content..."
      multiline
      style={s.largeTextArea}
    />
    
    <TouchableOpacity
      onPress={handleGenerateWithAI}
      disabled={aiLoading || !aiInput.trim()}
      style={[s.generateBtn, aiLoading && s.disabled]}
    >
      {aiLoading ? (
        <ActivityIndicator color="#fff" />
      ) : (
        <>
          <Sparkles size={18} color="#fff" />
          <Text style={s.generateBtnText}>Generate with AI</Text>
        </>
      )}
    </TouchableOpacity>
    
    {aiResponse && (
      <>
        {/* AI RESPONSE DISPLAY - EDITABLE */}
        <Text style={s.label}>Front (Question):</Text>
        <TextInput
          value={front}
          onChangeText={setFront}
          placeholder="Question or prompt..."
          multiline
          style={s.textArea}
        />
        
        <Text style={s.label}>Back (Answer):</Text>
        <TextInput
          value={back}
          onChangeText={setBack}
          placeholder="Answer or explanation..."
          multiline
          style={s.textArea}
        />
        
        {/* STILL SHOW IMAGE UPLOAD EVEN IN AI MODE */}
        <Text style={s.label}>Front Image (Optional):</Text>
        {frontImageUrl && (
          <Image source={{ uri: frontImageUrl }} style={s.previewImage} />
        )}
        <TouchableOpacity onPress={handleUploadFrontImage}>
          <ImagePlus size={20} />
          <Text>Upload Image</Text>
        </TouchableOpacity>
        
        <Text style={s.label}>Back Image (Optional):</Text>
        {backImageUrl && (
          <Image source={{ uri: backImageUrl }} style={s.previewImage} />
        )}
        <TouchableOpacity onPress={handleUploadBackImage}>
          <ImagePlus size={20} />
          <Text>Upload Image</Text>
        </TouchableOpacity>
        
        <TouchableOpacity
          onPress={handleGenerateWithAI}
          style={s.regenerateBtn}
        >
          <Text>Generate Again</Text>
        </TouchableOpacity>
      </>
    )}
  </View>
) : (
  <View>
    {/* EXISTING MANUAL MODE - NO CHANGES */}
    <Text style={s.label}>Front side</Text>
    <TextInput
      value={front}
      onChangeText={setFront}
      placeholder="Question or prompt..."
      multiline
      style={s.textArea}
    />
    
    {frontImageUrl && (
      <Image source={{ uri: frontImageUrl }} style={s.previewImage} />
    )}
    <TouchableOpacity onPress={handleUploadFrontImage}>
      <ImagePlus size={20} />
    </TouchableOpacity>
    
    <Text style={s.label}>Back side</Text>
    <TextInput
      value={back}
      onChangeText={setBack}
      placeholder="Answer or explanation..."
      multiline
      style={s.textArea}
    />
    
    {backImageUrl && (
      <Image source={{ uri: backImageUrl }} style={s.previewImage} />
    )}
    <TouchableOpacity onPress={handleUploadBackImage}>
      <ImagePlus size={20} />
    </TouchableOpacity>
  </View>
)}

{/* DESTINATION DECK SELECTION - SAME FOR BOTH MODES */}
<Text style={s.label}>DESTINATION</Text>
<TouchableOpacity
  onPress={() => setDestinationPicker(true)}
  style={s.destinationBtn}
>
  <Text>{destinationLabel || 'Choose a deck...'}</Text>
</TouchableOpacity>

{/* SAVE BUTTON - SAME FOR BOTH MODES */}
<TouchableOpacity
  onPress={save}
  disabled={saving || !front.trim() || !back.trim() || !destination}
  style={s.saveBtn}
>
  {saving ? (
    <ActivityIndicator color="#fff" />
  ) : (
    <CheckCircle2 size={20} color="#fff" />
  )}
  <Text style={s.saveBtnText}>Save Card</Text>
</TouchableOpacity>
```

---

## Part 3: AI System Components

### Component 1: `src/hooks/useFlashcardAI.ts`

```typescript
export const FLASHCARD_SYSTEM_PROMPT = `You are an expert flashcard creator for UPSC exam preparation.

CRITICAL: Respond ONLY in this exact format:
front - [question/prompt here] - back - [answer/explanation here] -

Rules:
1. Front: Max 100 words, clear and specific
2. Back: Max 200 words, complete answer with examples
3. Use markdown for emphasis (**bold**, *italic*)
4. Must be self-contained
5. NO text before or after the format
6. NO explanations or disclaimers`

export function useFlashcardAI() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  
  const generateFlashcard = async (content: string): Promise<{front: string; back: string} | null> => {
    setLoading(true)
    setError(null)
    
    try {
      // Call existing AI API (uses Groq/Gemini from codebase)
      const aiResponse = await callAIAPI({
        systemPrompt: FLASHCARD_SYSTEM_PROMPT,
        userPrompt: `Convert this content into a flashcard:\n\n${content}`
      })
      
      const parsed = parseFlashcardResponse(aiResponse)
      if (!parsed) {
        setError('AI response format incorrect. Please try again.')
        return null
      }
      
      return parsed
    } catch (err: any) {
      setError(err.message || 'Failed to generate flashcard')
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
export function parseFlashcardResponse(response: string): {front: string; back: string} | null {
  if (!response) return null
  
  // Pattern 1: "front - [content] - back - [content] -"
  const match1 = response.match(/front\s*[-–]\s*([\s\S]*?)\s*[-–]\s*back\s*[-–]\s*([\s\S]*?)\s*[-–]\s*$/i)
  
  if (match1) {
    return {
      front: match1[1].trim(),
      back: match1[2].trim()
    }
  }
  
  // Pattern 2: "FRONT: [content] BACK: [content]"
  const match2 = response.match(/front:\s*([\s\S]*?)\s*back:\s*([\s\S]*?)$/i)
  if (match2) {
    return {
      front: match2[1].trim(),
      back: match2[2].trim()
    }
  }
  
  // Pattern 3: Simple split
  const parts = response.split(' - ')
  if (parts.length >= 2) {
    return {
      front: parts[0].trim(),
      back: parts.slice(1).join(' - ').trim()
    }
  }
  
  return null
}
```

---

## Complete User Journey

### **Scenario: Create Flashcard from Multiple Pilot V2 Blocks with AI**

```
1. User reading Pilot V2 note (about mitochondria)
   ├─ Block 1: "Definition: Mitochondria is the powerhouse..."
   ├─ Block 2: "Function: Produces ATP through cellular respiration..."
   └─ Block 3: "Location: Found in cytoplasm of eukaryotic cells..."

2. Click Sparkles ✨ button

3. BlockSelector modal opens
   ├─ ☐ Block 1 (Definition)
   ├─ ☐ Block 2 (Function)
   ├─ ☑ Block 3 (Location) ← User selects multiple
   └─ "Create Flashcard" button

4. Navigates to /flashcards/new with:
   └─ aiPrefilledContent: "Combined content from 2-3 blocks"
   └─ mode: 'ai'
   └─ subject: 'From Pilot V2'

5. Flashcard page loads in AI mode
   ├─ Input box already has combined block content
   └─ Default: AI tab selected

6. Click "Generate with AI" button
   ├─ ⏳ AI processes combined blocks as context
   ├─ AI understands it's about multiple aspects of mitochondria
   └─ Returns: "front - What are the key functions and location of mitochondria? - back - Mitochondria are cellular organelles found in the cytoplasm. They produce ATP through cellular respiration, providing energy for cell functions. Location: present in most eukaryotic cells. -"

7. System auto-parses and fills:
   ├─ Front: "What are the key functions and location of mitochondria?"
   ├─ Back: "Mitochondria are cellular organelles..."
   └─ User can edit both fields

8. (Optional) User adds images:
   ├─ Front image: Diagram of mitochondria structure
   └─ Back image: Diagram of ATP production

9. Click "Save Card" button
   ├─ AddToFlashcardSheet opens
   └─ User selects destination deck
   └─ Flashcard saved with:
       ├─ Text front/back (from AI)
       ├─ Images (optional)
       ├─ Subject, section, microtopic
       └─ Destination deck

10. ✅ Success! Card created and saved
```

**Total time: 1-2 minutes (faster than manual entry!)**

---

## Implementation Roadmap

| Step | Component | Time |
|------|-----------|------|
| 1 | Create `useFlashcardAI.ts` hook | 15 min |
| 2 | Create `parseFlashcard.ts` parser | 15 min |
| 3 | Create `BlockSelector.tsx` component | 30 min |
| 4 | Update `PilotV2GlanceView.tsx` | 20 min |
| 5 | Add AI tabs to `flashcards/new.tsx` | 45 min |
| 6 | Integrate AI generation | 30 min |
| 7 | Test end-to-end | 30 min |
| 8 | Polish UI/UX | 15 min |

**Total: ~3.5 hours**

---

## Key Features

✅ **Multi-Block Selection**
- Users can select 1-4 blocks
- Each block shown with type indicator
- Max 4 blocks enforced

✅ **Context-Aware AI**
- AI receives all selected blocks as context
- Understands relationships between blocks
- Generates more comprehensive flashcards

✅ **Full Flashcard Support**
- AI-generated text for Front/Back
- Image upload for both sides (optional)
- Deck selection via existing AddToFlashcardSheet

✅ **Dual Mode**
- AI Mode: Fast (paste content → AI generates)
- Manual Mode: Traditional (type front/back)

✅ **Edit Before Saving**
- Users can edit AI-generated front/back
- Add/remove images
- Change destination deck

---

## Error Handling

| Scenario | Action |
|----------|--------|
| No blocks selected | "Select at least 1 block" |
| AI fails | Show error, suggest retry or manual mode |
| Parse fails | Show raw response, let user edit manually |
| Empty AI input | Disable button, show helper text |
| Network timeout | Exponential backoff + retry |

---

**Ready to implement? Start with Step 1-2 (AI hook & parser)?** 🚀

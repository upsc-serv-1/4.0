# Flashcard Creation Feature - Design & Implementation Plan

## Overview
Add an intelligent flashcard creation flow directly from Pilot/Glance that leverages AI to convert study notes/blocks into structured flashcards with minimal effort.

---

## Feature Requirements

### 1. **UI Components to Create**

#### A. `QuickFlashcardModal.tsx`
- Full-screen modal overlay
- Header: "Create Flashcard" with close button
- Three main sections:
  1. **Front/Back Input Fields**
     - Front card field (question/prompt)
     - Back card field (answer)
     - Clear/reset buttons
  
  2. **AI Assistant Panel** (right side on tablet, collapsible on mobile)
     - Preset commands for flashcard creation
     - Chat input for custom AI prompts
     - Response display area
  
  3. **Action Footer**
     - "Save to Flashcard Deck" button
     - "Clear & New" button
     - "Create Multiple" toggle for batch processing

#### B. `FlashcardAIPresets.tsx`
- Reusable preset command buttons:
  - 🔄 "Convert to Q&A"
  - 📝 "Simplify Definition"
  - 🎯 "Extract Key Point"
  - 💡 "Create Mnemonics"
  - 🔗 "Link Related Concept"
- Each preset has a system prompt optimized for flashcards

#### C. `BlockSelector.tsx` (Modal)
- Multi-select UI for choosing 1-4 blocks
- Visual indicators for selected blocks
- Preview of combined content
- Combine/Merge button

#### D. `FlashcardFormatParser.ts`
- Parse AI responses with format: "front - back -"
- Handle edge cases (multiline content, special characters)
- Extract front and back content programmatically

---

## Implementation Architecture

### 2. **Data Flow**

```
Glance/Pilot View
    ↓
[Button: "Quick Flashcard AI"] → Opens QuickFlashcardModal
    ↓
User Input:
  ├─ Paste/type directly OR
  ├─ Select blocks from note OR
  ├─ Use AI presets to enhance
    ↓
AI Processing:
  ├─ Send block content + preset/custom prompt to AI
  ├─ AI responds with "front - back -" format
  ├─ Parser extracts front/back automatically
    ↓
Front/Back Fields Auto-Populated
    ↓
User Reviews & Clicks "Save Flashcard"
    ↓
Flashcard Created & Saved to Deck (using existing AddToFlashcardSheet)
```

### 3. **Integration Points**

#### A. **In Glance View** (`app/capsule/glance/[id].tsx`)
- Add new button in top toolbar (after "Edit" button)
- Button: Icon (Zap/Sparkles) + "Flashcard AI"
- Opens QuickFlashcardModal with:
  - Current block content pre-filled (if single block selected)
  - Subject/topic context from notebook metadata

#### B. **In Inline Glance** (`app/capsule/index.tsx`)
- Add button in inline glance toolbar
- Same functionality as above

#### C. **In Pilot V2 Notes** (if applicable)
- Add to action toolbar
- Same feature

### 4. **Component Hierarchy**

```
QuickFlashcardModal
├── FlashcardHeader
├── ContentSection
│   ├── BlockSelectorButton (if multi-block enabled)
│   ├── FrontCardInput
│   └── BackCardInput
├── AIAssistantPanel
│   ├── FlashcardAIPresets (preset buttons)
│   ├── AIChat (custom prompt input)
│   └── AIResponseDisplay
└── ActionFooter
    ├── SaveButton
    ├── ClearButton
    └── BatchModeToggle
```

---

## AI Integration Details

### 5. **AI Prompts & Presets**

#### System Prompt Template (Flashcard Mode):
```
You are a flashcard creation expert for UPSC exam preparation.
Your task is to convert the provided study material into a high-quality flashcard.

IMPORTANT: Always respond in this exact format:
front - back -

Where:
- front: A concise question or prompt (keep under 100 words)
- back: The answer or explanation (keep under 200 words)

Use markdown formatting where helpful (bold for key terms, bullets for lists).
Make sure the flashcard is self-contained and doesn't require external context.
```

#### Preset Commands:
1. **"Convert to Q&A"**
   - "Convert this text into a question-and-answer flashcard. Make the question specific and the answer complete but concise. Use front - back - format."

2. **"Simplify Definition"**
   - "Create a flashcard where the front is the term and back is a simple, easy-to-remember definition. Include a usage example if relevant. Format: front - back -"

3. **"Extract Key Point"**
   - "From this passage, extract the single most important concept and create a flashcard about it. Make it memorable. Format: front - back -"

4. **"Create Mnemonics"**
   - "Create a flashcard with a mnemonic device or memory aid on the back. The front should be the thing to remember. Format: front - back -"

5. **"Link Related Concept"**
   - "Create a flashcard that links this concept to a related UPSC topic. Front: connection question, Back: explanation of relationship. Format: front - back -"

#### Custom Prompt Support:
- User can ask: "Make this more complex" or "Simplify this" or "Add exam context"
- System message prepends flashcard format instruction to custom prompt

### 6. **Response Format Parsing**

**Parser Logic:**
```typescript
function parseFlashcardResponse(aiResponse: string): { front: string; back: string } | null {
  // Look for "front - back -" pattern
  const match = aiResponse.match(/front\s*[-–]\s*([\s\S]*?)\s*[-–]\s*back\s*[-–]\s*([\s\S]*?)\s*(?:[-–]\s*)?$/i);
  
  if (!match) {
    // Fallback: look for first " - " as delimiter
    const parts = aiResponse.split(' - ');
    if (parts.length >= 2) {
      return { front: parts[0].trim(), back: parts.slice(1).join(' - ').trim() };
    }
    return null;
  }
  
  return {
    front: match[1].trim(),
    back: match[2].trim()
  };
}
```

---

## Multi-Block Flashcard Creation

### 7. **Block Selection Flow**

**When user clicks "Use Multiple Blocks":**
1. Modal shows mini-list of all blocks in current notebook
2. User taps to select 1-4 blocks (visual checkmarks)
3. Preview section shows: "Selected 3 blocks - {summary}"
4. Clicking "Combine" merges block content into Front field
5. User then refines with AI or edits manually

**Example:**
```
Block 1: "The British Raj lasted from 1858 to 1947."
Block 2: "It was preceded by the East India Company rule."
Block 3: "Major events: 1857 Rebellion, 1905 Partition, 1947 Independence."

↓ [Combine Blocks]

Front field pre-filled with combined narrative:
"The British Raj (1858-1947) followed East India Company rule. Key events: 1857 Rebellion, 1905 Partition, 1947 Independence."

Then user can ask AI: "Create a flashcard from this history summary"
```

---

## User Workflows

### 8. **Workflow A: Single Block → Quick Flashcard**
1. User reading Glance
2. Selects a paragraph they want to memorize
3. Taps "Flashcard AI" button → Modal opens with block text in Front field
4. Taps preset "Extract Key Point" → AI generates back field
5. Reviews → Clicks "Save Flashcard" → AddToFlashcardSheet opens → Done

**Time: ~30 seconds**

### 9. **Workflow B: Multi-Block → Combined Flashcard**
1. User reading Glance
2. Taps "Flashcard AI" → Modal opens
3. Clicks "Use Multiple Blocks" → BlockSelector appears
4. Checks 3-4 related blocks
5. Clicks "Combine" → Blocks merged into Front field
6. Asks AI: "Create a comprehensive flashcard from this"
7. AI responds with well-structured front/back
8. Clicks "Save Flashcard" → Done

**Time: ~1 minute**

### 10. **Workflow C: Custom AI Chat**
1. User pastes text or uses blocks
2. Asks custom question: "Make this harder" or "Explain like I'm 5"
3. AI responds with new flashcard format
4. Can iterate multiple times
5. When satisfied, saves to deck

**Time: ~2-3 minutes (interactive)**

---

## Technical Implementation Steps

### 11. **Phase 1: Core Modal & Basic AI**
- [ ] Create `QuickFlashcardModal.tsx`
- [ ] Create `FlashcardAIPresets.tsx`
- [ ] Create AI preset system with hook `useFlashcardAIChat`
- [ ] Integrate with existing Groq/Gemini API
- [ ] Test format parsing with sample responses

### 12. **Phase 2: UI & UX Polish**
- [ ] Add to Glance view toolbar
- [ ] Add to Inline Glance toolbar
- [ ] Create smooth animations for modal open/close
- [ ] Add loading states and error handling
- [ ] Test on iPad (tablet layout)

### 13. **Phase 3: Multi-Block Support**
- [ ] Create `BlockSelector.tsx` component
- [ ] Implement block combination logic
- [ ] Add preview of combined content
- [ ] Test with 2-4 blocks

### 14. **Phase 4: Integration & Testing**
- [ ] Wire up to existing `AddToFlashcardSheet`
- [ ] Pass created flashcard to deck selection
- [ ] End-to-end testing
- [ ] Performance testing with large blocks

---

## Key Considerations

### 12. **UX Principles**
- **Minimal friction**: One-tap access from Glance
- **Smart defaults**: Pre-fill with block content
- **Progressive disclosure**: Advanced features (multi-block, custom prompts) hidden initially
- **Forgiving**: Easy to reset, go back, try again
- **Mobile-first**: Works great on iPad, not cluttered on phone

### 13. **AI Safety & Quality**
- Always show AI response before confirming
- Allow editing of front/back even after AI generation
- Rate limiting on API calls
- Handle AI failures gracefully with fallback
- Show parsing errors if format doesn't match

### 14. **Performance**
- Keep modal lightweight
- Lazy-load AI chat only when needed
- Cache AI presets locally
- Debounce custom prompts to avoid excessive API calls

### 15. **Future Enhancements**
- Batch create multiple flashcards from single note
- Smart topic extraction for deck suggestion
- Flashcard templates (MCQ, Fill-in-blank, Image-based)
- Collaborative flashcard refinement
- Spaced repetition hints based on content difficulty

---

## File Structure

```
src/components/
├── flashcard/
│   ├── QuickFlashcardModal.tsx         (main modal component)
│   ├── FlashcardAIPresets.tsx          (preset buttons)
│   ├── BlockSelector.tsx               (multi-block selector)
│   └── FlashcardFormatParser.ts        (parser utility)
│
│ and or new files:
│   ├── flashcards/QuickFlashcardModal.tsx
│   ├── flashcards/FlashcardAIPresets.tsx
│   ├── flashcards/BlockSelector.tsx
│   └── flashcards/FlashcardFormatParser.ts

src/hooks/
├── useFlashcardAIChat.ts               (AI chat logic & presets)

src/types/
├── flashcard.ts                        (types for flashcard modal)
```

---

## Example Code Snippets

### A. AI Preset Hook Usage:
```typescript
const { presets, chat, response, isLoading } = useFlashcardAIChat();

// When user taps a preset
const handlePresetTap = async (preset) => {
  const fullPrompt = `${preset.systemPrompt}\n\nContent: ${frontFieldValue}`;
  const result = await chat(fullPrompt);
  const parsed = parseFlashcardResponse(result);
  if (parsed) {
    setBackField(parsed.back);
    setFrontField(parsed.front);
  }
};
```

### B. Format Parsing:
```typescript
const aiResponse = "front - What is photosynthesis? - back - The process by which plants convert light energy into chemical energy. -";
const { front, back } = parseFlashcardResponse(aiResponse);
// { front: "What is photosynthesis?", back: "The process by which..." }
```

---

## Success Metrics
- ✅ Users create 10%+ more flashcards per session
- ✅ Average flashcard creation time < 1 minute
- ✅ AI-generated flashcards have > 90% validation rate (no manual fix needed)
- ✅ No performance degradation in Glance view
- ✅ Feature adopted by 60%+ of active users

---

**Status**: Ready for implementation  
**Priority**: High  
**Estimated Effort**: 4-5 days  
**Team**: Frontend + AI Integration

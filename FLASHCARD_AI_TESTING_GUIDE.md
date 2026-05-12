# AI Flashcard Integration - Quick Start & Testing Guide

## 🚀 How to Use

### From Pilot V2 Note Reading:

1. **Open a Pilot V2 note** in glance view
2. **Locate the Sparkles button** (⭐ icon) in top toolbar
3. **Click Sparkles button** → BlockSelector modal opens
4. **Select 1-4 blocks** from your note:
   - 📌 Headings
   - 📝 Paragraphs  
   - • Bullet points
   - 1. Numbered lists
   - ☑ Checklists
   - ❝ Quotes
   - </> Code blocks
5. **Tap "Select" or block count** to confirm
6. **Auto-navigates to /flashcards/new** with:
   - AI tab active
   - Content pre-filled from selected blocks
   - Ready to generate

### In Flashcard Creation Page:

#### AI Tab (Default from Pilot V2)
```
Content Input Field
├── Pre-filled from Pilot V2 blocks
├── Editable if you want to modify
└── Shows: "X characters"

[Generate with AI] Button
├── Calls AI with FLASHCARD_SYSTEM_PROMPT
├── Shows loading spinner while generating
└── Auto-fills front/back when done

Front/Back Fields
├── Auto-populated by AI
├── Editable for refinement
└── Can regenerate if not satisfied
```

#### Manual Tab
- Traditional manual entry (unchanged)
- Both tabs support image upload

#### Actions
1. **Generate** → AI creates flashcard
2. **Edit** → Modify front/back text
3. **Add Images** → Upload for front/back
4. **Select Deck** → Choose destination
5. **Save** → Creates card in database

---

## ✅ Testing Checklist

### Phase 1: Component Rendering
- [ ] Sparkles button visible in Pilot V2 glance
- [ ] BlockSelector modal opens on button tap
- [ ] Block type icons display correctly
- [ ] Counter shows "X / 4 blocks selected"
- [ ] AI Tab visible in flashcard creation page
- [ ] Tab styling matches design

### Phase 2: Block Selection
- [ ] Can select individual blocks
- [ ] Selected blocks highlight
- [ ] Disabled state after 4 blocks selected
- [ ] Cancel button closes modal
- [ ] Select button combines blocks correctly
- [ ] Formatting preserved (bullets, headings, etc.)

### Phase 3: Navigation & Data Passing
- [ ] Navigation triggers from BlockSelector
- [ ] aiPrefilledContent parameter passed
- [ ] mode='ai' parameter passed
- [ ] Pilot V2 metadata passed correctly
- [ ] AI Tab shows pre-filled content
- [ ] Manual Tab still accessible

### Phase 4: AI Generation
- [ ] "Generate with AI" button clickable
- [ ] Loading spinner displays during generation
- [ ] AI response received (check console/network)
- [ ] Response parsed correctly
- [ ] Front/back fields auto-populate
- [ ] Error message displays if parsing fails
- [ ] Error message displays if API fails

### Phase 5: User Editing
- [ ] Front/back fields editable after generation
- [ ] Can modify generated content
- [ ] Can add images to both sides
- [ ] Deck selection works
- [ ] Save creates card successfully
- [ ] Manual mode still works without AI

### Phase 6: Error Scenarios
- [ ] Empty content shows error
- [ ] Invalid API key shows helpful message
- [ ] Network timeout handled gracefully
- [ ] Malformed AI response shows retry prompt
- [ ] Multiple errors don't cause crashes

---

## 🧪 Test Cases

### Test 1: Happy Path
```
Input: Select 2 bullet points about Article 14
Expected: 
- Modal closes
- Page navigates to /flashcards/new
- AI Tab active with bullets pre-filled
- Click "Generate with AI"
- Front: Question about Article 14
- Back: Definition and explanation
- Save successfully
```

### Test 2: Multi-Type Selection
```
Input: Select heading + quote + 2 bullets about photosynthesis
Expected:
- All 4 blocks combined with formatting
- AI understands full context
- Generated flashcard is more accurate
```

### Test 3: Manual Override
```
Input: Generate flashcard, then edit both sides
Expected:
- Front/back fields remain editable
- User changes are preserved
- Save uses edited version
```

### Test 4: Fallback Parser
```
Input: AI responds with non-standard format
Expected:
- Parser tries all 5 fallback patterns
- Correctly extracts front/back
- User sees valid result
```

### Test 5: Image Upload
```
Input: Generate flashcard, add images to front and back
Expected:
- Both modes support image upload
- Images appear in preview
- Card saves with images
```

### Test 6: Different Providers
```
Setup: Change AI provider to Groq (via Settings)
Input: Generate flashcard
Expected:
- callAI automatically uses Groq
- Generation works same way
- Response parsing identical
```

---

## 🔍 Debug Checklist

### Check Console Logs
```
[useFlashcardAI] Starting generation...
[useFlashcardAI] AI response: "front - ... - back - ... -"
[useFlashcardAI] Parsed: { front: "...", back: "..." }
```

### Check Network Tab
- POST to Gemini API / Groq API / OpenRouter
- Payload includes: systemPrompt + content
- Response includes: text with "front - ... - back - ..."

### Check React DevTools
- `blockSelectorOpen` state toggles on Sparkles
- `mode` state is 'ai' from Pilot V2
- `aiInput` contains combined blocks
- `front` and `back` update after generation

### Redux DevTools (if available)
- Check if flashcard service receives correct metadata
- Verify BranchPlacement works with AI-generated cards

---

## 📝 Example Test Content

### Test Block 1: Simple Bullet Points
```
• Article 14 guarantees equality before law
• Applies to state action only
• Protects from arbitrary discrimination
```
Expected Front: "What does Article 14 provide?"
Expected Back: "Equality before law, applies to state, prevents arbitrary discrimination"

### Test Block 2: Mixed Content
```
# Mitochondria
> The powerhouse of the cell
- Produces ATP through aerobic respiration
- Contains own DNA (circular)
- Present in most eukaryotic cells
```
Expected Front: "What is the primary function of mitochondria?"
Expected Back: "Produces ATP through aerobic respiration; contains circular DNA; found in eukaryotes"

### Test Block 3: Complex Fact
```
Article 368 - Amendment Procedure
- Can be amended by 2/3 majority in both houses
- Requires President's assent
- No judicial review of amendment validity
- Exception: Basic structure cannot be amended
```
Expected Front: "What is the procedure for amending the Constitution?"
Expected Back: "2/3 majority in both houses, President's assent, no judicial review, basic structure immutable"

---

## 🚨 Known Limitations

1. **Image Parsing**: AI sees text only, not images (images must be uploaded separately)
2. **Long Content**: Very long blocks may exceed token limits (will show error)
3. **Special Characters**: Some Unicode may not parse correctly (rare)
4. **Format Variants**: If response format is very different, parser may fail (retry)

---

## 💡 Tips for Best Results

1. **Use Meaningful Blocks**: Select related blocks for context
2. **Keep Concise**: Very long blocks may generate verbose cards
3. **Include Context**: Don't skip important headings/introductions
4. **Review & Edit**: AI responses are suggestions, always review
5. **Test with Different Providers**: Groq often faster, Gemini more accurate
6. **Check Settings**: Ensure API key is valid and provider is selected

---

## 📞 Troubleshooting

### "Content cannot be empty"
- You passed empty content to AI
- Make sure blocks are selected before clicking "Generate"

### "Failed to parse AI response"
- AI response was in unexpected format
- Try again - it may work on retry
- If persistent, check AI provider's API status

### No blocks appear in BlockSelector
- Ensure note has content (check note data in PilotV2Context)
- DEMO_BLOCKS should show if no real blocks

### Generate button not working
- Check browser console for errors
- Verify AI provider has valid API key
- Check network tab for API calls

### Front/back not auto-filling
- Check console for parse errors
- Verify API response in network tab
- Try manual entry as workaround

---

## 📊 Metrics to Track

- Time from block selection to generation
- Parse success rate (pass/fail)
- User edit frequency (original vs edited content)
- Save success rate
- API error rates by provider
- Average front/back length

---

**Last Updated:** Implementation Complete
**Status:** Ready for QA Testing
**Contacts:** Development Team

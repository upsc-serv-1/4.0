# Flashcard AI Feature - UI Wireframes & Mockups

## 1. Desktop/Tablet View - Full Layout

```
┌─────────────────────────────────────────────────────────────────────┐
│ 🔙 Back  ◻️ Sidebar  Subject › Title  🔔 Pin ↗️  ⋯              [Edit] │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  CAPSULE CONTENT (GLANCE)           │  QUICK FLASHCARD AI         │
│  ═════════════════════════════════  │  ═════════════════════════  │
│                                     │                             │
│  Block 1: Definition                │  Create Flashcard ✕        │
│  "Photosynthesis is the process..." │                             │
│  [Select] [Copy] [+Flashcard AI] ← │  FRONT:                    │
│  ─────────────────────────────────  │  ┌─────────────────────────┐
│                                     │  │ "Photosynthesis is the  │
│  Block 2: Examples                  │  │ process..."             │
│  "Examples include plants, algae..." │  │                         │
│  [Select] [Copy] [+Flashcard AI]    │  │ 145 / 500              │
│  ─────────────────────────────────  │  └─────────────────────────┘
│                                     │                             │
│  Block 3: Key Points                │  BACK:                     │
│  "Key points: light energy..."      │  ┌─────────────────────────┐
│  [Select] [Copy] [+Flashcard AI]    │  │ (empty)                 │
│  ─────────────────────────────────  │  │                         │
│                                     │  │ 0 / 1000                │
│  [End of Glance]                    │  └─────────────────────────┘
│                                     │                             │
│                                     │  QUICK PRESETS:             │
│                                     │  ┌─────────────────────────┐
│                                     │  │ [🔄 Q&A] [💡 Simple]  │
│                                     │  │ [🎯 Key] [🧠 Mnemon]  │
│                                     │  │ [🔗 Link]              │
│                                     │  └─────────────────────────┘
│                                     │                             │
│                                     │  CUSTOM AI PROMPT:          │
│                                     │  ┌─────────────────────────┐
│                                     │  │ Ask AI to enhance...   │
│                                     │  │                        │ 📤
│                                     │  └─────────────────────────┘
│                                     │                             │
│                                     │  [Select Blocks] [Batch]   │
│                                     │  [Clear] [Save Flashcard]   │
│                                     │                             │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 2. Mobile View - Stacked Layout

### Screen 1: Glance with Flashcard AI Button
```
┌──────────────────────────────┐
│ 🔙 ◻️ Subject › Title ⋯  │
├──────────────────────────────┤
│ Capsule Title                │
├──────────────────────────────┤
│                              │
│ Block 1 Content              │
│ Lorem ipsum dolor sit amet...│
│ [+Flashcard AI]              │
│ ─────────────────────────────│
│                              │
│ Block 2 Content              │
│ Lorem ipsum dolor sit amet...│
│ [+Flashcard AI]              │
│ ─────────────────────────────│
│                              │
│ [End of Glance]              │
│                              │
└──────────────────────────────┘
```

### Screen 2: Flashcard Modal (Front Input)
```
┌──────────────────────────────┐
│ Create Flashcard          ✕ │
├──────────────────────────────┤
│                              │
│ FRONT                        │
│ ┌────────────────────────────┐
│ │ What is photosynthesis?   │
│ │                            │
│ │ 34 / 500                   │
│ └────────────────────────────┘
│                              │
│ [Show Presets ▼]             │
│                              │
│ BACK                         │
│ ┌────────────────────────────┐
│ │                            │
│ │                            │
│ │ 0 / 1000                   │
│ └────────────────────────────┘
│                              │
│ [Select Blocks] [Batch]      │
│                              │
│ [Clear] [Save Flashcard] [✓] │
└──────────────────────────────┘
```

### Screen 3: Presets Expanded
```
┌──────────────────────────────┐
│ Create Flashcard          ✕ │
├──────────────────────────────┤
│ FRONT                        │
│ ┌────────────────────────────┐
│ │ What is photosynthesis?   │
│ └────────────────────────────┘
│                              │
│ QUICK PRESETS:               │
│ ┌────────────────────────────┐
│ │ 🔄 Convert to Q&A          │
│ │ Turn into question & answer│
│ │                            │
│ │ 💡 Simplify Definition     │
│ │ Simple term→definition     │
│ │                            │
│ │ 🎯 Extract Key Point       │
│ │ Pull out main concept      │
│ │                            │
│ │ 🧠 Create Mnemonics        │
│ │ Build memory aids          │
│ │                            │
│ │ 🔗 Link Related            │
│ │ Connect to other topics    │
│ └────────────────────────────┘
│                              │
│ BACK                         │
│ ┌────────────────────────────┐
│ │                            │
│ └────────────────────────────┘
│                              │
│ [Clear] [Save Flashcard]     │
└──────────────────────────────┘
```

### Screen 4: After AI Response
```
┌──────────────────────────────┐
│ Create Flashcard          ✕ │
├──────────────────────────────┤
│ FRONT                        │
│ ┌────────────────────────────┐
│ │ What is photosynthesis?   │
│ │ (in 25 words or less)      │
│ │ 45 / 500                   │
│ └────────────────────────────┘
│                              │
│ [Custom: "Make it harder"]   │
│ ⏳ AI is generating...       │
│                              │
│ BACK                         │
│ ┌────────────────────────────┐
│ │ Photosynthesis is the     │
│ │ process by which plants   │
│ │ convert light energy into  │
│ │ chemical energy (glucose). │
│ │ Occurs in chloroplasts.    │
│ │ 2H₂O + CO₂ + Light → C₆H₁₂O₆ + O₂
│ │ 203 / 1000                 │
│ └────────────────────────────┘
│                              │
│ ✓ Quality: High confidence   │
│                              │
│ [Clear] [Save Flashcard] [✓] │
└──────────────────────────────┘
```

### Screen 5: Block Selector
```
┌──────────────────────────────┐
│ Select Blocks (2/4)       ✕ │
├──────────────────────────────┤
│                              │
│ ☐ Block 1: Definition        │
│   "Photosynthesis is..."    │
│   ─────────────────────────  │
│                              │
│ ☑ Block 2: Process           │
│   "Light stage occurs in..." │ ← Selected
│   ─────────────────────────  │
│                              │
│ ☐ Block 3: Products          │
│   "Creates glucose and O₂"   │
│   ─────────────────────────  │
│                              │
│ ☑ Block 4: Key Equations     │
│   "C₆H₁₂O₆ + O₂ = 6CO₂..."   │ ← Selected
│   ─────────────────────────  │
│                              │
│ PREVIEW:                     │
│ Block 2 + Block 4 content... │
│                              │
│     [Combine Selected]       │
└──────────────────────────────┘
```

---

## 3. Desktop/Tablet - Preset Interactions

### Preset Button States
```
DEFAULT (Hover):
┌──────────────────────┐
│  🔄 Convert to Q&A   │
│  Turn into Q&A       │
└──────────────────────┘

SELECTED (Active):
┌──────────────────────┐
│ ▓ 🔄 Convert to Q&A  │
│   Turn into Q&A      │
└──────────────────────┘

LOADING (Processing):
┌──────────────────────┐
│  ⟳ Converting...     │
│  Turn into Q&A       │
└──────────────────────┘

COMPLETED (Success):
┌──────────────────────┐
│  ✓ Convert to Q&A    │
│  Turn into Q&A       │
└──────────────────────┘
```

---

## 4. Desktop Modal - Detailed Layout

```
┌─────────────────────────────────────────────────────┐
│ Create Flashcard                              ✕    │
├─────────────────────────────────────────────────────┤
│                                                     │
│ ┌──────────────────────────┬──────────────────────┐ │
│ │                          │                      │ │
│ │ FRONT                    │ QUICK PRESETS       │ │
│ │ ┌──────────────────────┐ │ ┌──────────────────┐ │
│ │ │ What is              │ │ │ 🔄 Convert to   │ │
│ │ │ photosynthesis?      │ │ │    Q&A           │ │
│ │ │                      │ │ └──────────────────┘ │
│ │ │                      │ │ ┌──────────────────┐ │
│ │ │ 45 / 500             │ │ │ 💡 Simplify      │
│ │ │                      │ │ │    Definition    │
│ │ └──────────────────────┘ │ └──────────────────┘ │
│ │                          │ ┌──────────────────┐ │
│ │ BACK                     │ │ 🎯 Extract Key   │
│ │ ┌──────────────────────┐ │ │ Point            │
│ │ │ Photosynthesis is    │ │ └──────────────────┘ │
│ │ │ the process by which │ │ ┌──────────────────┐ │
│ │ │ plants convert light │ │ │ 🧠 Create        │
│ │ │ energy into chemical │ │ │ Mnemonics        │
│ │ │ energy (glucose).    │ │ └──────────────────┘ │
│ │ │                      │ │ ┌──────────────────┐ │
│ │ │ 200 / 1000           │ │ │ 🔗 Link Related  │
│ │ │                      │ │ │ Concept          │
│ │ └──────────────────────┘ │ └──────────────────┘ │
│ │                          │                      │
│ │ [Select Blocks] [Batch]  │ CUSTOM PROMPT      │
│ │                          │ ┌──────────────────┐ │
│ │                          │ │ Ask AI: "Make    │ │
│ │                          │ │ this more exam-  │ │
│ │                          │ │ focused"  [Send] │ │
│ │                          │ └──────────────────┘ │
│ │                          │                      │
│ └──────────────────────────┴──────────────────────┘ │
│                                                     │
│                            [Clear] [Save Flashcard]│
│                                                     │
└─────────────────────────────────────────────────────┘
```

---

## 5. User Journey Flowchart

```
START: User in Glance View
│
├─→ Clicks "[+Flashcard AI]" button on a block
│   │
│   ├─→ Modal opens with block text in FRONT
│   │   │
│   │   ├─→ Clicks Preset (e.g., "Q&A")
│   │   │   │
│   │   │   ├─→ ⟳ AI processes
│   │   │   │
│   │   │   └─→ BACK field auto-fills ✓
│   │   │       │
│   │   │       ├─→ Reviews content
│   │   │       │
│   │   │       └─→ Clicks [Save Flashcard]
│   │   │           │
│   │   │           └─→ AddToFlashcardSheet opens
│   │   │               │
│   │   │               ├─→ User selects deck
│   │   │               │
│   │   │               └─→ Flashcard saved ✓
│   │   │
│   │   ├─→ OR: Types custom prompt
│   │   │   │
│   │   │   ├─→ ⟳ AI processes
│   │   │   │
│   │   │   └─→ BACK field auto-fills ✓
│   │   │
│   │   ├─→ OR: Clicks [Select Blocks]
│   │   │   │
│   │   │   ├─→ BlockSelector opens
│   │   │   │
│   │   │   ├─→ User selects 2-3 blocks
│   │   │   │
│   │   │   ├─→ Clicks [Combine Selected]
│   │   │   │
│   │   │   └─→ FRONT field filled with combined content
│   │   │       │
│   │   │       ├─→ User clicks preset or custom prompt
│   │   │       │
│   │   │       └─→ AI generates BACK field ✓
│   │   │
│   │   └─→ Clicks [Clear]
│   │       └─→ Fields reset, ready for new card
│   │
│   └─→ Clicks ✕ to close
│       └─→ Modal closes, back to Glance
│
└─→ END: Flashcard created and saved to deck

Average workflow time: 30 seconds to 2 minutes
```

---

## 6. Error States & Edge Cases

### Error 1: AI Response Format Invalid
```
┌──────────────────────────────┐
│ Create Flashcard          ✕ │
├──────────────────────────────┤
│ FRONT                        │
│ ┌────────────────────────────┐
│ │ What is photosynthesis?   │
│ └────────────────────────────┘
│                              │
│ ⚠️ AI response format unclear│
│    Please edit manually or   │
│    try another preset.       │
│                              │
│ BACK                         │
│ ┌────────────────────────────┐
│ │ (empty - please edit)      │
│ └────────────────────────────┘
│                              │
│ [Retry] [Clear] [Save]       │
└──────────────────────────────┘
```

### Error 2: Network Failure
```
┌──────────────────────────────┐
│ Create Flashcard          ✕ │
├──────────────────────────────┤
│                              │
│ ⚠️ Failed to reach AI         │
│    Check your connection     │
│    and try again.            │
│                              │
│ [Retry] [Close]              │
│                              │
└──────────────────────────────┘
```

### Error 3: Content Too Long
```
┌──────────────────────────────┐
│ Create Flashcard          ✕ │
├──────────────────────────────┤
│ FRONT                        │
│ ┌────────────────────────────┐
│ │ Content exceeds 500 words. │
│ │ Please shorten and retry.  │
│ │ 523 / 500  ❌              │
│ └────────────────────────────┘
│                              │
│ [Edit] [Clear]               │
└──────────────────────────────┘
```

---

## 7. Success States

### Success 1: Flashcard Ready to Save
```
┌──────────────────────────────┐
│ Create Flashcard          ✕ │
├──────────────────────────────┤
│                              │
│ ✓ FRONT [45/500]             │
│   What is photosynthesis?    │
│                              │
│ ✓ BACK [200/1000]            │
│   Photosynthesis is...       │
│                              │
│ Quality: ⭐⭐⭐⭐⭐ High       │
│ Ready to save!               │
│                              │
│ [Back] [Save Flashcard] →    │
└──────────────────────────────┘
```

### Success 2: Multiple Flashcards Created
```
┌──────────────────────────────┐
│ Create Flashcard          ✕ │
├──────────────────────────────┤
│                              │
│ ✓ Batch Mode ON              │
│                              │
│ Created: 3 Flashcards        │
│ ┌────────────────────────────┐
│ │ 1. What is photosynthesis? │
│ │ 2. Define chlorophyll      │
│ │ 3. Light-dependent rxn     │
│ └────────────────────────────┘
│                              │
│ [Create More] [Save & Done]  │
└──────────────────────────────┘
```

---

## 8. Tablet Landscape - Split View

```
┌──────────────────────────────────────────────────────────────┐
│ Glance                           │  Flashcard AI Modal       │
├──────────────────────────────────┼──────────────────────────┤
│                                  │                          │
│ Block 1 Definition               │ Create Flashcard      ✕ │
│ "Photosynthesis is..."           │                          │
│ [+Flashcard AI]                  │ FRONT:                   │
│ ──────────────────────────────    │ "What is photosyn..."   │
│                                  │ 45 / 500                │
│ Block 2 Examples                 │                          │
│ "Examples include plants..."     │ BACK:                    │
│ [+Flashcard AI]                  │ "Photosynthesis is the │
│ ──────────────────────────────    │ process..."             │
│                                  │ 200 / 1000              │
│ Block 3 Key Points               │                          │
│ "Key points: light energy..."    │ PRESETS:                 │
│ [+Flashcard AI]                  │ [Q&A] [Simple] [Key]    │
│ ──────────────────────────────    │ [Mnem] [Link]           │
│                                  │                          │
│ [End of Glance]                  │ PROMPT:                  │
│                                  │ [Input field]      [🔤]  │
│                                  │                          │
│                                  │ [Blocks] [Batch]         │
│                                  │ [Clear] [Save]           │
│                                  │                          │
└──────────────────────────────────┴──────────────────────────┘
```

---

## 9. Animation Sequences

### Modal Open Animation
```
Timeline: 300ms total

t=0ms:    Scale: 0.8, Opacity: 0
t=100ms:  Scale: 0.95, Opacity: 0.5
t=300ms:  Scale: 1.0, Opacity: 1.0 ✓

Easing: EaseOut cubic-bezier(0.34, 1.56, 0.64, 1)
```

### AI Response Loading
```
Timeline: Continuous until response received

┌────────────────────┐
│ ⟳ ↙ → ↗ ↑ ↖ ← ↙ → │  (spinner rotation)
│ Processing...      │
└────────────────────┘

Duration: Variable (1-5 seconds typical)
```

### Field Auto-Fill
```
Timeline: 500ms

t=0ms:    Opacity: 0, Scale: 0.95
t=250ms:  Opacity: 0.5, Scale: 0.98
t=500ms:  Opacity: 1.0, Scale: 1.0 ✓

With fade-in effect on text
```

---

## 10. Dark Mode Support

### Dark Mode Modal
```
LIGHT MODE:                  DARK MODE:
White background             Dark gray background
Black text                   Light gray text
Blue primary button          Bright blue button
Gray preset buttons          Dark preset buttons
Light dividers               Dark dividers

All colors adjust automatically based on theme
```

---

## 11. Accessibility Features

### Visual Indicators
```
✓ Clear button states (active, disabled, loading)
✓ High contrast text on buttons
✓ Focus rings on interactive elements
✓ Color + icon for status (not color alone)
```

### Keyboard Navigation
```
Tab Order:
1. FRONT input field
2. Preset buttons (arrow keys to navigate)
3. BACK input field
4. Custom prompt input
5. Block selector button
6. Batch mode toggle
7. Clear button
8. Save button
9. Close button

Shortcuts:
- ESC: Close modal
- Ctrl+Enter: Save flashcard (if valid)
```

---

## 12. Responsive Breakpoints

### Phone (< 600px)
- Vertical stacking all sections
- Full-width inputs
- Single column for presets
- Bottom sheet modal presentation

### Tablet (600px - 1000px)
- Side-by-side layout possible
- 2-column preset grid
- Larger tap targets
- Modal width: 80% of screen

### Desktop (> 1000px)
- Full 3-column layout (Glance | Modal | Presets)
- Resizable panels
- Modal width: 50% of screen, max 600px
- Floating window style

---

This visual guide should help the design and development teams understand the exact look, feel, and interactions needed for the Flashcard AI feature!

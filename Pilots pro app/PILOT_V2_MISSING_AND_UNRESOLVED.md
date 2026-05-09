# ⚠️ PILOT V2 - UNRESOLVED ISSUES & GAPS

This document lists the exact verbatim unresolved issues and gaps that are completely missing or partially implemented in the codebase. The builder agent must implement appropriate solutions for these items exactly as specified.

---

## 1. ACTIVE RECALL TAPE/MASKING SYSTEM ISSUE (ITEM 11)

Current issue:

* Right now only highlight feature exists.
* There is no proper active-recall masking/tape system for revision.
* Users cannot temporarily hide specific text portions for self-testing.
* Glance mode also lacks active recall reveal/hide interactions.

- Create a premium “Washi Tape” system for the notes editor inspired by Notability, Goodnotes, and Japanese stationery aesthetics.  STYLE GOAL: - soft matte academic feel - handmade paper texture - subtle grain - slightly translucent - elegant and minimal - premium iPad note-taking aesthetic - realistic paper tape, NOT glossy stickers  TAPE VARIANTS TO CREATE:  1. Classic Washi - soft matte paper texture - clean edges - minimal grain - default study tape   COLOR PALETTE: Use soft pastel matte colors only.  Yellow: - #FFE88A - #F7E27C  Green: - #BEECC4 - #C8F2D0  Blue: - #B7DCFF - #C8E6FF  Pink: - #FFD1DC - #FFC7D1  Gray: - #D9D9D9 - #E6E6E6DO NOT: - use glossy sticker style - use neon colors - use sharp vector-perfect edges - use flat CSS rectangles

Required behavior:

11.1 Tape masking tool:

* Add dedicated “Tape” tool in toolbar similar to premium note-taking apps.
* User should be able to place masking tape over:

  * text
  * lines
  * keywords
  * headings
  * diagrams
  * answers

11.2 Tape interaction behavior:

* when tape is applied → underlying content becomes hidden
* when user taps tape → content becomes revealed
* revealed state should:

  * become slightly transparent/translucent
  * softly blurred/faded
  * still remain readable
* tapping again should re-hide content

11.3 Tape visual style:

* tape borders should have soft translucent colored outline
* tape should look minimal and premium
* tape UI should feel smooth and interactive
* animations should feel fluid and native

11.4 Global reveal/hide controls:

* add “Show All Tapes” and “Hide All Tapes” controls
* accessible from toolbar/menu
* when “Show All” pressed:

  * all tapes reveal together
* when “Hide All” pressed:

  * all tapes hide together

11.5 Glance View tape integration:

* tape visibility/reveal system should also work inside Glance mode
* Glance mode should contain:

  * small cute tape toggle UI/button
* pressing it should:

  * reveal all tapes
  * hide all tapes

11.6 Tape persistence:

* tape positions must persist properly
* reopening note should preserve:

  * tape placement
  * reveal state
  * hidden state

11.7 Active recall workflow:

* feature should feel optimized for:

  * UPSC revision
  * self-testing
  * memorization
  * active recall learning workflows

11.8 Interaction quality:

* tape reveal/hide transitions should animate smoothly
* avoid abrupt flashing
* maintain immersive premium tablet experience

---

## 2. ADDITIONAL CODE GAPS (FROM AUDIT)

### 2.1 Flashcard Study Reminders
*   **Current issue**: Completely missing.

### 2.2 Custom App Icon Support
*   **Current issue**: Completely missing.

### 2.3 In-Memory Search Filtering
*   **Current issue**: Subsequent searches re-query Supabase instead of locally filtering in-memory on cached frontend nodes.

### 2.4 Flashcard Cascade Deletion
*   **Current issue**: Deletion has no remote Supabase deletion query trigger inside `FlashcardService.ts`, resulting in ghost rows reappearing.

### 2.5 View Source Action
*   **Current issue**: Completely missing inside `src/components/unified/SharedQuestionCard.tsx`.

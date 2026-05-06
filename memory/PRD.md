# UPSC Study App — PRD (Branch: 5.9)

## Repository
- **Repo**: https://github.com/upsc-serv-1/4.0
- **Working Branch**: 5.9
- **App Type**: React Native (Expo) — mobile app

## Architecture
- React Native + Expo Router
- TypeScript
- Supabase (PostgreSQL backend)
- Gemini AI (via GeminiService.ts for search expansion, explanations)
- Key screens: `app/ai-search.tsx`, `app/unified/engine.tsx`, `app/unified/arena.tsx`, `app/notes/index.tsx`, `src/services/GeminiService.ts`, `src/services/BestAnswerService.ts`

---

## Session 1 (Feb 2026) — Bug Fixes

| # | Fix | File | Commit |
|---|-----|------|--------|
| 1 | MyVitamin auto-selects on reload | `engine.tsx` | dc49de3 |
| 2 | "↻ Update MyVitamin" button when AI regenerates | `engine.tsx` | 3995120 |
| 3 | Recent search dropdown no longer covers search bar | `ai-search.tsx` | 8e16115 |
| 4 | AI keyword prompt — years/exam names → filters not keywords | `GeminiService.ts` | 89c2b17 |
| 5 | Subject chip stays selected after re-search | `ai-search.tsx` | 409bd3d |
| 6 | Keyword highlighting amber+bold in results | `ai-search.tsx` | ca0c3ba |
| 7 | Color-coded PYQ chips (UPSC=blue, Allied=green, Others=orange) | `ai-search.tsx` | ca0c3ba |
| 8 | Notebook markdown→HTML conversion (bold/tables/bullets) | `engine.tsx` | 552df32 |
| 9 | Smart keyword suggestions from history + UPSC trend topics | `ai-search.tsx` | 37e6e6f |
| 10 | Institute chips in search dropdown + institute breakdown in left panel | `ai-search.tsx` | 5150bec+61d9cd9 |

## Session 2 (Feb 2026) — Architecture Overhaul

| # | Feature | File | Commit |
|---|---------|------|--------|
| 1 | Skip arena index for search results, 65% search panel in quiz | `engine.tsx` | 0f7f3a4 |
| 2 | Unified 3-mode engine (AI/Fuzzy/Exact), hierarchical Subject→Section→Topic | `ai-search.tsx` | 1bdd3f1 |
| 3 | Home + Arena redirect to AI Search tab (single universal search) | `arena.tsx`, `index.tsx` | 02b064b |
| 4 | PYQ forecast widget (buildPredictive hot-score topics) | `ai-search.tsx` | 6d4b43b |
| 5 | Notes: tree hierarchy + back-to-parent stack + hide panel toggle | `notes/index.tsx`, `NoteRow.tsx` | 235245d |
| 6 | Best answer in-memory cache (avoids repeated DB calls) | `BestAnswerService.ts` | 4eaea85 |

---

## Backlog

### P1 — High Priority
- Back button warning in quiz engine when opened from search (save/cancel)
- Validate arena "learn" still opens arena index (not search result behavior)
- Notes: tree hierarchy visual validation on device  
- Weak area analytics integration in search suggestions

### P2 — Medium Priority
- "Top 500 smart revision keywords" AI-generated list
- Search filter state persisted to AsyncStorage
- Full offline mode: OTW cards, tags, PYQ without network

### P3 — Low Priority
- Centralized institute color theme config
- Notes: add subfolder creation flow within hierarchy
- Table rendering in notebook (more styled)

# UPSC Study App — Bug Fixes & Feature PRD (Branch: 5.9)

## Repository
- **Repo**: https://github.com/upsc-serv-1/4.0
- **Working Branch**: 5.9
- **App Type**: React Native (Expo) — mobile app

## Architecture
- React Native + Expo Router
- TypeScript
- Supabase (PostgreSQL backend)
- Gemini AI (via GeminiService.ts for search expansion, explanations)
- Key screens: `app/ai-search.tsx`, `app/unified/engine.tsx`, `src/services/GeminiService.ts`

---

## Session: Feb 2026 — Bug Fixes & Enhancements (10 commits pushed)

### Implemented ✅

| # | Fix | File | Commit |
|---|-----|------|--------|
| 1 | MyVitamin auto-selects on reload — if saved answer exists, default to vitamin tab | `engine.tsx` | dc49de3 |
| 2 | "Update MyVitamin" button when AI regenerates — shows amber "↻ Update MyVitamin" when savedBest already exists | `engine.tsx` | 3995120 |
| 3 | Recent search dropdown no longer covers search bar — wrapped in relative container | `ai-search.tsx` | 8e16115 |
| 4 | AI keyword prompt fix — years/exam names/subjects go in `filters`, NOT in `keywords` array | `GeminiService.ts` | 89c2b17 |
| 5 | Subject chip stays selected after chip tap — only reset sidebarSubjectFilter on new text query | `ai-search.tsx` | 409bd3d |
| 6 | Keyword highlighting in results — matched words highlighted amber+bold in question text | `ai-search.tsx` | ca0c3ba |
| 7 | Color-coded PYQ chips — UPSC=blue, Allied=green, Others=orange, generic=amber | `ai-search.tsx` | ca0c3ba |
| 8 | Notebook markdown rendering — `markdownToHtml()` converts AI markdown to HTML before loading in editor (fixes **bold** stars, tables, paragraphs) | `engine.tsx` | 552df32 |
| 9 | Smart keyword suggestions — recent search history + rotating UPSC trend topics (30+ across all subjects) | `ai-search.tsx` | 37e6e6f |
| 10 | Data Manager in search — institute chips in dropdown (quick filter), institute breakdown in left stats panel | `ai-search.tsx` | 5150bec + 61d9cd9 |

---

## Backlog / Future Enhancements

### P1 — High Priority
- Full weak area analytics integration in search suggestions (requires ReviewSection data passed to ai-search)
- Forecast module topics surfaced as search suggestions (requires pyqPredictive.ts data)
- Search navigation state fully preserved across deep links (validate with Expo Router back gesture)

### P2 — Medium Priority  
- Centralized institute color theme config (beyond PYQ chips — for all tabs)
- "Top 500 smart revision keywords" AI-generated list
- Search filter state persisted to AsyncStorage (filters survive app restart)

### P3 — Low Priority
- Better table rendering in notebook (styled with colors, not just borders)
- Notebook editor: undo/redo support for markdown import

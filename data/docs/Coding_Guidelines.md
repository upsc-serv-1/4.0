# Coding Guidelines - Thesis Data Collector

This document outlines the coding standards, patterns, and principles for the **Thesis Data Collector** web application.

---

## Technical Stack & Principles

1. **Vite + React + TypeScript**: Fully-typed component props, state hooks, and API responses.
2. **Vanilla CSS Modules**:
   - Use CSS Modules (`*.module.css`) or a single compiled styled file `index.css` with structured variables.
   - Use CSS variables for colors, spacing, typography, and theme (dark/light toggles).
   - Do **NOT** use Tailwind CSS.
3. **Supabase Integration**:
   - Initialize Supabase via `@supabase/supabase-js`.
   - Implement single-row operations for saving, updating, and reading clinical cases.
4. **Data Exporting**:
   - Keep export functions utility-based in `src/utils/exporters.ts`.
   - Minimize package footprint using pure browser capabilities (e.g. `@media print` for PDF) and small libraries (`xlsx` for Excel).

---

## Project Structure

```
data/
├── docs/
│   ├── Project_Requirements.md
│   ├── Coding_Guidelines.md
│   └── issues/                 # Tracking feature cards
├── src/
│   ├── components/             # Reusable UI components
│   │   ├── IntakeVault.tsx     # Smart paste area
│   │   ├── CaseForm.tsx        # Multi-section proforma form
│   │   ├── PromptGenerator.tsx # Copier for master prompt
│   │   └── DataExporter.tsx    # Excel/Word/PDF downloads
│   ├── utils/
│   │   ├── parser.ts           # Safe JSON extraction from text
│   │   └── exporters.ts        # Client-side file generators
│   ├── supabaseClient.ts       # Database client
│   ├── App.tsx                 # Main layout
│   ├── App.module.css          # Core layouts
│   ├── index.css               # Styling variables & resets
│   └── main.tsx                # App entrypoint
├── package.json
├── tsconfig.json
├── vite.config.ts
└── index.html
```

---

## Coding Standards

### TypeScript Strictness
- Define explicit interfaces for all form sections.
- Avoid using `any`. Use `unknown` or specify typing if the structure is dynamic.
- Type definitions for clinical cases must align exactly with the database schema column names.

### React Component Pattern
- Use functional components with Hooks (`useState`, `useEffect`, `useMemo`, `useCallback`).
- Group related form sections (e.g., Demographics, Maternal Outcomes) into modular sub-components or collapsible fieldsets.
- Handle state locally in the main page container and pass handlers down to form inputs to coordinate state sync.

### Safe Parsing of AI JSON (Intake Vault)
- Strip markdown markers (like ` ```json ` and ` ``` `).
- Use regular expressions to extract content enclosed between the first `{` and last `}` to handle conversational text wrappers.
- Use `JSON.parse` wrapped in `try/catch`. If parsing fails, output a clean error warning without crashing the UI.
- Map incoming JSON fields to the form state case-insensitively, and drop unmapped/invalid fields.

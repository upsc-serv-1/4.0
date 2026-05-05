# PYQ Analysis Upgrade Patch — v5.2

Drop-in upgrade for the PYQ Analysis section of the `upsc-serv-1/4.0` repo (branch `5.1`).

All file paths in this patch mirror the **exact directory layout of your repo**, and all
Supabase column references use the exact names from `supabase table schema.txt`:
- `questions.subject`, `questions.section_group`, `questions.micro_topic`
- `questions.exam_year`, `questions.is_pyq`, `questions.exam_stage`, `questions.exam_paper`
- `tests.launch_year`, `tests.exam_year`, `tests.section_group`, `tests.paper_type`

---

## What this patch ships

| # | Upgrade | New file(s) |
|---|---------|-------------|
| 1 | Intentional Download Manager (sticky drawer, minimize, history, open file) | `src/context/DownloadManagerContext.tsx`, `src/components/pyq/DownloadManager.tsx` |
| 2 | Accordion selection flow with search + Select-All + auto-expand | `src/components/pyq/SelectionDrawer.tsx` |
| 3 | Sticky multi-select summary bar | `src/components/pyq/SelectionSummaryBar.tsx` |
| 4 | Standardized toggle chip (filled/outlined, premium) | `src/components/common/ToggleChip.tsx` |
| 5 | Loading + double-click guard hook | `src/lib/useExportGuard.ts` |
| 6 | Always-visible active filters bar | `src/components/pyq/ActiveFiltersBar.tsx` |
| 7 | Undo toast | `src/components/common/UndoToast.tsx` |
| 8 | Touch-target tokens (44pt min) | already enforced inside `ToggleChip` + `SelectionDrawer` |
| 9 | Premium micro-animations (Reanimated `Layout`, `FadeIn`) | inside `SelectionDrawer` |
| 10 | **Predictive engine** — 2026 forecast, frequency-weighted importance, rising/falling topics | `src/lib/pyqPredictive.ts`, `src/components/pyq/PredictiveInsightsPanel.tsx` |
| 11 (bonus) | **Pin Cell** watchlist | inside `DownloadManagerContext` (reused KV) + `PredictiveInsightsPanel` |
| 12 (bonus) | **Saved Views** presets | `src/lib/pyqSavedViews.ts` |
| 13 (bonus) | **Compare Windows** (2014–2018 vs 2020–2024) | `src/components/pyq/CompareWindowsPanel.tsx` |

---

## Step-by-step apply

### 1. Copy files
Copy every file under `patches/` into your repo at the **same relative path**. No file
overwrites your existing code except via the explicit edits in `app/pyq.patch.md`.

```bash
# From your repo root
cp -r path/to/patches/src/*  src/
cp -r path/to/patches/app/*  app/
```

### 2. Install one new dep (already commonly present)

```bash
yarn add react-native-reanimated   # if not already in package.json
```

If `react-native-reanimated` is already there (it usually is on Expo SDK 54), skip.

### 3. Edit `app/pyq.tsx`
Apply the search/replace blocks in **`patches/app/pyq.patch.md`**. They are minimal —
only ~8 small insertions.

### 4. Wrap your root with the download provider
In `app/_layout.tsx`, wrap children with `<DownloadManagerProvider>` (one-line import +
one-line wrap). Snippet at the bottom of `pyq.patch.md`.

---

## Predictive layer — the math (no LLM, deterministic)

For each (subject | section | micro) bucket, given counts `c[y]` for years `y`:

1. **Frequency-Weighted Importance (FWI)**
   `FWI = Σ c[y] * w(y)` where `w(y) = 0.5 ^ ((latest - y) / halfLife)`, halfLife = 4 years.
   Recent years count more.

2. **Rising / Falling**
   Linear regression slope `m` of `c[y]` vs `y` over last 6 years.
   - `m > 0.4` → 🔥 Rising
   - `m < -0.3` → 📉 Falling
   - else → ➡️ Stable

3. **2026 Forecast (point estimate + 80% band)**
   Fit on last 8 years, project `y = 2026`, clip to `[0, max(c)+1]`.
   Confidence band = ±1.28 × residual stdev.

4. **Hot Score (0–100)**
   `hot = 0.55 * normalize(FWI) + 0.30 * normalize(slope) + 0.15 * normalize(forecast)`

5. **Streak**
   Consecutive years with `c[y] >= 1`. Used to surface "perennial" topics.

All of this runs locally on already-fetched `rawQuestions`. No extra Supabase calls.

---

## Storage keys (KVStore — already used in your codebase)
- `pyq_dl_history`           → array of `{ id, label, status, uri, ts }`
- `pyq_pinned_cells`         → array of `{ subject, section?, micro?, year? }`
- `pyq_saved_views`          → array of `{ id, name, stage, paper, range, subjects[] }`

These live in the **same** `KVStore` namespace your `pyq_cache_*` keys already use, so no
new storage abstraction.

# JSON Tool — Build Progress

> **Live tool URL (preview):** `https://pro-json-dev.preview.emergentagent.com/`
> **Branch:** `pilot-pro-v2.3`
> **Last updated:** 2026-02-10 (Step 1 — MVP foundation complete)

This file is the **handoff log**. Any new agent picking up the work should read this first
along with `APPROACH.md` (the master design doc) and `README.md`.

---

## Where the code lives

The Emergent platform requires a fixed runtime layout:
- Backend → `/app/backend` (FastAPI, uvicorn `server:app` on port 8001)
- Frontend → `/app/frontend` (Expo, Metro bundler on port 3000)

All source code is mirrored into this repo at:
- `json tool/backend/` ← FastAPI service (PyMuPDF + python-docx + pytesseract)
- `json tool/frontend/` ← Expo (React Native Web) app

A new agent should **edit files in `/app/backend` and `/app/frontend` directly** during
development (so supervisor hot-reloads them), then `rsync` the changes back into
`json tool/` before committing. See "Sync & push procedure" below.

---

## Tech-stack deviations from APPROACH.md

| Area | APPROACH.md says | Actually using | Why |
|------|------------------|----------------|-----|
| Frontend | React + Tailwind + shadcn/ui (web-only) | **Expo Web (React Native + RN-Web)** | The Emergent runtime serves port 3000 via Expo's Metro bundler and that supervisor entry is read-only. Expo Web renders RN components as a web app and supports everything the tool needs (file upload, large textareas, side-by-side panes, file download). |
| DB | Supabase (Postgres) | **MongoDB** (local, already provisioned) | Only the `EXPO_PUBLIC_SUPABASE_ANON_KEY` is available; service-role key is missing. MongoDB is already running and zero-friction for the MVP. Schema mirror: `jt_jobs`, `jt_questions`, `jt_batches`, `jt_revisions`. |
| Storage | Supabase Storage bucket | **Local FS** at `/app/backend/data/uploads/{job_id}/` | Same reason. Phase-2 upgrade if multi-host is needed. |
| OCR | Tesseract for scanned PDFs | **Detected but not yet performed** (`is_scanned` heuristic exposed, OCR call deferred to Phase-2) | All available sample PDFs are text-based; OCR adds ~150 MB of image deps and slows reload. |

These deviations do **not** change the user-facing flow, the JSON output schema,
or the marker-format contract with Gemini.

---

## Step 1 — MVP foundation ✅ (complete)

### Backend (`/app/backend`)

```
backend/
├── server.py                  # all /api/* routes
├── data/
│   ├── taxonomy.json          # 240 entries, parsed from "new New syllabus hierarchy json with csat.txt"
│   └── uploads/{job_id}/      # qp.pdf, sol.pdf
└── services/
    ├── pdf_extract.py         # PyMuPDF text extract + repeated-line / noise stripping + page→PNG
    ├── q_splitter.py          # `Q\.?\s*\d+[\.\)]` regex splitter + QP↔SOL bundler
    ├── prompt_builder.py      # SYSTEM_RULES + taxonomy + format example + raw blocks → batch prompt
    ├── output_parser.py       # `=== QUESTION N ===` block parser → typed dict
    ├── exporter.py            # build_schema2_json (matches sample) + build_markdown
    └── docx_export.py         # python-docx wrapper for .docx prompt downloads
```

### API surface (all under `/api`)

| Method | Path | Purpose |
|---|---|---|
| GET | `/` | Health |
| GET | `/taxonomy` | 240-entry taxonomy |
| GET | `/jobs` | List jobs |
| POST | `/jobs` | Create job (multipart: `title`, `metadata_json`, `qp_pdf`, optional `sol_pdf`) |
| GET | `/jobs/{id}` | Job + questions + batches |
| DELETE | `/jobs/{id}` | Delete job |
| GET | `/jobs/{id}/preview` | Extract & sanity report |
| POST | `/jobs/{id}/prompts` | Generate Gemini prompts (body: `batch_size`, `subject_filter`, `extra_instructions`) |
| GET | `/jobs/{id}/prompts/{batch_index}` | Get prompt text |
| GET | `/jobs/{id}/prompts/{batch_index}/docx` | Download .docx |
| POST | `/jobs/{id}/parse-output` | Body: `{output_text, batch_index?}` — saves questions |
| GET | `/jobs/{id}/questions?confidence_lt=N` | Filter low-confidence Qs |
| PATCH | `/jobs/{id}/questions/{n}` | Edit one question (writes revision first) |
| GET | `/jobs/{id}/page-image/{n}?source=qp\|sol` | Render PDF page as PNG |
| GET | `/jobs/{id}/export?format=json\|md` | Final download in schema 2.0 |
| POST | `/jobs/{id}/reverify-prompt?threshold=80` | Build a re-verify prompt for low-confidence Qs |

### Frontend (`/app/frontend`)

```
frontend/app/
├── _layout.tsx                # expo-router stack with header theme
├── index.tsx                  # home: job list + "New Job"
├── new.tsx                    # upload + metadata form
└── jobs/[id].tsx              # detail screen with 4 tabs:
                               #   1·Preview  → extract + sanity + generate prompts
                               #   2·Prompts  → batch list, copy/.docx, paste-back parser
                               #   3·Review   → Q-list sidebar + edit form (taxonomy validity badge)
                               #   4·Export   → JSON / Markdown download buttons
src/
├── api.ts                     # all REST helpers (uses EXPO_PUBLIC_BACKEND_URL)
└── theme.ts                   # dark palette + shared StyleSheet
```

### Verified end-to-end (smoke test against the sample Forum IAS PDFs)

1. Upload QP+SOL → 100/100 questions detected, 0 missing on either side ✅
2. Generate prompts → 3 batches at batch_size=35 (35+35+30) ✅
3. Mock Gemini paste-back parsed 2 questions, saved with taxonomy validation ✅
4. JSON export matches schema 2.0 exactly (id format `{testId}-q{NN}`, `exam_info` block populated) ✅

---

## Step 2 — TODO (next agent picks up here)

Highest impact first:

1. **Side-by-side PDF preview in Review tab** — backend already exposes
   `/api/jobs/{id}/page-image/{n}?source=qp` returning PNG. Add an `<Image>`
   pane on the left that follows the selected question. Heuristic: map question
   number → page number by scanning extracted text for `Q\.?\s*N` first occurrence.

2. **Subject scope multi-select** in the New Job form (currently passes empty array).
   Read `/api/taxonomy`, group by subject, render as a checkbox row.

3. **Low-confidence sidebar + Re-verify** — add a `/jobs/{id}` tab that shows
   Qs below threshold (default 80) with a button that calls `/reverify-prompt`
   and reuses the paste-back textarea.

4. **OCR for scanned PDFs** — add a `services/ocr.py` that, when
   `is_scanned(pages)` is true, runs `pytesseract` per page and replaces
   `page.text`. Tesseract is already pip-installed; verify `tesseract-ocr`
   binary is on `$PATH` (it is in the dev container).

5. **Edit history viewer** — list `jt_revisions` for a question with diffs
   and a "Restore" button (endpoint not yet built; pattern: POST
   `/jobs/{id}/restore/{rev_id}`).

6. **Bulk re-tag** (Phase-3 feature) — a sidebar action: select multiple Qs,
   change subject/sectionGroup/microtopic in one batch.

7. **Auth** — currently MVP is no-auth. When user adds login, hook into the
   existing Supabase auth that the main Pilot Pro Expo app uses.

---

## Sync & push procedure (for any agent)

```bash
# 1. Make changes inside /app/backend and /app/frontend (fast hot-reload).
# 2. After verifying, mirror into the repo working tree:
cd /tmp/pilot-pro
rsync -a --delete \
  --exclude '.metro-cache' --exclude 'node_modules' --exclude '__pycache__' \
  --exclude 'data/uploads' --exclude '*.pyc' \
  /app/backend/ "json tool/backend/"
rsync -a --delete \
  --exclude '.metro-cache' --exclude 'node_modules' --exclude '.expo' \
  /app/frontend/ "json tool/frontend/"

# 3. Update this PROGRESS.md.
# 4. Commit + push:
git -C /tmp/pilot-pro add "json tool/"
git -C /tmp/pilot-pro -c user.name="emergent bot" -c user.email="bot@emergent.dev" \
  commit -m "json-tool: <what changed>"
git -C /tmp/pilot-pro push origin pilot-pro-v2.3
```

PAT and remote are already wired to `/tmp/pilot-pro` (cloned with the user's
PAT embedded). For local development on the Emergent pod, `git remote -v`
will show the authenticated URL — never echo it back to the user.

---

## Known limitations (MVP)

- No auth, no RLS — anyone with the URL can create/delete jobs.
- Job storage is local FS; restart of the pod re-mounts but nothing persists across pod recycles.
- The Q-splitter regex `^(?:Q(?:uestion)?\.?\s*)(\d{1,3})` requires the **`Q` prefix**.
  If a coaching PDF uses bare numbering (`1.`, `2.`, …) the splitter will return zero
  questions. Workaround for now: ask Gemini in step 4 to renumber, or pre-process the PDF.
  We chose strictness because forum-style PDFs (the user's main format) have spurious
  bare numbers everywhere (article references, list items) and false positives ruin the bundle.
- OCR is detected (`is_scanned` flag returned in `/preview`) but not yet executed — the user is warned in the UI.

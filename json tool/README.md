# JSON Tool

PDF → Quiz JSON Extractor for the Pilot Pro quiz engine.

This folder will host a self-contained web tool that:
1. Accepts coaching test PDFs (Question Paper + Solutions, separate or combined)
2. Extracts and cleans text (handles scanned PDFs via OCR)
3. Generates structured prompts for Gemini 3 Pro (user pastes into Gemini web)
4. Parses Gemini's marker-based output back
5. Provides side-by-side review (PDF page vs editable JSON)
6. Exports final JSON in schema 2.0 (compatible with the existing Pilot Pro app)

**No third-party AI API costs.** Uses user's Gemini Pro web subscription via copy-paste.

## Status
- 📋 **Approach:** see [`APPROACH.md`](./APPROACH.md)
- 🛠️ **Implementation:** pending user approval

## Tech Stack
- Backend: FastAPI + PyMuPDF + Tesseract
- Frontend: React + Tailwind + shadcn/ui
- DB: MongoDB

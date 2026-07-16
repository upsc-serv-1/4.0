import fitz
import os

pdf_dir = r"C:\Users\Dr. Yogesh\Downloads\Telegram Desktop"

pdf_files = [
    "Keywords & phrases Society.pdf",
    "X IAS HISTORY KEYWORDS GS1.pdf",
    "HISTORY ART & CULTURE KEYWORDS BY X IAS.pdf",
    "SOCIETY KEYWORDS BY X IASrsrs.pdf",
    "X IAS GS2 POLITY KEYWORDS.pdf",
    "POLITY KEYWORDS AND EXAMPLES FOR GS2 BY XIAS.pdf",
    "X IAS GS3 KEYWORDS AND PHRASES.pdf",
    "Internal Security keywords  & Examples By  XIAS.pdf",
    "GS2 GS3 CASE STUDIES topic wise.pdf",
    "Society.pdf",
    "THEME WISE IMP SC JUDGEMENTS PDF BY X IAS.pdf",
    "ESSAY PARAGRAPH SENTENCE CONNECTING WORDS.pdf"
]

for filename in pdf_files:
    filepath = os.path.join(pdf_dir, filename)
    if not os.path.exists(filepath):
        print(f"File not found: {filename}")
        continue
    
    try:
        doc = fitz.open(filepath)
        print(f"\n==================================================")
        print(f"File: {filename} (Pages: {len(doc)})")
        print(f"==================================================")
        
        # Print first page text (up to 800 chars)
        text = ""
        for i in range(min(5, len(doc))):
            text += f"--- Page {i+1} ---\n"
            text += doc[i].get_text()[:800] + "\n"
        print(text[:2000])
        doc.close()
    except Exception as e:
        print(f"Error reading {filename}: {e}")

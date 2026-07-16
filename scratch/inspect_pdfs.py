import fitz

files = {
    "philosophies": r"C:\Users\Dr. Yogesh\Downloads\Telegram Desktop\GS4- Indian Philosophies and Religious Ethics.pdf",
    "phrases": r"C:\Users\Dr. Yogesh\Downloads\Telegram Desktop\Final Ethics Phrases Updated.pdf",
    "keywords": r"C:\Users\Dr. Yogesh\Downloads\Telegram Desktop\ETHICS 2025 KEYWORDSrs.pdf",
    "dilemmas": r"C:\Users\Dr. Yogesh\Downloads\Telegram Desktop\ETHICAL DILEMMAS.pdf"
}

with open("scratch/extracted_raw_text.txt", "w", encoding="utf-8") as out:
    for name, path in files.items():
        out.write("=" * 60 + "\n")
        out.write(f"FILE: {name} ({path})\n")
        out.write("=" * 60 + "\n")
        try:
            doc = fitz.open(path)
            out.write(f"Total Pages: {len(doc)}\n\n")
            # Write text of all pages
            for i in range(len(doc)):
                out.write(f"--- Page {i + 1} ---\n")
                text = doc[i].get_text()
                out.write(text)
                out.write("\n\n")
        except Exception as e:
            out.write(f"Error reading {name}: {e}\n")
        out.write("\n\n")

print("Done! Extracted text written to scratch/extracted_raw_text.txt")

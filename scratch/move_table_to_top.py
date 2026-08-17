import json
import re
import os
import requests
import time

SUPABASE_URL = "https://rnelxupyiejsqekmcrcz.supabase.co"
SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJuZWx4dXB5aWVqc3Fla21jcmN6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQwMTgzODcsImV4cCI6MjA5OTU5NDM4N30.Cc4z8mFO4YoPbuHC40bnvEy6SQOyEbFobvMRqUqnmIQ"
HEADERS = {
    "apikey": SUPABASE_KEY,
    "Authorization": f"Bearer {SUPABASE_KEY}",
    "Content-Type": "application/json",
    "Prefer": "resolution=merge-duplicates"
}

FILES = [
    {
        "path": r"C:\Users\Dr. Yogesh\Videos\APP FOLDER - V1 - Copy\app\frontend-noji-2.6.2\3\pilot pro 10.2\mains json files\mains_anthro1_new_consolidated.json",
        "label": "Paper 1"
    },
    {
        "path": r"C:\Users\Dr. Yogesh\Videos\APP FOLDER - V1 - Copy\app\frontend-noji-2.6.2\3\pilot pro 10.2\mains json files\mains_anthro2_new_consolidated.json",
        "label": "Paper 2"
    }
]

MD_FILES = [
    r"C:\Users\Dr. Yogesh\Downloads\Telegram Desktop\Anthropology_PAPER_1_PYQs_20_25_Extracted.md",
    r"C:\Users\Dr. Yogesh\Downloads\Telegram Desktop\Anthropology_PAPER_2_PYQs_20_25_Extracted.md"
]

def format_cell_lines(text_block):
    lines = text_block.strip().split('\n')
    formatted = []
    for line in lines:
        l = line.strip()
        if not l:
            continue
        l = re.sub(r'^(?:[-*•✔✓💡❌]|\s)+', '', l)
        l = l.replace('|', '\\|')
        formatted.append(f"• {l}")
    return ' <br> '.join(formatted)

def ensure_table_at_top_with_icons(text):
    if not text:
        return text

    # Extract 3-column table if present anywhere in text
    table_pattern = re.compile(
        r'\|\s*(?:\*\*|__)?(?:✔|✓)?\s*Aspects?\s+to\s+Take\s+in?to\s+Account(?:\*\*|__)?\s*\|\s*(?:\*\*|__)?(?:💡)?\s*Structure\s+to\s+Follow(?:\*\*|__)?\s*\|\s*(?:\*\*|__)?(?:❌)?\s*Don\'?ts?(?:\*\*|__)?\s*\|\s*\n'
        r'\|\s*---+\s*\|\s*---+\s*\|\s*---+\s*\|\s*\n'
        r'\|\s*(.*?)\s*\|\s*(.*?)\s*\|\s*(.*?)\s*\|\s*(?:\n|\Z)',
        re.DOTALL | re.IGNORECASE
    )

    m = table_pattern.search(text)
    if m:
        aspects_cell = m.group(1).replace('<br>', ' <br> ').strip()
        structure_cell = m.group(2).replace('<br>', ' <br> ').strip()
        donts_cell = m.group(3).replace('<br>', ' <br> ').strip()

        # Build clean table at top with exact icons
        clean_table = (
            f"| **✔ Aspects to Take into Account** | **💡 Structure to Follow** | **❌ Don'ts** |\n"
            f"| --- | --- | --- |\n"
            f"| {aspects_cell} | {structure_cell} | {donts_cell} |\n\n"
        )

        # Remove the extracted table from original location
        rest = (text[:m.start()] + text[m.end():]).strip()
        if rest and not rest.startswith("### **ANSWER**") and not rest.startswith("**ANSWER**") and not rest.startswith("#"):
            rest = "### **ANSWER**\n\n" + rest

        return clean_table + rest

    # Also handle single-column Approach box if present
    if text.startswith('| **Approach:'):
        aspects_m = re.search(r'•\s*\*\*Aspects?\s+to\s+Take\s+in?to\s+Account:\*\*\s*<br>\s*(.*?)(?=<br>\s*<br>\s*•|\Z)', text, re.DOTALL | re.I)
        structure_m = re.search(r'•\s*\*\*Structure\s+to\s+Follow:\*\*\s*<br>\s*(.*?)(?=<br>\s*<br>\s*•|\Z)', text, re.DOTALL | re.I)
        donts_m = re.search(r'•\s*\*\*Don\'?ts?:\*\*\s*<br>\s*(.*?)(?=\s*\||\Z)', text, re.DOTALL | re.I)

        aspects_str = aspects_m.group(1).strip() if aspects_m else "-"
        structure_str = structure_m.group(1).strip() if structure_m else "-"
        donts_str = donts_m.group(1).strip() if donts_m else "-"

        clean_table = (
            f"| **✔ Aspects to Take into Account** | **💡 Structure to Follow** | **❌ Don'ts** |\n"
            f"| --- | --- | --- |\n"
            f"| {aspects_str} | {structure_str} | {donts_str} |\n\n"
        )
        end_box = text.find('| --- |')
        rest_idx = text.find('\n', end_box) if end_box != -1 else -1
        rest = text[rest_idx:].strip() if rest_idx != -1 else ""

        if rest and not rest.startswith("### **ANSWER**") and not rest.startswith("**ANSWER**") and not rest.startswith("#"):
            rest = "### **ANSWER**\n\n" + rest

        return clean_table + rest

    return text

def upload_batch(rows):
    url = f"{SUPABASE_URL}/rest/v1/mains_answers"
    batch_size = 20
    success_count = 0

    seen = set()
    clean = []
    for r in rows:
        if r["id"] not in seen:
            seen.add(r["id"])
            clean.append(r)

    total_batches = (len(clean) + batch_size - 1) // batch_size
    for i in range(0, len(clean), batch_size):
        batch = clean[i:i+batch_size]
        all_keys = set(k for r in batch for k in r)
        padded = [{k: r.get(k) for k in all_keys} for r in batch]
        for attempt in range(5):
            try:
                resp = requests.post(url, json=padded, headers=HEADERS, timeout=60)
                if resp.status_code in [200, 201]:
                    success_count += len(batch)
                    print(f"  Batch {i//batch_size + 1}/{total_batches} -> mains_answers: OK ({len(batch)} rows)")
                    break
                else:
                    print(f"  [WARN] batch {i//batch_size+1}: {resp.status_code} {resp.text[:200]}")
                    time.sleep(4)
            except Exception as e:
                print(f"  [RETRY] {e}")
                time.sleep(4)

    print(f"  [SUCCESS] Uploaded {success_count}/{len(clean)} total answers to mains_answers")
    return success_count

def main():
    all_answers_to_upload = []

    for f_info in FILES:
        label = f_info["label"]
        filepath = f_info["path"]
        print(f"\n{'='*60}")
        print(f"  Moving table to ABSOLUTE TOP for {label}")
        print(f"{'='*60}")

        with open(filepath, "r", encoding="utf-8") as f:
            data = json.load(f)

        questions = data.get("questions", [])
        moved_count = 0
        total_count = 0

        for q in questions:
            q_id = q["id"]
            for a in q.get("answers", []):
                total_count += 1
                txt = a.get("answerText", "")

                new_txt = ensure_table_at_top_with_icons(txt)
                if new_txt != txt:
                    a["answerText"] = new_txt
                    moved_count += 1

                ans_id = a.get("id") or f"{q_id}-levelup_ias"
                a["id"] = ans_id

                all_answers_to_upload.append({
                    "id": ans_id,
                    "question_id": q_id,
                    "institute": a.get("institute", "Levelup IAS"),
                    "answer_text": new_txt
                })

        print(f"  {label}: Ensured table at top for {moved_count}/{total_count} answers.")

        with open(filepath, "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
        print(f"  {label} JSON saved.")

    # Also update MD files
    for md_path in MD_FILES:
        with open(md_path, "r", encoding="utf-8") as f:
            raw_md = f.read()

        sections = re.split(r'\n(?=## Question |\n## \d+\.|\Z)', raw_md)
        new_secs = []
        for sec in sections:
            if "## Model Answer" in sec:
                parts = re.split(r'##\s*Model Answer\s*\n', sec, flags=re.I)
                if len(parts) > 1:
                    ans_body = parts[1]
                    ans_fixed = ensure_table_at_top_with_icons(ans_body)
                    new_sec = parts[0] + "## Model Answer\n\n" + ans_fixed
                    new_secs.append(new_sec)
                else:
                    new_secs.append(sec)
            else:
                new_secs.append(sec)

        with open(md_path, "w", encoding="utf-8") as f:
            f.write("".join(new_secs))
        print(f"  Updated {os.path.basename(md_path)}")

    print(f"\n{'='*60}")
    print(f"  Uploading ALL {len(all_answers_to_upload)} answers to Supabase...")
    upload_batch(all_answers_to_upload)
    print("\nDone!")

if __name__ == "__main__":
    main()

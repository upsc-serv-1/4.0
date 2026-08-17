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

TARGET_INSTITUTE = "Levelup IAS"

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

def clean_and_assemble_answer(text):
    if not text:
        return text

    # Find table separator line '| --- | --- | --- |'
    sep_idx = text.find('| --- | --- | --- |')
    if sep_idx != -1:
        # Find start of line 3 (data cell line after separator)
        line3_start = text.find('\n', sep_idx) + 1
        # Find end of line 3
        line3_end = text.find('\n', line3_start)
        if line3_end == -1:
            line3_end = len(text)

        table_block = text[:line3_end].strip()
        # Clean any accidental ANSWER or Introduction inside table_block
        table_block = re.sub(r'### \*\*ANSWER\*\*\n*', '', table_block)
        table_block = re.sub(r'### \*\*Introduction\*\*\n*', '', table_block)
        table_block = table_block.strip()

        body_block = text[line3_end:].strip()
    else:
        table_block = ""
        body_block = text.strip()

    # Clean body_block headers
    body_block = re.sub(r'^(?:#{1,4}\s*)?(?:\*\*|__)?\s*ANSWER\s*(?:\*\*|__)?\s*\n?', '', body_block, flags=re.I).strip()
    body_block = re.sub(r'^(?:#{1,4}\s*)?(?:\*\*|__)?\s*Introduction\s*(?:\*\*|__)?\s*\n?', '', body_block, flags=re.I).strip()
    body_block = re.sub(r'^(?:\*\*|__)?\s*Notes?\s*(?:\*\*|__)?\s*\n?', '', body_block, flags=re.I).strip()

    # Place Introduction
    body_block = "### **Introduction**\n\n" + body_block

    # Clean Conclusion
    body_block = re.sub(r'\n(?:\s*#{1,4}\s*)?(?:\*\*|__)?\s*Conclusion\s*(?:\*\*|__)?\s*:\s*\n?', r'\n\n### **Conclusion**\n\n', body_block, flags=re.I)
    body_block = re.sub(r'\n(?:\s*#{1,4}\s*)?(?:\*\*|__)?\s*Conclusion\s*(?:\*\*|__)?\s*\n', r'\n\n### **Conclusion**\n\n', body_block, flags=re.I)

    # Standardize Introduction
    body_block = re.sub(r'^(?:#{1,4}\s*)?(?:\*\*|__)?\s*Introduction\s*(?:\*\*|__)?\s*:\s*\n?', '### **Introduction**\n\n', body_block, flags=re.I)
    body_block = re.sub(r'^(?:#{1,4}\s*)?(?:\*\*|__)?\s*Introduction\s*(?:\*\*|__)?\s*\n?', '### **Introduction**\n\n', body_block, flags=re.I)

    if table_block:
        return table_block + "\n\n### **ANSWER**\n\n" + body_block
    else:
        return "### **ANSWER**\n\n" + body_block

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
        print(f"  Cleaning & Assembling answers for {label}")
        print(f"{'='*60}")

        with open(filepath, "r", encoding="utf-8") as f:
            data = json.load(f)

        questions = data.get("questions", [])
        updated_count = 0
        total_count = 0

        for q in questions:
            q_id = q["id"]
            for a in q.get("answers", []):
                total_count += 1
                txt = a.get("answerText", "")

                new_txt = clean_and_assemble_answer(txt)
                if new_txt != txt:
                    a["answerText"] = new_txt
                    updated_count += 1

                ans_id = a.get("id") or f"{q_id}-levelup_ias"
                a["id"] = ans_id

                all_answers_to_upload.append({
                    "id": ans_id,
                    "question_id": q_id,
                    "institute": a.get("institute", TARGET_INSTITUTE),
                    "answer_text": new_txt
                })

        print(f"  {label}: Assembled {updated_count}/{total_count} answers cleanly.")

        with open(filepath, "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
        print(f"  {label} JSON saved cleanly.")

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
                    ans_fixed = clean_and_assemble_answer(ans_body)
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

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

def format_intro_and_conclusion(text):
    if not text:
        return text

    # Split table from body if table exists
    table_m = re.search(r'(^\|\s*\*\*✔\s*Aspects.*?\n\n?)', text, re.DOTALL)
    if table_m:
        table_part = table_m.group(1)
        body_part = text[table_m.end():].strip()
    else:
        # Check if single-column Approach box exists
        table_m2 = re.search(r'(^\|\s*\*\*Approach:.*?\n\n?)', text, re.DOTALL)
        if table_m2:
            table_part = table_m2.group(1)
            body_part = text[table_m2.end():].strip()
        else:
            table_part = ""
            body_part = text.strip()

    # Normalize ANSWER header
    body_part = re.sub(r'^(?:#{1,4}\s*)?(?:\*\*|__)?\s*ANSWER\s*(?:\*\*|__)?\s*\n', '', body_part, flags=re.I).strip()
    # Remove any leftover 'Notes' line right after ANSWER
    body_part = re.sub(r'^(?:\*\*|__)?\s*Notes?\s*(?:\*\*|__)?\s*\n', '', body_part, flags=re.I).strip()

    # Format Introduction
    if not re.match(r'^(?:#{1,4}\s*)?(?:\*\*|__)?\s*Introduction\s*(?:\*\*|__)?', body_part, flags=re.I):
        body_part = "### **Introduction**\n\n" + body_part

    # Format Conclusion
    # Replace any plain **Conclusion** or Conclusion line with ### **Conclusion**
    body_part = re.sub(r'\n(?:\s*#{1,4}\s*)?(?:\*\*|__)?\s*Conclusion\s*(?:\*\*|__)?\s*:\s*\n?', r'\n\n### **Conclusion**\n\n', body_part, flags=re.I)
    body_part = re.sub(r'\n(?:\s*#{1,4}\s*)?(?:\*\*|__)?\s*Conclusion\s*(?:\*\*|__)?\s*\n', r'\n\n### **Conclusion**\n\n', body_part, flags=re.I)

    # Standardize ### **Introduction**
    body_part = re.sub(r'^(?:#{1,4}\s*)?(?:\*\*|__)?\s*Introduction\s*(?:\*\*|__)?\s*:\s*\n?', '### **Introduction**\n\n', body_part, flags=re.I)
    body_part = re.sub(r'^(?:#{1,4}\s*)?(?:\*\*|__)?\s*Introduction\s*(?:\*\*|__)?\s*\n?', '### **Introduction**\n\n', body_part, flags=re.I)

    full_ans = table_part + "### **ANSWER**\n\n" + body_part
    return full_ans

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
        print(f"  Formatting Introduction & Conclusion headers for {label}")
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

                new_txt = format_intro_and_conclusion(txt)
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

        print(f"  {label}: Updated headers for {updated_count}/{total_count} answers.")

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
                    ans_fixed = format_intro_and_conclusion(ans_body)
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

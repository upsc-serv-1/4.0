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

PAIRS = [
    {
        "target_md": r"C:\Users\Dr. Yogesh\Downloads\Telegram Desktop\Anthropology_PAPER_1_PYQs_20_25_Extracted.md",
        "json":      r"C:\Users\Dr. Yogesh\Videos\APP FOLDER - V1 - Copy\app\frontend-noji-2.6.2\3\pilot pro 10.2\mains json files\mains_anthro1_new_consolidated.json",
        "label":     "Paper 1"
    },
    {
        "target_md": r"C:\Users\Dr. Yogesh\Downloads\Telegram Desktop\Anthropology_PAPER_2_PYQs_20_25_Extracted.md",
        "json":      r"C:\Users\Dr. Yogesh\Videos\APP FOLDER - V1 - Copy\app\frontend-noji-2.6.2\3\pilot pro 10.2\mains json files\mains_anthro2_new_consolidated.json",
        "label":     "Paper 2"
    }
]

def clean_md_file_dividers(md_path):
    with open(md_path, "r", encoding="utf-8") as f:
        raw_md = f.read()

    # Split by ## Question OR \n\n(?=## Question|\Z)
    secs = re.split(r'\n(?=##\s*Question|\Z)', raw_md)
    clean_secs = []
    extracted_entries = []

    for s in secs:
        if not s.strip() or s.startswith("# Table of Contents"):
            clean_secs.append(s.strip())
            continue

        # Extract question info
        q_id_m = re.search(r'\*\*Question ID:\*\*\s*`?(mains-[a-z0-9\-]+)`?', s)
        q_id = q_id_m.group(1).strip() if q_id_m else None

        q_txt_m = re.search(r'\*\*Question:\*\*\s*(.*?)(?=\*\*Year:\*\*|\*\*Marks:\*\*|\n\n|\Z)', s, re.DOTALL)
        question_text = q_txt_m.group(1).strip() if q_txt_m else ""

        # Remove all lone '---' lines from section
        lines = s.split('\n')
        filtered_lines = []
        for l in lines:
            if l.strip() == '---':
                continue
            filtered_lines.append(l)

        cleaned_sec_text = '\n'.join(filtered_lines).strip()

        # Extract clean answer text
        ma_m = re.search(r'##\s*Model Answer\s*\n(.*)', cleaned_sec_text, re.DOTALL | re.I)
        if ma_m:
            ans_text = ma_m.group(1).strip()
            extracted_entries.append({
                "q_id": q_id,
                "question_text": question_text,
                "answer_text": ans_text
            })

        # Append cleaned section with exactly ONE trailing ---
        clean_secs.append(cleaned_sec_text + "\n\n---\n")

    final_md = "\n\n".join(clean_secs).strip() + "\n"

    with open(md_path, "w", encoding="utf-8") as f:
        f.write(final_md)

    print(f"  Cleaned dividers in {os.path.basename(md_path)} -> {os.path.getsize(md_path)} bytes ({len(extracted_entries)} answers)")
    return extracted_entries

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

    for pair in PAIRS:
        label = pair["label"]
        print(f"\n{'='*60}")
        print(f"  Removing ALL internal dividers for {label}")
        print(f"{'='*60}")

        extracted_entries = clean_md_file_dividers(pair["target_md"])

        with open(pair["json"], "r", encoding="utf-8") as f:
            data = json.load(f)

        questions = data.get("questions", [])
        q_map = {q["id"]: q for q in questions if "id" in q}

        for md_item in extracted_entries:
            target_q = None
            if md_item["q_id"] and md_item["q_id"] in q_map:
                target_q = q_map[md_item["q_id"]]
            else:
                for q in questions:
                    if md_item["question_text"] and md_item["question_text"].lower()[:30] in q.get("questionText", "").lower():
                        target_q = q
                        break

            if target_q:
                q_id = target_q["id"]
                ans_id = f"{q_id}-levelup_ias"

                cleaned_ans = [a for a in target_q.get("answers", []) if a.get("institute") not in ["Model Answer", TARGET_INSTITUTE]]
                cleaned_ans.append({
                    "id": ans_id,
                    "institute": TARGET_INSTITUTE,
                    "answerText": md_item["answer_text"]
                })
                target_q["answers"] = cleaned_ans

        for q in questions:
            q_id = q["id"]
            for a in q.get("answers", []):
                ans_id = a.get("id") or f"{q_id}-levelup_ias"
                a["id"] = ans_id

                all_answers_to_upload.append({
                    "id": ans_id,
                    "question_id": q_id,
                    "institute": a.get("institute", TARGET_INSTITUTE),
                    "answer_text": a.get("answerText", "")
                })

        with open(pair["json"], "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
        print(f"  {label} JSON updated and saved.")

    print(f"\n{'='*60}")
    print(f"  Uploading ALL {len(all_answers_to_upload)} answers to Supabase...")
    upload_batch(all_answers_to_upload)
    print("\nDone!")

if __name__ == "__main__":
    main()

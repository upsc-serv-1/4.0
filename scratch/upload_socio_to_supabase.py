import json
import requests
import os
import time

SUPABASE_URL = "https://ngwsuqzkndlxfoantnlf.supabase.co"
SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5nd3N1cXprbmRseGZvYW50bmxmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzcyMjA0NjAsImV4cCI6MjA5Mjc5NjQ2MH0.u9-dnMmLXr_5fF243uzx6WyE_vR6dzERDuyFuF-HeZk"

HEADERS = {
    "apikey": SUPABASE_KEY,
    "Authorization": f"Bearer {SUPABASE_KEY}",
    "Content-Type": "application/json",
    "Prefer": "resolution=merge-duplicates"
}

json_path = r"C:\Users\Dr. Yogesh\Videos\APP FOLDER - V1 - Copy\app\frontend-noji-2.6.2\3\pilot pro 10.2\mains json files\mains_socio1_new_consolidated.json"

def main():
    with open(json_path, "r", encoding="utf-8") as f:
        data = json.load(f)

    questions = data.get("questions", [])
    print(f"Loaded {len(questions)} Sociology questions from JSON.")

    rows = []
    for q in questions:
        exam_info_val = q.get("exam_info", {})
        rows.append({
            "id": q.get("id"),
            "question_number": q.get("questionNumber"),
            "question_text": q.get("questionText"),
            "marks": q.get("marks"),
            "exam_year": q.get("year"),
            "paper": q.get("paper", "Optional"),
            "subject": q.get("subject", "Sociology"),
            "section_group": q.get("sectionGroup"),
            "microtopic": q.get("microTopic"),
            "subtopic": q.get("subTopic"),
            "nanotopic": q.get("nanoTopic"),
            "macrotag": q.get("macrotag"),
            "microtag": q.get("microtag"),
            "is_pyq": True,
            "source_attribution_label": q.get("source_attribution_label"),
            "exam_info": exam_info_val,
            "stage": "mains",
            "exam": "Mains",
            "exam_group": "UPSC CSE",
            "is_upsc_cse": True,
            "is_allied": False,
            "is_others": False,
            "exam_category": "cse",
            "course": "Civil Services",
            "institute": "UPSC",
            "program_id": "cse",
            "program_name": "CSE"
        })

    url = f"{SUPABASE_URL}/rest/v1/mains_questions"
    batch_size = 50
    uploaded_count = 0

    for i in range(0, len(rows), batch_size):
        batch = rows[i:i+batch_size]
        all_keys = set()
        for r in batch:
            all_keys.update(r.keys())
        padded_batch = [{k: r.get(k, None) for k in all_keys} for r in batch]

        success = False
        for attempt in range(5):
            try:
                resp = requests.post(url, json=padded_batch, headers=HEADERS, timeout=60)
                if resp.status_code in [200, 201]:
                    uploaded_count += len(batch)
                    print(f"  [OK] Batch {i//batch_size + 1}: {len(batch)} rows uploaded")
                    success = True
                    break
                else:
                    print(f"  [RETRY] Batch {i//batch_size + 1} status {resp.status_code}: {resp.text[:100]}")
                    time.sleep(3)
            except Exception as e:
                print(f"  [RETRY] Batch {i//batch_size + 1} exception: {e}")
                time.sleep(3)

        if not success:
            print(f"  [FAIL] Failed batch starting at index {i}")
            break

    print(f"Uploaded {uploaded_count}/{len(rows)} Sociology questions to Supabase.")

    # Verification query
    verify_url = f"{SUPABASE_URL}/rest/v1/mains_questions?id=like.mains-socio1%25&select=id"
    count_headers = {**HEADERS, "Prefer": "count=exact"}
    resp = requests.get(verify_url, headers=count_headers)
    total_in_db = resp.headers.get("content-range", "0/0").split("/")[-1]
    print(f"Verification: {total_in_db} Sociology questions now live in Supabase mains_questions.")

if __name__ == "__main__":
    main()

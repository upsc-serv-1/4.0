import os
import json
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

target_files = [
    r"C:\Users\Dr. Yogesh\Videos\APP FOLDER - V1 - Copy\app\frontend-noji-2.6.2\3\pilot pro 10.2\mains json files\mains_anthro1_new_consolidated.json",
    r"C:\Users\Dr. Yogesh\Videos\APP FOLDER - V1 - Copy\app\frontend-noji-2.6.2\3\pilot pro 10.2\mains json files\mains_anthro2_new_consolidated.json"
]

def upload_batch(table_name, rows):
    url = f"{SUPABASE_URL}/rest/v1/{table_name}"
    batch_size = 20 if table_name == "mains_answers" else 50
    success_count = 0
    
    cleaned_rows = []
    seen_ids = set()
    for r in rows:
        c_row = r.copy()
        c_row.pop("ethicsData", None)
        
        row_id = c_row.get("id")
        if row_id:
            if row_id in seen_ids:
                continue
            seen_ids.add(row_id)
        cleaned_rows.append(c_row)

    for i in range(0, len(cleaned_rows), batch_size):
        batch = cleaned_rows[i:i+batch_size]
        all_keys = set()
        for r in batch:
            all_keys.update(r.keys())
        padded_batch = [{k: r.get(k, None) for k in all_keys} for r in batch]
        
        success = False
        for attempt in range(5):
            try:
                resp = requests.post(url, json=padded_batch, headers=HEADERS, timeout=60)
                if resp.status_code in [200, 201]:
                    success_count += len(batch)
                    success = True
                    break
                else:
                    print(f"  [WARNING] Batch {i//batch_size + 1} returned {resp.status_code}: {resp.text}. Retrying in 5 seconds...")
                    time.sleep(5)
            except Exception as e:
                print(f"  [RETRY] Attempt {attempt+1}/5 failed: {e}. Retrying in 5 seconds...")
                time.sleep(5)
                
        if not success:
            print(f"  [FATAL] Failed to upload batch starting at {i} after 5 attempts.")
            
    print(f"  [SUCCESS] Uploaded {success_count}/{len(rows)} rows to public.{table_name}")
    time.sleep(0.05)

def main():
    all_questions = []
    all_answers = []
    seen_answer_ids = set()
    
    for filepath in target_files:
        filename = os.path.basename(filepath)
        print(f"\nProcessing {filename}...")
        if not os.path.exists(filepath):
            print(f"Error: File '{filepath}' not found.")
            continue
            
        with open(filepath, "r", encoding="utf-8") as f:
            data = json.load(f)
            
        paper_name = data.get("paper", "")
        questions = data.get("questions", [])
        print(f"  Loaded {len(questions)} questions from {filename}.")
        
        file_q_count = 0
        file_ans_count = 0
        
        for q in questions:
            q_id = q.get("id")
            if not q_id:
                continue
                
            marks_val = q.get("marks")
            if marks_val is not None:
                try:
                    marks_val = int(round(float(marks_val)))
                except (ValueError, TypeError):
                    marks_val = None

            exam_info_val = q.get("exam_info") or {}
            is_pyq_val = q.get("is_pyq", exam_info_val.get("isPyq", True))
            stage_val = q.get("stage", exam_info_val.get("stage", "mains"))
            exam_val = q.get("exam", exam_info_val.get("exam", "Mains"))
            group_val = q.get("exam_group", exam_info_val.get("group", "UPSC CSE"))
            is_upsc_cse_val = q.get("is_upsc_cse", exam_info_val.get("is_upsc_cse", True))
            is_allied_val = q.get("is_allied", exam_info_val.get("is_allied", False))
            is_others_val = q.get("is_others", exam_info_val.get("is_others", False))
            exam_category_val = q.get("exam_category", exam_info_val.get("exam_category", "cse"))
            paper_val = q.get("paper") if q.get("paper") else paper_name

            q_num = q.get("questionNumber")
            if q_num is not None:
                q_num = str(q_num)
                
            all_questions.append({
                "id": q_id,
                "question_number": q_num,
                "question_text": q.get("questionText"),
                "marks": marks_val,
                "exam_year": q.get("year"),
                "paper": paper_val,
                "subject": q.get("subject"),
                "section_group": q.get("sectionGroup"),
                "microtopic": q.get("microTopic"),
                "subtopic": q.get("subTopic"),
                "nanotopic": q.get("nanoTopic"),
                "macrotag": q.get("macrotag"),
                "microtag": q.get("microtag"),
                "is_pyq": is_pyq_val,
                "source_attribution_label": q.get("source_attribution_label"),
                "exam_info": exam_info_val,
                "stage": stage_val,
                "exam": exam_val,
                "exam_group": group_val,
                "is_upsc_cse": is_upsc_cse_val,
                "is_allied": is_allied_val,
                "is_others": is_others_val,
                "exam_category": exam_category_val,
                "course": q.get("course", "Civil Services"),
                "institute": q.get("institute", "UPSC"),
                "program_id": q.get("program_id", "cse"),
                "program_name": q.get("program_name", "CSE")
            })
            file_q_count += 1
            
            for ans in q.get("answers", []):
                ans_id = ans.get("id")
                institute = ans.get("institute", "").strip()
                inst_clean = institute.lower().replace(" ", "_")
                
                if not ans_id:
                    ans_id = f"{q_id}-{inst_clean}"
                
                base_ans_id = ans_id
                counter = 1
                while ans_id in seen_answer_ids:
                    counter += 1
                    ans_id = f"{base_ans_id}-{counter}"
                
                seen_answer_ids.add(ans_id)
                
                all_answers.append({
                    "id": ans_id,
                    "question_id": q_id,
                    "institute": institute,
                    "answer_text": ans.get("answerText")
                })
                file_ans_count += 1
                
    print(f"\nTotal prepared across both files: {len(all_questions)} questions and {len(all_answers)} model answers.")
    
    if all_questions:
        print("\nUploading questions to public.mains_questions...")
        upload_batch("mains_questions", all_questions)
        
    if all_answers:
        print("\nUploading answers to public.mains_answers...")
        upload_batch("mains_answers", all_answers)
        
    print("\nDone!")

if __name__ == "__main__":
    main()

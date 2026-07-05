import os
import json
import requests
import time

SUPABASE_URL = "https://ngwsuqzkndlxfoantnlf.supabase.co"
SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5nd3N1cXprbmRseGZvYW50bmxmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzcyMjA0NjAsImV4cCI6MjA5Mjc5NjQ2MH0.u9-dnMmLXr_5fF243uzx6WyE_vR6dzERDuyFuF-HeZk"
JSON_DIR = "mains json files"

HEADERS = {
    "apikey": SUPABASE_KEY,
    "Authorization": f"Bearer {SUPABASE_KEY}",
    "Content-Type": "application/json",
    "Prefer": "resolution=merge-duplicates"
}

def upload_batch(table_name, rows):
    url = f"{SUPABASE_URL}/rest/v1/{table_name}"
    # Use smaller batch size for answers to prevent timeouts (since answer text is massive)
    batch_size = 20 if table_name == "mains_answers" else 50
    success_count = 0
    
    # Clean frontend-only columns that do not exist in the database table
    cleaned_rows = []
    for r in rows:
        c_row = r.copy()
        c_row.pop("ethicsData", None)
        c_row.pop("ethics_data", None)
        if table_name == "mains_frameworks":
            c_row.pop("paper", None)
            c_row.pop("subject", None)
            c_row.pop("section_group", None)
            c_row.pop("microtopic", None)
            c_row.pop("subtopic", None)
        cleaned_rows.append(c_row)

    for i in range(0, len(cleaned_rows), batch_size):
        batch = cleaned_rows[i:i+batch_size]
        # Align keys in batch to prevent PGRST102 "All object keys must match" error
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
                    print(f"  [WARNING] Uploading to {table_name} batch starting at {i} returned {resp.status_code}: {resp.text}. Retrying in 5 seconds (Attempt {attempt+1}/5)...")
                    time.sleep(5)
            except Exception as e:
                print(f"  [RETRY] Attempt {attempt+1}/5 failed with error: {e}. Retrying in 5 seconds...")
                time.sleep(5)
                
        if not success:
            print(f"  [FATAL] Failed to upload batch starting at {i} after 5 attempts.")
            
    print(f"  [SUCCESS] Uploaded {success_count}/{len(rows)} rows to public.{table_name}")
    time.sleep(0.05)

# ==============================================================================
# 1. UPLOAD MAINS GS QUESTIONS & SOLUTIONS
# ==============================================================================
def upload_mains_questions_answers():
    print("\n--- Processing Mains Subjective Questions and Answers ---")
    gs_files = [
        "mains_gs1_consolidated.json",
        "mains_gs2_consolidated.json",
        "mains_gs3_consolidated.json",
        "mains_gs4_consolidated.json",
        "mains_anthro1_consolidated.json",
        "mains_anthro2_consolidated.json",
        "forum mgp 2026/forum-mgp-2026-csm26t01se.json",
        "forum mgp 2026/forum-mgp-2026-csm26t02se.json",
        "forum mgp 2026/forum-mgp-2026-csm26t03se.json",
        "forum mgp 2026/forum-mgp-2026-csm26t04se.json",
        "forum mgp 2026/forum-mgp-2026-csm26t05se.json",
        "forum mgp 2026/forum-mgp-2026-csm26t06se.json",
        "forum mgp 2026/forum-mgp-2026-csm26t07se.json",
        "forum mgp 2026/forum-mgp-2026-csm26t08se.json",
        "forum mgp 2026/forum-mgp-2026-csm26t09se.json",
        "forum mgp 2026/forum-mgp-2026-csm26t10se.json",
        "forum mgp 2026/forum-mgp-2026-csm26t11se.json",
        "forum mgp 2026/forum-mgp-2026-csm26t12se.json",
        "forum mgp 2026/forum-mgp-2026-csm26t13se.json",
        "forum mgp 2026/forum-mgp-2026-csm26t14se.json",
        "forum mgp 2026/forum-mgp-2026-csm26t15se.json"
    ]
    
    all_questions = []
    all_answers = []
    seen_answer_ids = set()
    
    for filename in gs_files:
        filepath = os.path.join(JSON_DIR, filename)
        if not os.path.exists(filepath):
            print(f"  File not found: {filename}, skipping.")
            continue
            
        with open(filepath, "r", encoding="utf-8") as f:
            data = json.load(f)
            
        paper_name = data.get("paper", "")
        
        for q in data.get("questions", []):
            # Question table mapping
            q_id = q.get("id")
            marks_val = q.get("marks")
            if marks_val is not None:
                try:
                    marks_val = int(round(float(marks_val)))
                except (ValueError, TypeError):
                    marks_val = None

            # Extract is_pyq and other sub-fields from exam_info if present
            exam_info_val = q.get("exam_info")
            is_pyq_val = True
            stage_val = "mains"
            exam_val = "Mains"
            group_val = "UPSC CSE"
            is_upsc_cse_val = True
            is_allied_val = False
            is_others_val = False
            exam_category_val = "cse"

            if isinstance(exam_info_val, dict):
                if "isPyq" in exam_info_val:
                    is_pyq_val = bool(exam_info_val["isPyq"])
                stage_val = exam_info_val.get("stage", stage_val)
                exam_val = exam_info_val.get("exam", exam_val)
                group_val = exam_info_val.get("group", group_val)
                if "is_upsc_cse" in exam_info_val:
                    is_upsc_cse_val = bool(exam_info_val["is_upsc_cse"])
                if "is_allied" in exam_info_val:
                    is_allied_val = bool(exam_info_val["is_allied"])
                if "is_others" in exam_info_val:
                    is_others_val = bool(exam_info_val["is_others"])
                exam_category_val = exam_info_val.get("exam_category", exam_category_val)

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
            
            # Answer table mapping
            for ans in q.get("answers", []):
                ans_id = ans.get("id")
                institute = ans.get("institute", "").strip()
                inst_clean = institute.lower().replace(" ", "_")
                
                # Fallback if ID is missing or empty
                if not ans_id:
                    ans_id = f"{q_id}-{inst_clean}"
                
                # Ensure global uniqueness of answer ID
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
                
    if all_questions:
        print(f"  Upserting {len(all_questions)} questions to public.mains_questions...")
        upload_batch("mains_questions", all_questions)
        
    if all_answers:
        print(f"  Upserting {len(all_answers)} model answers to public.mains_answers...")
        upload_batch("mains_answers", all_answers)

# ==============================================================================
# 2. UPLOAD VALUE ADDITIONS
# ==============================================================================
def upload_value_additions():
    # A. Data & Facts
    df_path = os.path.join(JSON_DIR, "mains_data_facts.json")
    if os.path.exists(df_path):
        print("\n--- Processing Data & Facts ---")
        with open(df_path, "r", encoding="utf-8") as f:
            rows = json.load(f)
        upload_batch("mains_data_facts", rows)
        
    # B. Introductions & Conclusions
    ic_path = os.path.join(JSON_DIR, "mains_intro_conclusions.json")
    if os.path.exists(ic_path):
        print("\n--- Processing Introductions and Conclusions ---")
        with open(ic_path, "r", encoding="utf-8") as f:
            rows = json.load(f)
        upload_batch("mains_intro_conclusions", rows)
        
    # C. Essay Value Add
    essay_path = os.path.join(JSON_DIR, "mains_essay_value_add.json")
    if os.path.exists(essay_path):
        print("\n--- Processing Essay Value Add (Anecdotes & Quotes) ---")
        with open(essay_path, "r", encoding="utf-8") as f:
            rows = json.load(f)
        upload_batch("mains_essay_value_add", rows)
        
    # D. Ethics Value Add
    ethics_path = os.path.join(JSON_DIR, "mains_ethics_value_add.json")
    if os.path.exists(ethics_path):
        print("\n--- Processing Ethics Hub Value Add ---")
        with open(ethics_path, "r", encoding="utf-8") as f:
            rows = json.load(f)
        upload_batch("mains_ethics_value_add", rows)
        
    # E. Mnemonics
    mn_path = os.path.join(JSON_DIR, "mains_mnemonics.json")
    if os.path.exists(mn_path):
        print("\n--- Processing Mnemonics ---")
        with open(mn_path, "r", encoding="utf-8") as f:
            rows = json.load(f)
        upload_batch("mains_mnemonics", rows)
        
    # F. Frameworks
    fw_path = os.path.join(JSON_DIR, "mains_frameworks.json")
    if os.path.exists(fw_path):
        print("\n--- Processing Answer Writing Frameworks ---")
        with open(fw_path, "r", encoding="utf-8") as f:
            rows = json.load(f)
        upload_batch("mains_frameworks", rows)

# ==============================================================================
# MAIN EXECUTION
# ==============================================================================
def main():
    print("==================================================")
    print("Starting Mains and Value Additions Supabase Upload")
    print("==================================================")
    
    if not os.path.exists(JSON_DIR):
        print(f"Error: Directory '{JSON_DIR}' not found.")
        return
        
    upload_mains_questions_answers()
    upload_value_additions()
    
    print("\nSupabase upload process completed successfully.")

if __name__ == "__main__":
    main()

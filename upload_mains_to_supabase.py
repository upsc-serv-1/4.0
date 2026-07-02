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
    batch_size = 50
    success_count = 0
    
    for i in range(0, len(rows), batch_size):
        batch = rows[i:i+batch_size]
        resp = requests.post(url, json=batch, headers=HEADERS)
        if resp.status_code not in [200, 201]:
            print(f"  [ERROR] Uploading to {table_name} batch starting at {i}: {resp.status_code} - {resp.text}")
        else:
            success_count += len(batch)
            
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
        "mains_anthro1_consolidated.json"
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
            all_questions.append({
                "id": q_id,
                "question_number": q.get("questionNumber"),
                "question_text": q.get("questionText"),
                "marks": q.get("marks"),
                "exam_year": q.get("year"),
                "paper": paper_name,
                "subject": q.get("subject"),
                "section_group": q.get("sectionGroup"),
                "microtopic": q.get("microTopic"),
                "subtopic": q.get("subTopic"),
                "macrotag": q.get("macrotag"),
                "microtag": q.get("microtag"),
                "hierarchy_path": q.get("hierarchy_path")
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

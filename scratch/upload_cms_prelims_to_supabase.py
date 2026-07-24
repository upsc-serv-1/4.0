import json
import requests
import os
import glob
import time

# New Supabase credentials
SUPABASE_URL = "https://rnelxupyiejsqekmcrcz.supabase.co"
SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJuZWx4dXB5aWVqc3Fla21jcmN6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQwMTgzODcsImV4cCI6MjA5OTU5NDM4N30.Cc4z8mFO4YoPbuHC40bnvEy6SQOyEbFobvMRqUqnmIQ"

HEADERS = {
    "apikey": SUPABASE_KEY,
    "Authorization": f"Bearer {SUPABASE_KEY}",
    "Content-Type": "application/json",
    "Prefer": "resolution=merge-duplicates"
}

cms_dir = r"C:\Users\Dr. Yogesh\Desktop\mains\neet and upsc cms\neet and upsc cms\final cms"
json_files = glob.glob(os.path.join(cms_dir, "*.json"))

def main():
    print(f"Starting upload for {len(json_files)} CMS JSON files to Supabase...")
    
    total_questions_uploaded = 0
    total_tests_uploaded = 0
    
    for idx, fpath in enumerate(sorted(json_files)):
        filename = os.path.basename(fpath)
        print(f"\n[{idx+1}/{len(json_files)}] Processing: {filename}")
        
        try:
            with open(fpath, "r", encoding="utf-8") as f:
                data = json.load(f)
                
            test_id = data.get("id") or filename.replace(".json", "")
            
            # Determine course (Medical Science for UPSC CMS)
            inferred_course = "Medical Science"
            
            test_payload = {
                "id": test_id,
                "title": data.get("title") or test_id,
                "provider": data.get("institute") or "Unknown",
                "institute": data.get("institute") or "Unknown",
                "program_id": data.get("program_id") or "cms",
                "program_name": data.get("program_name") or "CMS",
                "launch_year": data.get("launch_year"),
                "series": data.get("series") or "Prelims (Official)",
                "level": data.get("level"),
                "year": data.get("launch_year"),
                "subject": data.get("subject") or (data.get("questions")[0].get("subject") if data.get("questions") else None),
                "subject_test": data.get("subject_test"),
                "section_group": data.get("sectionGroup"),
                "paper_type": data.get("paperType") or "test-paper",
                "question_count": len(data.get("questions", [])),
                "default_minutes": data.get("defaultMinutes") or 120,
                "source_mode": data.get("sourceMode") or "docx-sol",
                "is_demo_available": data.get("is_demo_available", False),
                "exam_year": data.get("launch_year"),
                "course": inferred_course
            }
            
            # Upload Test Metadata
            test_url = f"{SUPABASE_URL}/rest/v1/tests"
            resp_test = requests.post(test_url, json=test_payload, headers=HEADERS, timeout=60)
            if resp_test.status_code not in [200, 201]:
                print(f"  [FAIL] Test {test_id} upload failed: {resp_test.text}")
                continue
                
            total_tests_uploaded += 1
            print(f"  [OK] Test metadata uploaded: {test_id}")
            
            # Prepare Questions Payload
            question_rows = []
            for q in data.get("questions", []):
                q_id = q.get("id") or f"{test_id}-q{q.get('questionNumber')}"
                
                # Fetch boolean flags and detailed exam info
                ei = q.get("exam_info") or {}
                
                is_pyq = q.get("isPyq") or q.get("is_pyq") or ei.get("isPyq") or ei.get("is_pyq") or True
                is_upsc_cse = q.get("is_upsc_cse", ei.get("is_upsc_cse", False))
                is_upsc_cms = q.get("is_upsc_cms", ei.get("is_upsc_cms", True))
                is_neetpg = q.get("is_neetpg", ei.get("is_neetpg", False))
                is_inicet = q.get("is_inicet", ei.get("is_inicet", False))
                is_allied = q.get("is_allied", ei.get("is_allied", False))
                is_others = q.get("is_others", ei.get("is_others", False))
                is_ncert = q.get("is_ncert", ei.get("is_ncert", False))
                
                stmt_lines = q.get("statementLines") or q.get("statement_lines")
                if isinstance(stmt_lines, list):
                    q_text = "\n\n".join(stmt_lines)
                elif isinstance(stmt_lines, str):
                    q_text = stmt_lines
                else:
                    q_text = q.get("questionText") or q.get("question_text") or ""
                    
                row = {
                    "id": q_id,
                    "test_id": test_id,
                    "question_number": q.get("questionNumber"),
                    "question_text": q_text,
                    "statement_lines": q.get("statementLines"),
                    "question_blocks": q.get("questionBlocks"),
                    "options": q.get("options"),
                    "correct_answer": q.get("correctAnswer"),
                    "explanation_markdown": q.get("explanationMarkdown"),
                    "source_attribution_label": q.get("source_attribution_label"),
                    "source": ei,
                    "subject": q.get("subject"),
                    "section_group": q.get("sectionGroup"),
                    "micro_topic": q.get("microTopic") or q.get("micro_topic"),
                    "sub_topic": q.get("subtopic") or q.get("sub_topic"),
                    "is_pyq": is_pyq,
                    "is_ncert": is_ncert,
                    "is_upsc_cse": is_upsc_cse,
                    "is_upsc_cms": is_upsc_cms,
                    "is_neetpg": is_neetpg,
                    "is_inicet": is_inicet,
                    "is_allied": is_allied,
                    "is_others": is_others,
                    "is_cancelled": q.get("is_cancelled", False),
                    "exam": q.get("exam") or ei.get("exam") or "Prelims",
                    "exam_group": q.get("exam_group") or ei.get("group") or "UPSC CMS",
                    "exam_year": q.get("exam_year") or ei.get("year") or data.get("launch_year"),
                    "exam_category": q.get("exam_category") or ei.get("exam_category") or "cms",
                    "specific_exam": q.get("specific_exam") or ei.get("specific_exam"),
                    "exam_stage": q.get("exam_stage") or ei.get("stage") or "prelims",
                    "exam_paper": q.get("exam_paper") or ei.get("paper"),
                    "course": inferred_course
                }
                question_rows.append(row)
                
            # Batch Upload Questions (size 50)
            batch_size = 50
            file_uploaded_count = 0
            questions_url = f"{SUPABASE_URL}/rest/v1/questions"
            
            for i in range(0, len(question_rows), batch_size):
                batch = question_rows[i:i+batch_size]
                resp_q = requests.post(questions_url, json=batch, headers=HEADERS, timeout=60)
                if resp_q.status_code in [200, 201]:
                    file_uploaded_count += len(batch)
                else:
                    print(f"    [FAIL] Batch {i//batch_size + 1} upload failed: {resp_q.text}")
                    
            total_questions_uploaded += file_uploaded_count
            print(f"  [OK] Uploaded {file_uploaded_count}/{len(question_rows)} questions for {test_id}")
            time.sleep(0.05)
            
        except Exception as e:
            print(f"  [ERR] Failed to process {filename}: {e}")
            
    print(f"\n[SUMMARY] Upload completed successfully!")
    print(f"  Total tests uploaded: {total_tests_uploaded}")
    print(f"  Total questions uploaded: {total_questions_uploaded}")

if __name__ == "__main__":
    main()

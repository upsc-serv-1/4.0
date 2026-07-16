import json
import os
import re
import requests
import time

# Configuration
SUPABASE_URL = "https://ngwsuqzkndlxfoantnlf.supabase.co"
SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5nd3N1cXprbmRseGZvYW50bmxmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzcyMjA0NjAsImV4cCI6MjA5Mjc5NjQ2MH0.u9-dnMmLXr_5fF243uzx6WyE_vR6dzERDuyFuF-HeZk"

HEADERS = {
    "apikey": SUPABASE_KEY,
    "Authorization": f"Bearer {SUPABASE_KEY}",
    "Content-Type": "application/json",
    "Prefer": "resolution=merge-duplicates"
}

mains_dir = r"C:\Users\Dr. Yogesh\Videos\APP FOLDER - V1 - Copy\app\frontend-noji-2.6.2\3\pilot pro 10.2\mains json files"
response_file = os.path.join(mains_dir, "gemini_responses.txt")

json_files = [
    os.path.join(mains_dir, "mains_anthro1_new_consolidated.json"),
    os.path.join(mains_dir, "mains_anthro2_new_consolidated.json"),
    os.path.join(mains_dir, "mains_anthro1_pre2012.json"),
    os.path.join(mains_dir, "mains_anthro2_pre2012.json")
]

def parse_responses(file_path):
    if not os.path.exists(file_path):
        print(f"Error: Response file not found at {file_path}")
        return {}
        
    with open(file_path, "r", encoding="utf-8") as f:
        content = f.read()
        
    # Regex to find everything between START_ANSWER and END_ANSWER
    pattern = r'<<<START_ANSWER\s+id="([^"]+)"\s*>>>([\s\S]*?)<<<END_ANSWER>>>'
    matches = re.findall(pattern, content)
    
    parsed = {}
    for q_id, ans_text in matches:
        parsed[q_id.strip()] = ans_text.strip()
        
    print(f"Successfully parsed {len(parsed)} answers from {os.path.basename(file_path)}")
    return parsed

def update_local_jsons(parsed_answers, institute="Gemini"):
    updated_questions_map = {}
    
    for json_path in json_files:
        if not os.path.exists(json_path):
            continue
            
        with open(json_path, "r", encoding="utf-8") as f:
            data = json.load(f)
            
        questions = data.get("questions", [])
        changed = False
        
        for q in questions:
            q_id = q.get("id")
            if q_id in parsed_answers:
                ans_text = parsed_answers[q_id]
                
                # Check if answers array exists, if not initialize it
                if "answers" not in q or not isinstance(q["answers"], list):
                    q["answers"] = []
                    
                # Check if Gemini answer already exists
                existing_ans = None
                for ans in q["answers"]:
                    if ans.get("institute") == institute:
                        existing_ans = ans
                        break
                        
                ans_id = f"{q_id}-{institute.lower()}"
                
                if existing_ans:
                    existing_ans["answerText"] = ans_text
                else:
                    q["answers"].append({
                        "id": ans_id,
                        "institute": institute,
                        "answerText": ans_text
                    })
                    
                changed = True
                updated_questions_map[q_id] = ans_text
                
        if changed:
            with open(json_path, "w", encoding="utf-8") as f:
                json.dump(data, f, indent=2, ensure_ascii=False)
            print(f"Updated local JSON file: {os.path.basename(json_path)}")
            
    return updated_questions_map

def upload_to_supabase(updated_questions, institute="Gemini"):
    if not updated_questions:
        print("No new answers to upload.")
        return
        
    rows = []
    for q_id, ans_text in updated_questions.items():
        ans_id = f"{q_id}-{institute.lower()}"
        rows.append({
            "id": ans_id,
            "question_id": q_id,
            "institute": institute,
            "answer_text": ans_text
        })
        
    print(f"Preparing to upload {len(rows)} answers to public.mains_answers...")
    
    url = f"{SUPABASE_URL}/rest/v1/mains_answers"
    batch_size = 20
    success_count = 0
    
    for i in range(0, len(rows), batch_size):
        batch = rows[i:i+batch_size]
        # Align keys in batch
        all_keys = set()
        for r in batch:
            all_keys.update(r.keys())
        padded_batch = [{k: r.get(k, None) for k in all_keys} for r in batch]
        
        success = False
        for attempt in range(3):
            try:
                resp = requests.post(url, json=padded_batch, headers=HEADERS, timeout=60)
                if resp.status_code in [200, 201]:
                    success_count += len(batch)
                    print(f"  Uploaded batch {i//batch_size + 1}/{len(rows)//batch_size + 1} - OK")
                    success = True
                    break
                else:
                    print(f"  Attempt {attempt+1} failed: {resp.status_code} - {resp.text[:150]}")
                    time.sleep(2)
            except Exception as e:
                print(f"  Attempt {attempt+1} error: {e}")
                time.sleep(2)
                
        if not success:
            print(f"  Failed to upload batch starting at index {i}. Aborting...")
            break
            
    print(f"Uploaded {success_count} / {len(rows)} answers to Supabase mains_answers.")

def main():
    print(f"Looking for Gemini response file at: {response_file}")
    parsed = parse_responses(response_file)
    if not parsed:
        print("No answers parsed. Make sure to put your responses in 'gemini_responses.txt' in the 'mains json files' folder.")
        return
        
    updated = update_local_jsons(parsed)
    if updated:
        upload_to_supabase(updated)
    else:
        print("No matching question IDs found in local JSON files.")

if __name__ == "__main__":
    main()

import os
import json
import requests
import time

def load_env():
    env_vars = {}
    if os.path.exists(".env"):
        with open(".env", "r", encoding="utf-8") as f:
            for line in f:
                if "=" in line and not line.strip().startswith("#"):
                    k, v = line.strip().split("=", 1)
                    env_vars[k.strip()] = v.strip().strip('"').strip("'")
    return env_vars

env = load_env()
SUPABASE_URL = env.get("EXPO_PUBLIC_SUPABASE_URL") or "https://rnelxupyiejsqekmcrcz.supabase.co"
SUPABASE_KEY = env.get("EXPO_PUBLIC_SUPABASE_ANON_KEY") or "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJuZWx4dXB5aWVqc3Fla21jcmN6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQwMTgzODcsImV4cCI6MjA5OTU5NDM4N30.Cc4z8mFO4YoPbuHC40bnvEy6SQOyEbFobvMRqUqnmIQ"

HEADERS = {
    "apikey": SUPABASE_KEY,
    "Authorization": f"Bearer {SUPABASE_KEY}",
    "Content-Type": "application/json",
    "Prefer": "resolution=merge-duplicates"
}

def delete_old_answers(q_ids):
    # Deletes any existing Compass answers for these specific question IDs
    print(f"Deleting existing Compass answers for {len(q_ids)} questions...")
    
    # Process deletions in batches to avoid URL length limits
    batch_size = 50
    for i in range(0, len(q_ids), batch_size):
        batch_ids = q_ids[i:i+batch_size]
        q_ids_str = ",".join(batch_ids)
        del_url = f"{SUPABASE_URL}/rest/v1/mains_answers?institute=eq.Compass&question_id=in.({q_ids_str})"
        try:
            resp = requests.delete(del_url, headers=HEADERS, timeout=30)
            if resp.status_code not in [200, 204]:
                print(f"  [WARNING] Failed to delete batch: {resp.status_code} {resp.text}")
            else:
                print(f"  Successfully deleted old answers for batch {i//batch_size + 1}")
        except Exception as e:
            print(f"  [WARNING] Error deleting batch: {e}")
        time.sleep(0.5)

def upload_new_answers(rows):
    url = f"{SUPABASE_URL}/rest/v1/mains_answers"
    batch_size = 20 # Small batch size for massive answer text
    success_count = 0
    
    print(f"Uploading {len(rows)} new Compass answers...")
    for i in range(0, len(rows), batch_size):
        batch = rows[i:i+batch_size]
        try:
            resp = requests.post(url, headers=HEADERS, json=batch, timeout=30)
            if resp.status_code in [200, 201, 204]:
                success_count += len(batch)
                print(f"  Uploaded {success_count}/{len(rows)}...")
            else:
                print(f"  [ERROR] Upload failed for batch: {resp.status_code} {resp.text}")
        except Exception as e:
            print(f"  [ERROR] Exception uploading batch: {e}")
        time.sleep(1)

def run():
    files = [
        r"C:\Users\Dr. Yogesh\Downloads\compass antrho\final 3\mains-upsc_anthro_paper_1_2012-2025_compass_updated_v3_SYNCED.json",
        r"C:\Users\Dr. Yogesh\Downloads\compass antrho\final 3\mains-upsc_anthro_paper_2_2012-2025_compass_updated_v3_SYNCED.json"
    ]
    
    all_q_ids = []
    all_answers_to_upload = []
    
    for file_path in files:
        with open(file_path, 'r', encoding='utf-8') as f:
            data = json.load(f)
            for q in data.get('questions', []):
                q_id = q.get('id')
                if not q_id: continue
                
                # Check for Compass answers
                for ans in q.get('answers', []):
                    inst = ans.get('instituteName', ans.get('institute', ''))
                    if inst == 'Compass':
                        # Valid compass answer found!
                        all_q_ids.append(q_id)
                        
                        # Generate ID exactly as upload_mains_to_supabase.py does
                        ans_id = f"{q_id}-compass"
                        all_answers_to_upload.append({
                            "id": ans_id,
                            "question_id": q_id,
                            "institute": inst,
                            "answer_text": ans.get('answerText', '')
                        })
                        break # Only take the first compass answer if multiple exist
                        
    # 1. Delete old
    delete_old_answers(all_q_ids)
    
    # 2. Upload new
    upload_new_answers(all_answers_to_upload)
    
    print("\nSYNC COMPLETE!")

if __name__ == '__main__':
    run()
